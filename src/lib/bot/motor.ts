import { buscar, filtrosDeEntidades, recientes, similares } from "./busqueda";
import { avisame, iniciarCaptacion, ofrecerAviso, pasoCaptacion } from "./captacion";
import type { Negocio } from "./negocio";
import { extraerEntidades, type Entidades } from "./nlu/entidades";
import { detectarIntenciones, type Intencion } from "./nlu/intenciones";
import { esSoloEmojis, tokenizar } from "./nlu/normalizar";
import { datosVehiculo, listaNumerada, precioDe, tarjetaEleccion } from "./respuestas";
import { sesionNueva, sesionVigente, type Filtros, type Oferta, type Sesion } from "./sesion";
import * as T from "./textos";
import {
  MAX_FALLOS_PASO,
  MAX_MENSAJES,
  MAX_TARJETAS,
  TEMAS_NEGOCIO,
  auto,
  autoActual,
  decir,
  fijarVehiculo,
  idDeOrdinal,
  mostrarContacto,
  mostrarLista,
  nombrados,
  nombreParaSaludo,
  referenciaContextual,
  saludarAntes,
  salirDelPaso,
  secretaria,
  tarjetas,
  tiene,
  variante,
  type Turno,
} from "./turno";
import type { LeadInput, MensajeSalida, Perfil, VehiculoCatalogo } from "./types";

/**
 * Motor de conversacion por reglas: una maquina de estados PURA (sin red, sin reloj, sin azar).
 * El tiempo entra por `ahora` y la variedad del texto por `mid`, asi que la misma entrada da
 * siempre la misma respuesta y los tests pueden fijar conversaciones enteras.
 *
 * Orden de las reglas (la primera que aplica responde), tal como el plan de la tarea 9:
 *  1. sesion vencida → contexto nuevo          (conversar)
 *  2. mensaje sin texto (audio, foto, mencion) (sinTexto)
 *  3. solo emojis                              (emojiCuentaComoSi)
 *  4. pasos de captacion: nombre y telefono    (pasoCaptacion)
 *  5. paso "eligiendo_historia"                (pasoEligiendoHistoria)
 *  6. respuesta a una historia                 (respuestaAHistoria)
 *  7. correccion "no es ese"                   (esCorreccion / corregirHistoria)
 *  8. intenciones                              (responderIntenciones)
 *  9. presentar un auto segun su estado        (presentarVehiculo)
 * La redaccion vive en `textos.ts`; aca solo se decide que decir. Las utilidades compartidas del
 * turno estan en `turno.ts` y la captacion de datos (regla 4) en `captacion.ts`.
 */

export type EntradaMotor = {
  /** null si el mensaje no trae texto (adjunto). */
  texto: string | null;
  adjuntos: string[];
  historiaId: string | null;
  /** Auto vinculado a `historiaId` en la base (null si la historia no se conoce). */
  vehiculoDeHistoria: string | null;
  mid: string; // semilla de las variantes de texto
  sesion: Sesion;
  catalogo: VehiculoCatalogo[];
  perfil: Perfil | null;
  ahora: Date;
  siteUrl: string;
  negocio: Negocio;
};

export type ResultadoMotor = {
  mensajes: MensajeSalida[]; // maximo 3
  sesion: Sesion; // la nueva (con ultimaActividad = ahora)
  lead: LeadInput | null; // para guardar en leads
  aprenderHistoria: { storyId: string; vehiculoId: string } | null;
  olvidarHistoria: string | null; // story_id cuyo vinculo hay que borrar
  noEntendido: boolean;
  /** false = no hay que contestar nada (emoji suelto sin contexto, mencion en historia). */
  responder: boolean;
};

// Intenciones que no aportan un pedido propio: si el texto ademas nombra un auto, lo que quiere es ese auto
// ("hola, tienen la 206?", "me interesa el vento", "la partner gracias").
const CHARLA_CON_AUTO = new Set<Intencion>(["desconocida", "saludo", "cortesia", "gracias", "catalogo", "afirmacion"]);
// Con una historia identificada y sin pedido concreto ("hola!", "👍") se presenta el auto de la historia.
// Un "gracias" o un pedido de catalogo ahi no piden el auto: se responden normalmente.
const CHARLA_EN_HISTORIA = new Set<Intencion>(["desconocida", "saludo", "cortesia", "afirmacion"]);

