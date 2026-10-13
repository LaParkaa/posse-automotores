import { nombreDe, telefonoEn } from "./captacion";
import { extraerEntidades } from "./nlu/entidades";
import { detectarIntenciones, type Intencion } from "./nlu/intenciones";
import { tokenizar } from "./nlu/normalizar";
import { duracionDe, edadDe, sinExperiencia } from "./nlu/numeros";
import { CAMPOS_POSTULACION, postulacionNueva, type CampoPostulacion, type Postulacion } from "./sesion";
import * as T from "./textos";
import {
  MAX_FALLOS_PASO,
  decir,
  mostrarContactoReclutador,
  nombreParaSaludo,
  reclutador,
  salirDelPaso,
  variante,
  type Turno,
} from "./turno";

/**
 * Postulacion de vendedor por Instagram: el bot pide los datos de un CV de a uno, en charla natural, y al
 * final arma el mensaje completo para Marcos en un boton de WhatsApp (el candidato solo toca enviar). No se
 * guarda nada aparte: lo que se junta vive en la sesion de la charla. Mismo molde que `captacion.ts`.
 * El CV en archivo no pasa por aca: el candidato lo adjunta al mandar el mensaje a Marcos.
 */

// Una respuesta libre mas larga no aporta y rompe los limites de los mensajes y de los links.
const MAX_RESPUESTA = 300;
// "hola" o "gracias" tienen solo letras pero no son una localidad.
const NO_ES_UNA_LOCALIDAD = new Set<Intencion>(["saludo", "afirmacion", "negacion", "gracias", "despedida", "cortesia"]);
const CANCELAR = new Set(["cancelar", "cancela", "cancelo", "cancelalo", "dejalo", "deja", "dejala", "olvidalo", "olvidate"]);
// Frases completas ya normalizadas. "no" a secas NO esta: es una respuesta valida ("¿experiencia en el rubro?" "no").
const OMITIR = new Set([
  "no se",
  "paso",
  "pasame",
  "despues",
  "luego",
  "saltear",
  "saltealo",
  "prefiero no",
  "prefiero no decirlo",
  "no quiero",
  "ahora no",
  "mas tarde",
  "otro momento",
]);
// Una pregunta sobre un auto concreto es otro tema; una intencion suelta no ("el precio lo negociaba yo").
const PREGUNTAS_DE_AUTO = new Set<Intencion>(["precio", "info", "disponibilidad"]);
// Sueldo, comision, horario de trabajo: solo cuentan como pregunta si se preguntan (con "?" o con una palabra
// interrogativa al comienzo). "vendia a comision" o "mi horario de trabajo actual es..." son respuestas.
const PALABRAS_CONDICIONES = ["sueldo", "sueldos", "comision", "comisiones", "aguinaldo", "blanco"];
const FRASES_CONDICIONES = ["cuanto pagan", "cuanto cobran", "cuanto se gana", "cuanto ganan", "horario de trabajo", "horarios de trabajo", "obra social"];
const INTERROGATIVAS = new Set(["cuanto", "cuanta", "cuantos", "cuantas", "hay", "tienen", "como", "es", "son", "que", "cual", "cuales", "se", "pagan", "cobran", "dan"]);
const PALABRAS_VENTAS = new Set(["venta", "ventas", "vendi", "vendia", "vendo", "vendiendo", "vendedor", "vendedora"]);
// "vivo en Posse y 5 años en ventas": lo personal que va antes del "y" no es parte de la experiencia.
const PERSONAL_ANTES_DE_Y = /^.*\b(?:vivo en|soy de|tengo \S+ a[nñ]os?)\b.*?\s+y\s+/iu;

function postulacionDe(t: Turno): Postulacion {
  t.s.postulacion ??= postulacionNueva();
  return t.s.postulacion;
}

/** Primer dato que falta y que el candidato no salteo; null si ya esta todo. */
const siguienteCampo = (p: Postulacion): CampoPostulacion | null =>
  CAMPOS_POSTULACION.find((campo) => p.datos[campo] === undefined && !p.omitidos.includes(campo)) ?? null;