// Mientras se elige la historia, estas tambien salen del paso (no tienen que ver con cual auto era).
const ESCAPAN_DE_HISTORIA = new Set<Intencion>([
  "humano", "identidad", "avisame", "catalogo", "ver_mas", ...TEMAS_NEGOCIO,
]);
const NINGUNO = new Set(["ninguno", "ninguna", "ningun", "otro", "otra"]);
// Unicas frases que dicen "ese no es el auto de la historia"; una frase larga ya es otra cosa ("ese no me gusta tanto").
const FRASES_CORRECCION = ["ese no", "esa no", "no es ese", "no es esa", "no era ese", "no era esa"];
const MAX_TOKENS_CORRECCION = 6;

export function conversar(e: EntradaMotor): ResultadoMotor {
  // Regla 1: pasadas 24 h el cliente vuelve por otra cosa; arrastrar el auto de ayer confunde.
  const base = sesionVigente(e.sesion, e.ahora) ? e.sesion : sesionNueva(e.ahora);
  const t: Turno = {
    e,
    s: structuredClone(base),
    ctx: { negocio: e.negocio, siteUrl: e.siteUrl },
    mensajes: [],
    lead: null,
    aprenderHistoria: null,
    olvidarHistoria: null,
    noEntendido: false,
    responder: true,
  };
  turno(t);
  const responder = t.responder && t.mensajes.length > 0;
  return {
    mensajes: responder ? t.mensajes.slice(0, MAX_MENSAJES) : [],
    sesion: { ...t.s, ultimaActividad: e.ahora.toISOString() },
    lead: t.lead,
    aprenderHistoria: t.aprenderHistoria,
    olvidarHistoria: t.olvidarHistoria,
    noEntendido: t.noEntendido,
    responder,
  };
}

function turno(t: Turno): void {
  const texto = (t.e.texto ?? "").trim();
  if (texto === "") return sinTexto(t);
  if (esSoloEmojis(texto) && !emojiCuentaComoSi(t, texto)) {
    t.responder = false;
    return;
  }

  const { historiaId } = t.e;
  if (historiaId === null) {
    if (t.s.paso === "pidiendo_nombre" || t.s.paso === "pidiendo_telefono") {
      if (pasoCaptacion(t, texto)) return;
    } else if (t.s.paso === "eligiendo_historia") {
      if (pasoEligiendoHistoria(t, texto)) return;
    }
  } else {
    // Una respuesta a otra historia manda sobre lo que se estaba preguntando: es un tema nuevo.
    salirDelPaso(t.s);
  }

  const intenciones = detectarIntenciones(texto);
  const ent = extraerEntidades(texto, t.e.catalogo);
  if (historiaId !== null && !respuestaAHistoria(t, historiaId, texto, ent, intenciones)) return;
  if (esCorreccion(t, texto)) return corregirHistoria(t);
  responderIntenciones(t, texto, intenciones, ent, { autoDeHistoria: historiaId !== null, saludar: true });
}

// ---------------------------------------------------------------------------------------------
// Reglas 2 y 3: sin texto y solo emojis

function sinTexto(t: Turno): void {
  const { adjuntos } = t.e;
  // Una mencion en una historia no es una consulta: contestarla seria spam.
  if (adjuntos.length === 0 || adjuntos.every((a) => a === "story_mention")) {
    t.responder = false;
    return;
  }
  // Audio o foto: el bot no los entiende, pero el cliente si espera respuesta.
  if (adjuntos.includes("audio")) decir(t, variante(t, "audio", T.audio));
  else decir(t, variante(t, "foto", T.foto));
}

/**
 * Un emoji suelto sin contexto (una reaccion) no se contesta. Dentro de una charla libre un 👍 es un
 * "si" a lo ultimo que se ofrecio. En medio de un paso (nombre, telefono) un emoji no responde nada.
 * Una reaccion a una historia solo es contexto si ya se sabe de que auto es: si no, no hay nada que
 * confirmar. Sin oferta pendiente un 👍 tampoco contesta (ej. despues de un vendido): el bot no tiene
 * nada que reafirmar y "contame que andas buscando" suena a no haber leido la charla.
 */
function emojiCuentaComoSi(t: Turno, texto: string): boolean {
  const { s } = t;
  const hayContexto = t.e.historiaId !== null ? auto(t, t.e.vehiculoDeHistoria) !== null : s.ofrecio !== null;
  return s.paso === "libre" && hayContexto && tiene(detectarIntenciones(texto), "afirmacion");
}

// ---------------------------------------------------------------------------------------------
// Reglas 5, 6 y 7: historias

/** Muestra la lista numerada (con foto: el cliente reconoce el auto por la imagen) para elegir. */
function preguntarCualHistoria(t: Turno, vehiculos: VehiculoCatalogo[], variantes: string[], clave: string): void {
  const lista = vehiculos.slice(0, MAX_TARJETAS);
  t.s.mostradosIds = lista.map((v) => v.id);
  decir(t, variante(t, clave, variantes));
  if (lista.length === 0) return;
  t.mensajes.push({
    tipo: "tarjetas",
    tarjetas: lista.map((v, i) => tarjetaEleccion(v, i + 1, t.ctx)),
    alternativaTexto: listaNumerada(lista),
  });
}

/** Devuelve false si el cliente cambio de tema (el mensaje se procesa normalmente). */
function pasoEligiendoHistoria(t: Turno, texto: string): boolean {
  const { s } = t;
  const intenciones = detectarIntenciones(texto);
  const ent = extraerEntidades(texto, t.e.catalogo);
  const elegido = auto(t, ent.vehiculoIds.length === 1 ? ent.vehiculoIds[0] : idDeOrdinal(s.mostradosIds, ent.ordinal));
  if (elegido) {
    resolverHistoria(t, elegido);
    return true;
  }

  if (tokenizar(texto).some((p) => NINGUNO.has(p)) || tiene(intenciones, "negacion")) {
    // No era ninguno de los ultimos: no se aprende nada y se le muestra lo que hay.
    salirDelPaso(s);
    s.historiaActualId = null;
    mostrarBusqueda(t, {}, texto, T.historiaNinguno);
    return true;
  }
  if (intenciones.some((i) => ESCAPAN_DE_HISTORIA.has(i))) {
    salirDelPaso(s);
    return false;
  }

  s.fallos += 1;
  t.noEntendido = true;
  if (s.fallos >= MAX_FALLOS_PASO) {
    salirDelPaso(s);
    decir(t, variante(t, "otra-vez", T.noEntendidoOtraVez(secretaria(t))));
    mostrarContacto(t, null);
    return true;
  }
  decir(t, variante(t, "historia-repregunta", T.historiaNoEntendida(Math.max(1, s.mostradosIds.length))));
  return true;
}

/** Aprende la historia y contesta lo que el cliente habia preguntado al principio, ya sobre ese auto. */
function resolverHistoria(t: Turno, v: VehiculoCatalogo): void {
  const { s } = t;
  const storyId = s.historiaPendienteId;
  const pregunta = s.preguntaPendiente ?? "";
  salirDelPaso(s);
  fijarVehiculo(t, v.id);
  if (storyId) {
    t.aprenderHistoria = { storyId, vehiculoId: v.id };
    s.historiaActualId = storyId;
  }
  const entPregunta = extraerEntidades(pregunta, t.e.catalogo);
  // Si la pregunta nombraba varios autos ("el 206 o el 208?"), el cliente ya eligio uno: la respuesta es sobre ese.
  const ent = entPregunta.vehiculoIds.length > 1 ? { ...entPregunta, vehiculoIds: [v.id] } : entPregunta;
  responderIntenciones(t, pregunta, detectarIntenciones(pregunta), ent, { autoDeHistoria: true, saludar: false });
}

/** Regla 6. Devuelve true si el auto quedo identificado (y el resto del texto se responde con el en contexto). */
function respuestaAHistoria(t: Turno, historiaId: string, texto: string, ent: Entidades, intenciones: Intencion[]): boolean {
  const { s } = t;
  const conocido = auto(t, t.e.vehiculoDeHistoria);
  const unico = ent.vehiculoIds.length === 1 ? auto(t, ent.vehiculoIds[0]) : null;
  const elegido = conocido ?? unico;
  if (elegido) {
    s.vehiculoActualId = elegido.id;
    s.historiaActualId = historiaId;
    // Si la historia no se conocia y el cliente nombro el auto, el proximo que responda ya se resuelve solo.
    if (!conocido) t.aprenderHistoria = { storyId: historiaId, vehiculoId: elegido.id };
    return true;
  }

  // No se sabe que auto es: se pregunta una vez y se guarda la pregunta para contestarla despues.
  const varios = nombrados(t, ent);
  s.paso = "eligiendo_historia";
  s.historiaPendienteId = historiaId;
  s.preguntaPendiente = texto;
  s.vehiculoActualId = null;
  s.historiaActualId = null;
  preguntarCualHistoria(t, varios.length > 1 ? varios : recientes(t.e.catalogo, MAX_TARJETAS), T.cualDeLaHistoria, "historia");
  if (tiene(intenciones, "saludo")) saludarAntes(t);
  return false;
}