const hayProgreso = (p: Postulacion) => Object.keys(p.datos).length > 0 || p.omitidos.length > 0;

/** "cv", "busco trabajo": arranca (o retoma) la postulacion. */
export function iniciarPostulacion(t: Turno, texto: string): void {
  const p = postulacionDe(t);
  if (p.enviada) {
    decir(t, variante(t, "postula-ya", T.postulacionYaArmada(reclutador(t))));
    return mostrarContactoReclutador(t, p.datos);
  }

  const retoma = hayProgreso(p);
  t.s.paso = "postulando";
  t.s.ofrecio = null;
  t.s.fallos = 0;
  absorberExtras(p, texto, null);
  decir(
    t,
    retoma
      ? variante(t, "postula-retoma", T.postulacionRetoma)
      : variante(t, "postula-intro", T.postulacionIntro(nombreParaSaludo(t))),
  );
  // Si se cancelo esperando el tiempo de experiencia, se vuelve a preguntar eso y no lo siguiente.
  if (p.pendienteDuracion) {
    p.campo = "experiencia_ventas";
    decir(t, variante(t, "postula-duracion", T.preguntaDuracion));
    return;
  }
  avanzar(t, p);
}

/** Devuelve false si el cliente cambio de tema: el paso se abandona y el mensaje sigue su curso. */
export function pasoPostulacion(t: Turno, texto: string): boolean {
  const p = postulacionDe(t);
  const campo = p.campo ?? siguienteCampo(p);
  if (campo === null) {
    // Sesion rara (paso sin pregunta pendiente): no hay nada que seguir.
    salirDelPaso(t.s);
    return false;
  }

  const tokens = tokenizar(texto);
  const normalizado = tokens.join(" ");

  // "cancelar" deja el paso pero conserva lo respondido: un nuevo "cv" retoma donde quedo.
  if (tokens.length <= 3 && CANCELAR.has(tokens[0] ?? "")) {
    p.campo = campo;
    salirDelPaso(t.s);
    decir(t, variante(t, "postula-cancelada", T.postulacionCancelada));
    return true;
  }

  // Una pregunta por un auto concreto ("cuanto sale el vento?") es otro tema: se responde aparte y la
  // postulacion queda guardada. Una intencion suelta no alcanza: "tengo experiencia en financiaciones" o
  // "el precio lo negociaba yo" son respuestas de la postulacion.
  const ent = extraerEntidades(texto, t.e.catalogo);
  if (ent.vehiculoIds.length > 0 && detectarIntenciones(texto).some((i) => PREGUNTAS_DE_AUTO.has(i))) {
    p.campo = campo;
    salirDelPaso(t.s);
    return false;
  }

  if (esPreguntaDeCondiciones(texto, tokens)) {
    decir(t, variante(t, "postula-condiciones", T.postulacionCondiciones(reclutador(t))));
    repetirPregunta(t, p, campo);
    return true;
  }

  if (OMITIR.has(normalizado) || normalizado.startsWith("prefiero no")) {
    // Sin nombre no hay postulacion: saltearlo cuenta como una respuesta que no sirve.
    if (campo === "nombre") return falloEn(t, p, campo);
    // Si solo faltaba el tiempo, la experiencia queda como se conto; si no, el dato se da por salteado.
    if (p.pendienteDuracion) p.pendienteDuracion = false;
    else p.omitidos.push(campo);
    avanzar(t, p);
    return true;
  }

  if (p.pendienteDuracion) return responderDuracion(t, p, texto);

  // Lo que el candidato dice de paso (un telefono, "vivo en X") se aprovecha aunque conteste otra cosa.
  absorberExtras(p, texto, campo);
  const valor = respuestaA(campo, texto);
  if (valor === null) return falloEn(t, p, campo);
  guardar(p, campo, valor);

  // Marcos necesita saber cuanto tiempo vendio: si no lo dijo (y no es que no tiene experiencia), se pregunta una vez.
  if (campo === "experiencia_ventas" && typeof valor === "string" && duracionDe(valor) === null && !sinExperiencia(valor)) {
    p.pendienteDuracion = true;
    t.s.fallos = 0;
    decir(t, variante(t, "postula-duracion", T.preguntaDuracion));
    return true;
  }
  avanzar(t, p);
  return true;
}