/**
 * "no es ese", "ese no": solo corrige si el auto actual salio de una historia (si no, es un "no" comun).
 * Solo cuentan las frases explicitas: "no, es mucho" o "eso no" son un reclamo por el precio, no un "ese
 * no es el auto de la historia", y tomar una por la otra borra un vinculo correcto. `historiaActualId` se
 * limpia cuando se presenta otro auto, asi que aca basta con que siga puesto.
 */
function esCorreccion(t: Turno, texto: string): boolean {
  if (t.s.historiaActualId === null) return false;
  const tokens = tokenizar(texto);
  if (tokens.length > MAX_TOKENS_CORRECCION) return false;
  const dicho = ` ${tokens.join(" ")} `;
  return FRASES_CORRECCION.some((frase) => dicho.includes(` ${frase} `));
}

/** Regla 7: el aprendizaje se equivoco; se borra el vinculo y se vuelve a preguntar para aprenderlo bien. */
function corregirHistoria(t: Turno): void {
  const { s } = t;
  t.olvidarHistoria = s.historiaActualId;
  s.historiaPendienteId = s.historiaActualId;
  s.historiaActualId = null;
  s.vehiculoActualId = null;
  s.preguntaPendiente = null;
  s.ofrecio = null;
  s.paso = "eligiendo_historia";
  s.fallos = 0;
  preguntarCualHistoria(t, recientes(t.e.catalogo, MAX_TARJETAS), T.corregirHistoria, "correccion");
}

// ---------------------------------------------------------------------------------------------
// Regla 8: intenciones

type Opciones = { autoDeHistoria: boolean; saludar: boolean };

function responderIntenciones(t: Turno, texto: string, intenciones: Intencion[], ent: Entidades, op: Opciones): void {
  // Lo ofrecido vale solo para el mensaje siguiente; cada respuesta deja su propia oferta.
  const oferta = t.s.ofrecio;
  t.s.ofrecio = null;
  // Entender algo reinicia el contador de "no entendi".
  const fallosPrevios = t.s.fallos;
  t.s.fallos = 0;

  const yaSaludo = despacharIntencion(t, texto, intenciones, ent, op, oferta, fallosPrevios);
  if (op.saludar && !yaSaludo && tiene(intenciones, "saludo")) saludarAntes(t);
}

/** Devuelve true si la respuesta ya es un saludo (no hay que anteponerle otro). */
function despacharIntencion(
  t: Turno,
  texto: string,
  intenciones: Intencion[],
  ent: Entidades,
  op: Opciones,
  oferta: Oferta | null,
  fallosPrevios: number,
): boolean {
  const hay = (i: Intencion) => tiene(intenciones, i);
  const sec = secretaria(t);

  if (hay("humano")) {
    decir(t, variante(t, "humano", T.humano(sec)));
    mostrarContacto(t, autoActual(t));
    return false;
  }
  if (hay("identidad")) {
    decir(t, variante(t, "identidad", T.identidad(t.e.negocio.nombre, sec)));
    mostrarContacto(t, autoActual(t));
    return false;
  }
  if (hay("avisame")) {
    avisame(t, texto, ent, oferta);
    return false;
  }

  const temas = TEMAS_NEGOCIO.filter(hay);
  // "cuanto es el anticipo", "cuanto sale la cuota": el "cuanto" es de la financiacion, no del auto.
  const esDeFinanciacion = hay("precio") && hay("financiacion") && !hay("info") && !hay("disponibilidad");
  if ((hay("precio") || hay("info") || hay("disponibilidad")) && !esDeFinanciacion) {
    const presentado = preguntaPorAuto(t, ent, hay("precio") ? "precio" : "info");
    // "cuanto sale el vento y toman usados?": las dos cosas, sin repetir el boton (ya va en la tarjeta).
    if (presentado && temas.length > 0) responderNegocio(t, temas, false);
    return false;
  }
  if (temas.length > 0) {
    // "el vento tiene financiacion?": el boton de Nati tiene que hablar del Vento, no de un auto viejo o de ninguno.
    const nombradosAca = nombrados(t, ent);
    if (nombradosAca.length === 1) fijarVehiculo(t, nombradosAca[0].id);
    responderNegocio(t, temas, true);
    return false;
  }

  // "tienen la 206?", "la partner", "me interesa el vento": el auto nombrado manda sobre un "si" o un "gracias".
  if (intenciones.every((i) => CHARLA_CON_AUTO.has(i))) {
    const lista = nombrados(t, ent);
    const ref = referenciaContextual(t, ent);
    // "esa me interesa" sobre el auto que ya se mostro es un "si", no un pedido de volver a verlo.
    const refUtil = ref && !(hay("afirmacion") && ref.id === t.s.vehiculoActualId) ? ref : null;
    const deHistoria =
      op.autoDeHistoria && intenciones.every((i) => CHARLA_EN_HISTORIA.has(i)) && Object.keys(filtrosDeEntidades(ent)).length === 0
        ? autoActual(t)
        : null;
    if (lista.length > 1) {
      mostrarVarios(t, lista);
      return false;
    }
    const v = lista[0] ?? refUtil ?? deHistoria;
    if (v) {
      presentarVehiculo(t, v, "general");
      return false;
    }
  }

  if (hay("ver_mas")) {
    verMas(t);
    return false;
  }
  const filtros = filtrosDeEntidades(ent);
  if (hay("catalogo") || Object.keys(filtros).length > 0) {
    mostrarBusqueda(t, filtros, texto, T.listaExacta);
    return false;
  }
  // "ok gracias" cierra la charla: no es un "si" a lo ultimo que se ofrecio.
  if (hay("afirmacion") && !hay("gracias") && !hay("despedida")) {
    afirmar(t, oferta);
    return false;
  }
  if (hay("negacion")) {
    decir(t, variante(t, "sin-problema", T.sinProblema));
    return false;
  }
  if (hay("despedida")) {
    decir(t, variante(t, "despedida", T.despedida));
    return false;
  }
  if (hay("gracias")) {
    decir(t, variante(t, "gracias", T.gracias));
    return false;
  }
  if (hay("cortesia")) {
    decir(t, variante(t, "cortesia", T.cortesia(nombreParaSaludo(t))));
    return true;
  }
  if (hay("saludo")) {
    decir(t, variante(t, "saludo", T.saludo(nombreParaSaludo(t))));
    return true;
  }
  noEntendido(t, fallosPrevios);
  return false;
}

/** Primera vez: repregunta con ejemplos. Desde la segunda: menu corto y la secretaria. */
function noEntendido(t: Turno, fallosPrevios: number): void {
  t.noEntendido = true;
  t.s.fallos = fallosPrevios + 1;
  if (t.s.fallos === 1) {
    decir(t, variante(t, "no-entendido", T.noEntendidoPrimero));
    return;
  }
  decir(t, variante(t, "no-entendido", T.noEntendidoOtraVez(secretaria(t))));
  mostrarContacto(t, null);
}

function afirmar(t: Turno, oferta: Oferta | null): void {
  switch (oferta) {
    case "contacto":
      decir(t, variante(t, "acepta", T.aceptaContacto(secretaria(t))));
      return mostrarContacto(t, autoActual(t));
    case "mas":
      return verMas(t);
    case "aviso":
      return iniciarCaptacion(t);
    default:
      decir(t, variante(t, "si", T.afirmacionSinOferta));
  }
}

/** precio / info / disponibilidad: necesitan un auto. Devuelve true si se presento uno. */
function preguntaPorAuto(t: Turno, ent: Entidades, motivo: "precio" | "info"): boolean {
  const lista = nombrados(t, ent);
  if (lista.length > 1) {
    // Varios candidatos: se pregunta cual, con la lista en una linea, y se recuerdan para "el primero".
    const opciones = lista.slice(0, MAX_TARJETAS);
    t.s.mostradosIds = opciones.map((v) => v.id);
    const linea = opciones.map((v, i) => `${i + 1}) ${v.nombre}`).join(" · ");
    decir(t, variante(t, "cual-de-estos", T.cualDeEstos(linea)));
    return false;
  }
  const v = lista[0] ?? referenciaContextual(t, ent) ?? autoActual(t);
  if (!v) {
    // Sin auto: se pregunta cual y se deja ofrecido el catalogo completo (un "si" lo muestra).
    decir(t, variante(t, "cual-auto", T.cualAuto));
    t.s.ofrecio = "mas";
    t.s.filtros = {};
    t.s.vistosIds = [];
    return false;
  }
  presentarVehiculo(t, v, motivo);
  return true;
}