/** Pregunta el proximo dato, o cierra la postulacion si ya no falta ninguno. */
function avanzar(t: Turno, p: Postulacion): void {
  const campo = siguienteCampo(p);
  p.campo = campo;
  t.s.fallos = 0;
  if (campo === null) return cerrar(t, p);
  decir(t, variante(t, `postula-${campo}`, T.preguntaPostulacion[campo]));
}

function repetirPregunta(t: Turno, p: Postulacion, campo: CampoPostulacion): void {
  const variantes = p.pendienteDuracion ? T.preguntaDuracion : T.preguntaPostulacion[campo];
  decir(t, variante(t, p.pendienteDuracion ? "postula-duracion" : `postula-${campo}`, variantes));
}

/** El tiempo se suma a lo que conto: "trabajé en una agencia · 2 años". Si no dice un tiempo, se agrega lo que haya dicho. */
function responderDuracion(t: Turno, p: Postulacion, texto: string): boolean {
  const duracion = duracionDe(texto) ?? respuestaLibre(texto)?.slice(0, 60) ?? null;
  if (duracion !== null) {
    const base = (p.datos.experiencia_ventas ?? "").slice(0, MAX_RESPUESTA - duracion.length - 3);
    p.datos.experiencia_ventas = `${base} · ${duracion}`;
  }
  p.pendienteDuracion = false;
  avanzar(t, p);
  return true;
}

/** Una respuesta que no sirve se repregunta una vez; a la segunda el nombre deriva a Marcos y el resto se saltea. */
function falloEn(t: Turno, p: Postulacion, campo: CampoPostulacion): boolean {
  t.s.fallos += 1;
  if (t.s.fallos < MAX_FALLOS_PASO) {
    const variantes = T.repreguntaPostulacion[campo] ?? T.preguntaPostulacion[campo];
    decir(t, variante(t, `postula-re-${campo}`, variantes));
    return true;
  }
  // Sin nombre no hay mensaje que armar: se lo manda directo a Marcos.
  if (campo === "nombre") {
    sinNombre(t, p);
    return true;
  }
  p.omitidos.push(campo);
  avanzar(t, p);
  return true;
}

/** Sin nombre no se arma el mensaje: el candidato le escribe directo a Marcos. Lo ya respondido queda en la sesion. */
function sinNombre(t: Turno, p: Postulacion): void {
  p.campo = null;
  salirDelPaso(t.s);
  decir(t, variante(t, "postula-sin-nombre", T.postulacionSinNombre(reclutador(t))));
  mostrarContactoReclutador(t, p.datos);
}

/** Termina las preguntas: deja armado el mensaje para Marcos en el boton de WhatsApp. */
function cerrar(t: Turno, p: Postulacion): void {
  const { datos } = p;
  if (!datos.nombre) return sinNombre(t, p);

  p.campo = null;
  p.pendienteDuracion = false;
  p.enviada = true;
  salirDelPaso(t.s);

  const primerNombre = datos.nombre.split(/\s+/)[0] ?? datos.nombre;
  decir(t, variante(t, "postula-listo", T.postulacionListo(primerNombre, reclutador(t))));
  mostrarContactoReclutador(t, datos);
}

// ---------------------------------------------------------------------------------------------
// Lectura de las respuestas

function guardar(p: Postulacion, campo: CampoPostulacion, valor: string | number): void {
  // `respuestaA` ya garantiza el tipo de cada campo (la edad es un numero, el resto texto).
  (p.datos as Record<string, string | number>)[campo] = valor;
}