/** "tienen la 206 o la 208?": los disponibles en tarjetas y, en el texto, cuales ya no estan. */
function mostrarVarios(t: Turno, vehiculos: VehiculoCatalogo[]): void {
  const disponibles = vehiculos.filter((v) => v.estado === "disponible");
  if (disponibles.length === 0) return presentarVehiculo(t, vehiculos[0], "general");
  const otros = vehiculos.filter((v) => v.estado !== "disponible").slice(0, 3).map(T.noDisponibleEnLista);
  decir(t, [variante(t, "varios", T.variosNombrados), ...otros].join("\n"));
  mostrarLista(t, disponibles);
}

/** Datos del negocio: el texto de negocio.ts o, si esta pendiente (null), que lo confirma la secretaria. */
function responderNegocio(t: Turno, temas: Intencion[], conContacto: boolean): void {
  const n = t.e.negocio;
  const sec = n.secretaria;
  const datos = temas.slice(0, 3).map((tema) => datoDeNegocio(tema, n));
  const pendientes = datos.filter((d) => d.texto === null);
  // Financiacion y permuta son interes real de compra: siempre van con el boton, aunque esten cargadas.
  const deriva = datos.some((d) => d.deriva || d.texto === null);

  if (pendientes.length === datos.length) {
    decir(t, variante(t, "pendiente", T.todoPendiente(unirTemas(datos.map((d) => d.tema)), sec)));
  } else {
    // Pegado a la respuesta de un auto ya hubo un "te cuento": no se repite.
    const intro = conContacto ? [variante(t, "intro-negocio", T.introNegocio)] : [];
    const cuerpo = datos.map((d) => d.texto ?? T.temaPendiente(d.tema, sec));
    const lineas = [...intro, ...cuerpo];
    // Si los datos ya mandan a la secretaria ("te la pasa Nati"), repetirlo en el cierre suena a disco rayado.
    if (deriva && !cuerpo.some((linea) => linea.includes(sec))) lineas.push(variante(t, "cierre-negocio", T.cierreNegocio(sec)));
    decir(t, lineas.join("\n"));
  }
  if (deriva && conContacto) mostrarContacto(t, autoActual(t));
}

type DatoNegocio = { texto: string | null; tema: string; deriva: boolean };

function datoDeNegocio(tema: Intencion, n: Negocio): DatoNegocio {
  switch (tema) {
    case "financiacion":
      return { texto: n.financiacion, tema: "la financiación", deriva: true };
    case "permuta":
      return { texto: n.permutas, tema: "tomar tu usado", deriva: true };
    case "pagos":
      return { texto: n.pagos, tema: "las formas de pago", deriva: false };
    case "horarios":
      return { texto: n.horarios, tema: "los horarios", deriva: false };
    case "ubicacion":
      // La ciudad si se sabe; la direccion exacta, si falta, la pasa la secretaria.
      return n.direccion
        ? { texto: T.ubicacionConDireccion(n.direccion, n.ciudad), tema: "la dirección", deriva: false }
        : { texto: T.ubicacionSoloCiudad(n.ciudad, n.secretaria), tema: "la dirección", deriva: true };
    case "garantia":
      return { texto: n.garantia, tema: "la garantía", deriva: false };
    default:
      return { texto: n.documentacion, tema: "los papeles", deriva: false };
  }
}

/** ["los horarios", "la garantía"] → "los horarios y la garantía". */
function unirTemas(temas: string[]): string {
  return temas.length <= 1 ? (temas[0] ?? "") : `${temas.slice(0, -1).join(", ")} y ${temas[temas.length - 1]}`;
}

// ---------------------------------------------------------------------------------------------
// Busquedas y listas

/** Busca, muestra hasta 5 y, si no hay nada, ofrece avisar cuando entre (con lo pedido como motivo). */
function mostrarBusqueda(t: Turno, filtros: Filtros, texto: string, encabezadoExacto: string[]): void {
  const { s } = t;
  const { exactos, alternativos } = buscar(t.e.catalogo, filtros);
  s.filtros = filtros;
  s.vistosIds = [];
  const resultados = exactos.length > 0 ? exactos : alternativos;
  if (resultados.length === 0) {
    decir(t, variante(t, "vacia", T.listaVacia));
    ofrecerAviso(t, texto);
    return;
  }
  const encabezado = variante(t, "lista", exactos.length > 0 ? encabezadoExacto : T.listaRelajada);
  mostrarPagina(t, resultados, encabezado);
}

/** "ver mas": los siguientes de la busqueda actual que todavia no vio. */
function verMas(t: Turno): void {
  const { s } = t;
  const { exactos, alternativos } = buscar(t.e.catalogo, s.filtros);
  const faltan = (exactos.length > 0 ? exactos : alternativos).filter((v) => !s.vistosIds.includes(v.id));
  if (faltan.length === 0) {
    decir(t, variante(t, "agotado", T.verMasAgotado(secretaria(t))));
    mostrarContacto(t, null);
    return;
  }
  // Sin busqueda previa no hay "mas": es la primera pagina, y "acá van más" no tendria sentido.
  const encabezado = s.vistosIds.length === 0 ? variante(t, "lista", T.listaExacta) : variante(t, "ver-mas", T.verMasEncabezado);
  mostrarPagina(t, faltan, encabezado);
}

function mostrarPagina(t: Turno, vehiculos: VehiculoCatalogo[], encabezado: string): void {
  const pagina = vehiculos.slice(0, MAX_TARJETAS);
  const quedan = vehiculos.length > pagina.length;
  decir(t, quedan ? `${encabezado}\n${T.hayMas}` : encabezado);
  mostrarLista(t, pagina);
  t.s.vistosIds = [...t.s.vistosIds, ...pagina.map((v) => v.id)];
  // Si quedan mas, un "si" o un 👍 los muestra.
  t.s.ofrecio = quedan ? "mas" : null;
}

// ---------------------------------------------------------------------------------------------
// Regla 9: presentar un auto segun su estado

function presentarVehiculo(t: Turno, v: VehiculoCatalogo, motivo: "precio" | "info" | "general"): void {
  fijarVehiculo(t, v.id);
  if (v.estado === "vendido") return presentarVendido(t, v);
  if (v.estado === "reservado") return presentarReservado(t, v);

  const sec = secretaria(t);
  const precio = precioDe(v);
  // Sin precio cargado (o "Consultá") no se inventa: lo pasa la secretaria por WhatsApp.
  const apertura =
    motivo === "precio"
      ? variante(t, "precio", precio ? T.conPrecio(v, precio) : T.sinPrecio(v, sec))
      : variante(t, "disponible", T.disponible(v));
  const lineas = [apertura, datosVehiculo(v)];
  if (motivo !== "precio") lineas.push(precio ? T.lineaPrecio(precio) : T.lineaSinPrecio(sec));
  lineas.push(variante(t, "cierre", T.cierreDisponible(sec)));
  decir(t, lineas.join("\n"));
  tarjetas(t, [v]);
  t.s.ofrecio = "contacto";
}

/** Un vendido nunca se ofrece: se dice y se muestran disponibles parecidos (o se ofrece avisar). */
function presentarVendido(t: Turno, v: VehiculoCatalogo): void {
  const parecidos = similares(t.e.catalogo, v);
  if (parecidos.length > 0) {
    decir(t, variante(t, "vendido", T.vendidoConParecidos(v)));
    mostrarLista(t, parecidos);
    return;
  }
  decir(t, variante(t, "vendido", T.vendidoSinParecidos(v)));
  ofrecerAviso(t, T.motivoParecido(v));
}

/** Un reservado puede liberarse: se ofrece avisar y, si hay, parecidos disponibles. */
function presentarReservado(t: Turno, v: VehiculoCatalogo): void {
  const parecidos = similares(t.e.catalogo, v);
  const lineas = [variante(t, "reservado", T.reservado(v)), variante(t, "aviso", T.ofrecerAvisoSiSeLibera)];
  if (parecidos.length > 0) lineas.push(variante(t, "parecidos", T.parecidosAbajo));
  decir(t, lineas.join("\n"));
  if (parecidos.length > 0) mostrarLista(t, parecidos);
  ofrecerAviso(t, T.motivoSiSeLibera(v), `${v.nombre} ${v.anio}`);
}