/** La respuesta a la pregunta pendiente, ya validada; null si no sirve. */
function respuestaA(campo: CampoPostulacion, texto: string): string | number | null {
  switch (campo) {
    case "nombre":
      return nombreEn(texto);
    case "edad":
      return edadDe(texto, true);
    case "localidad":
      return localidadDe(texto, true);
    case "telefono":
      return telefonoEn(texto)?.numero ?? null;
    default:
      return respuestaLibre(texto);
  }
}

/** "Juan Pérez", "soy Juan Pérez 3537123456", "Juan Pérez, 28 años": el nombre, sin el telefono ni lo que sigue a una coma. */
function nombreEn(texto: string): string | null {
  const sinTelefono = telefonoEn(texto)?.resto ?? texto;
  return nombreDe(sinTelefono) ?? nombreDe(sinTelefono.split(/[,;]|\s+y\s+/)[0] ?? "");
}

/** Telefono, edad ("tengo 28 años"), localidad ("vivo en X") y ventas ("5 años en ventas") dichos de paso, para no volver a preguntarlos. */
function absorberExtras(p: Postulacion, texto: string, pendiente: CampoPostulacion | null): void {
  const abierto = (campo: CampoPostulacion) => campo !== pendiente && p.datos[campo] === undefined;
  if (abierto("telefono")) {
    const telefono = telefonoEn(texto);
    if (telefono) p.datos.telefono = telefono.numero;
  }
  if (abierto("edad")) {
    const edad = edadDe(texto, false);
    if (edad !== null) p.datos.edad = edad;
  }
  if (abierto("localidad")) {
    const localidad = localidadDe(texto, false);
    if (localidad !== null) p.datos.localidad = localidad;
  }
  if (abierto("experiencia_ventas")) {
    const ventas = clausulaDeVentas(texto);
    if (ventas !== null) p.datos.experiencia_ventas = ventas;
  }
}

/** La parte del mensaje que cuenta experiencia en ventas con su tiempo ("5 años en ventas"); null si no hay. */
function clausulaDeVentas(texto: string): string | null {
  for (const clausula of texto.split(/[,;.]/)) {
    if (duracionDe(clausula) === null || !tokenizar(clausula).some((token) => PALABRAS_VENTAS.has(token))) continue;
    return respuestaLibre(clausula.replace(PERSONAL_ANTES_DE_Y, ""));
  }
  return null;
}

/** Con `directa` (se pregunto la localidad) vale casi cualquier nombre de lugar; sin ella solo "vivo en X" / "soy de X". */
function localidadDe(texto: string, directa: boolean): string | null {
  if (!directa) {
    const encontrada = /\b(?:vivo en|soy de|vivo por)\s+(\p{L}[\p{L} '’-]{1,40}?)(?=[,;.!?]|\s+y\s|\s+tengo\b|$)/iu.exec(texto);
    return encontrada ? encontrada[1].trim() : null;
  }
  const limpia = texto
    .trim()
    .replace(/^(?:vivo en|soy de|vivo por|de|en)\s+/i, "")
    .replace(/[\s.!¡,;]+$/u, "");
  if (!/^\p{L}[\p{L} .'’,-]{1,58}$/u.test(limpia)) return null;
  return detectarIntenciones(limpia).some((i) => NO_ES_UNA_LOCALIDAD.has(i)) ? null : limpia;
}

/** Experiencia, financiaciones y disponibilidad: texto libre, recortado. */
function respuestaLibre(texto: string): string | null {
  const limpia = texto.replace(/\s+/g, " ").trim().slice(0, MAX_RESPUESTA);
  return limpia === "" ? null : limpia;
}

function esPreguntaDeCondiciones(texto: string, tokens: string[]): boolean {
  const dicho = ` ${tokens.join(" ")} `;
  const toca =
    FRASES_CONDICIONES.some((frase) => dicho.includes(` ${frase} `)) ||
    PALABRAS_CONDICIONES.some((palabra) => tokens.includes(palabra));
  return toca && (texto.includes("?") || INTERROGATIVAS.has(tokens[0] ?? ""));
}
