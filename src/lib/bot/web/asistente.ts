import { conversar, type ResultadoMotor } from "../motor";
import type { Negocio } from "../negocio";
import { detectarIntenciones, type Intencion } from "../nlu/intenciones";
import { descripcionDelUsado, extraerUsado } from "../nlu/usado";
import { tarjetaDe } from "../respuestas";
import { normalizarSesion, sesionNueva, sesionVigente, type Sesion } from "../sesion";
import * as T from "../textos";
import { MAX_MENSAJES, salirDelPaso } from "../turno";
import type { LeadInput, MensajeSalida, VehiculoCatalogo } from "../types";
import { avanzarGuion, guionNuevo, preguntaPendiente, sugerenciasPendientes, type ContextoGuion } from "./guiones";
import { sugerenciasPara } from "./sugerencias";
import { tarjetasAWeb } from "./tarjetas";
import type { EntradaChat, Guion, MensajeWeb, OpcionId, Pagina, RespuestaChat, TarjetaWeb } from "./tipos";

/**
 * Asistente de la página: decide qué contestar en el chat web juntando el motor del bot (texto libre) y los guiones
 * por opciones. Puro: sin red, sin base de datos y sin reloj (la hora entra por `deps.ahora`, la variedad del texto
 * por `mid`), así que la misma entrada da siempre la misma salida.
 *
 * Orden de decisión (spec 4.2 y decisiones 8 a 10):
 *  1. Normalizar el estado y aplicar la página: el auto de la ficha pasa a ser el auto actual; si cambió de ficha en
 *     medio de la charla, se avisa ("Ahora estás mirando…") con la tarjeta del auto nuevo.
 *  2. `inicio`: saludo, tarjeta del auto (en la ficha) y chips.
 *  3. `opcion`: el guion (`avanzarGuion`), más "seguir", "buscar" y "Sí, quiero" ante una oferta de aviso del motor.
 *  4. Texto con una pregunta del guion pendiente: si es una pregunta suelta que el motor reconoce, se contesta y se
 *     vuelve a hacer la pregunta pendiente; si no, el texto es la respuesta del paso.
 *  5. Texto sin guion: el motor. Si habla de financiar, arranca el guion de financiación con el usado que haya nombrado.
 *  6. Chips (`sugerenciasPara`). Nunca más de 3 mensajes.
 */

/**
 * Estado que se guarda entre mensajes. `ficha` es el slug de la ficha desde la que escribió la última vez (null en el
 * catálogo): con eso un "bmw" preguntado desde la ficha del 206 no se pisa con el 206 en el mensaje siguiente. Si no
 * viene (estado viejo), se compara contra el auto actual.
 */
export type EstadoWeb = { sesion: Sesion; guion: Guion; ficha?: string | null };
export type DepsAsistente = { negocio: Negocio; siteUrl: string; ahora: () => Date };
export type SalidaAsistente = { respuesta: RespuestaChat; estado: EstadoWeb; lead: LeadInput | null; noEntendido: boolean };

const MAX_RESPUESTA_GUION = 200;

// ---------------------------------------------------------------------------------------------
// Saneado y normalización (lo que se guarda tiene que entrar en Postgres: sin \u0000 ni surrogates sueltos)

const SURROGATE_SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const ESPACIOS_DE_CONTROL = /[\t\n\v\f\r]+/g;
const CONTROLES = /\p{Cc}/gu;

/** Saca surrogates sueltos y caracteres de control (los saltos y tabs pasan a un espacio). Emojis y tildes quedan. */
export function sanearTexto(texto: string): string {
  return texto.replace(SURROGATE_SUELTO, "").replace(ESPACIOS_DE_CONTROL, " ").replace(CONTROLES, "");
}

const FLUJOS: NonNullable<Guion["flujo"]>[] = ["financiar", "usado", "disponible"];
const PASOS: NonNullable<Guion["paso"]>[] = ["anticipo", "cuotas", "usado", "confirmar"];
const CAMPOS_GUION = ["anticipo", "cuotas", "usado"] as const;

/** Lee el guion guardado (jsonb) sin confiar en su forma: lo inválido se descarta y los textos se sanean. */
export function normalizarGuion(crudo: unknown): Guion {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return guionNuevo();
  const c = crudo as Record<string, unknown>;
  const flujo = FLUJOS.find((f) => f === c.flujo) ?? null;
  const paso = PASOS.find((p) => p === c.paso) ?? null;
  if (flujo === null || paso === null) return guionNuevo();
  const d = typeof c.datos === "object" && c.datos !== null && !Array.isArray(c.datos) ? (c.datos as Record<string, unknown>) : {};
  const datos: Guion["datos"] = {};
  for (const campo of CAMPOS_GUION) {
    const v = d[campo];
    if (typeof v !== "string") continue;
    const limpio = Array.from(sanearTexto(v).trim()).slice(0, MAX_RESPUESTA_GUION).join("").trim();
    if (limpio) datos[campo] = limpio;
  }
  return { flujo, paso, datos };
}

export function normalizarEstado(crudo: unknown, ahora: Date): EstadoWeb | null {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return null;
  const c = crudo as Record<string, unknown>;
  const sesion = normalizarSesion(c.sesion, ahora);
  // Pasadas 24 h es una charla nueva (como en el motor): no se arrastra ni el guion ni la ficha.
  if (!sesionVigente(sesion, ahora)) return null;
  const ficha = typeof c.ficha === "string" ? c.ficha : c.ficha === null ? null : undefined;
  return { sesion, guion: normalizarGuion(c.guion), ...(ficha !== undefined ? { ficha } : {}) };
}

// ---------------------------------------------------------------------------------------------
// Utilidades

type Cuerpo = {
  mensajes: MensajeWeb[];
  sugerencias: OpcionId[];
  sesion: Sesion;
  guion: Guion;
  lead: LeadInput | null;
  noEntendido: boolean;
};

type Ctx = {
  entrada: EntradaChat & { mid: string };
  catalogo: VehiculoCatalogo[];
  deps: DepsAsistente;
  ahora: Date;
  pagina: Pagina;
};

const texto = (t: string): MensajeWeb => ({ tipo: "texto", texto: t });
const SIN_RESPUESTA = "¿En qué te puedo ayudar? Podés tocar una opción o escribirme.";

const autoDe = (c: Ctx, id: string | null): VehiculoCatalogo | null => (id ? (c.catalogo.find((v) => v.id === id) ?? null) : null);

/** "el Peugeot 206 1.6 2011" / "la Honda XR 150 2022". */
const elAuto = (v: VehiculoCatalogo) => `${v.tipo === "Moto" ? "la" : "el"} ${v.nombre} ${v.anio}`;
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function conAuto(s: Sesion, id: string): Sesion {
  return s.vehiculoActualId === id ? s : { ...s, vehiculoActualId: id, historiaActualId: null };
}

function tarjetaWebDe(v: VehiculoCatalogo, c: Ctx): TarjetaWeb {
  const [t] = tarjetasAWeb([tarjetaDe(v, { negocio: c.deps.negocio, siteUrl: c.deps.siteUrl, canal: "web" })], c.catalogo);
  // El auto se conoce: el slug y el estado no dependen de que el sitio sea https (sin https no va "Ver en la web").
  return { ...t, slug: v.slug, estado: v.estado };
}

function aWeb(m: MensajeSalida, c: Ctx): MensajeWeb {
  return m.tipo === "texto" ? texto(m.texto) : { tipo: "tarjetas", tarjetas: tarjetasAWeb(m.tarjetas, c.catalogo) };
}

function motor(t: string, sesion: Sesion, c: Ctx): ResultadoMotor {
  return conversar({
    texto: t,
    adjuntos: [],
    historiaId: null,
    vehiculoDeHistoria: null,
    mid: c.entrada.mid,
    sesion,
    catalogo: c.catalogo,
    perfil: null,
    ahora: c.ahora,
    siteUrl: c.deps.siteUrl,
    negocio: c.deps.negocio,
    canal: "web",
  });
}

function ctxGuion(g: Guion, vehiculo: VehiculoCatalogo | null, c: Ctx): ContextoGuion {
  const usado = g.flujo === "financiar" ? g.datos.usado : undefined;
  return {
    vehiculo,
    negocio: c.deps.negocio,
    siteUrl: c.deps.siteUrl,
    ...(usado ? { extra: `Tengo para entregar: ${usado}.` } : {}),
  };
}

/** "tengo un bmw 2016 para entregar" → "Bmw 2016"; null si no nombra un auto propio. */
function usadoEn(t: string, c: Ctx): string | null {
  const marcas = [...new Set(c.catalogo.map((v) => v.marca.trim()))];
  const u = extraerUsado(t, marcas);
  return u ? descripcionDelUsado(u) : null;
}

/** Chips fuera de un guion: un auto que ya no está se ofrece buscar otro; si no, los de la página. */
function chipsBase(c: Ctx, s: Sesion): OpcionId[] {
  if (s.paso !== "libre") return []; // se le pidió nombre o teléfono: el campo de texto queda a la espera
  const v = autoDe(c, s.vehiculoActualId);
  if (s.ofrecio !== "aviso" && v && v.estado !== "disponible") return ["buscar", "marcos"];
  return sugerenciasPara({ pagina: c.pagina, tieneAuto: v !== null, ofrecio: s.ofrecio });
}

// Opciones de los guiones de financiar y usado (también chips viejos de esos pasos): no van con un auto que no está.
const OPCIONES_DE_COMPRA = new Set<OpcionId>([
  "financiar", "ver_financiacion", "usado", "anticipo_sin", "anticipo_hasta_3", "anticipo_mas_3", "anticipo_solo_usado",
  "cuotas_12", "cuotas_24", "cuotas_36", "cuotas_48",
]);

/** El auto actual si ya se vendió o está reservado (no se arma un pedido de financiación ni de permuta por él). */
function autoNoDisponible(c: Ctx, s: Sesion): VehiculoCatalogo | null {
  const v = autoDe(c, s.vehiculoActualId);
  return v && v.estado !== "disponible" ? v : null;
}

/** Igual que el guion "disponible" con un vendido o reservado: lo dice, ofrece buscar otro y deja el guion. */
function yaNoEsta(v: VehiculoCatalogo, s: Sesion): Cuerpo {
  const frase =
    v.estado === "vendido"
      ? `${mayuscula(elAuto(v))} ya se vendió. Si querés, te muestro otros parecidos.`
      : `${mayuscula(elAuto(v))} figura como reservado por ahora. Si querés, te muestro otros parecidos.`;
  return { mensajes: [texto(frase)], sugerencias: ["buscar", "marcos"], sesion: s, guion: guionNuevo(), lead: null, noEntendido: false };
}

const sinPaso = (s: Sesion): Sesion => {
  if (s.paso === "libre") return s;
  const copia = structuredClone(s);
  salirDelPaso(copia);
  return copia;
};

// En la web la captación nombra a quien va a avisar (decisión 8 de la spec): el texto del motor no lo dice.
function pedirNombreWeb(mensajes: MensajeWeb[], negocio: Negocio): MensajeWeb[] {
  const web = `¡Dale! ¿Me pasás tu nombre así ${negocio.secretaria} te avisa?`;
  return mensajes.map((m) => {
    if (m.tipo !== "texto") return m;
    const variante = T.pedirNombre.find((v) => m.texto.endsWith(v));
    return variante ? texto(m.texto.slice(0, m.texto.length - variante.length) + web) : m;
  });
}

// ---------------------------------------------------------------------------------------------
// 1. Contexto de la página

function avisoDeFicha(v: VehiculoCatalogo, c: Ctx): MensajeWeb[] {
  if (v.estado === "vendido") return [texto(`Ahora estás mirando ${elAuto(v)}, que ya se vendió.`)];
  const reservado = v.estado === "reservado" ? " Figura como reservado por ahora." : "";
  return [texto(`Ahora estás mirando ${elAuto(v)}.${reservado}`), { tipo: "tarjetas", tarjetas: [tarjetaWebDe(v, c)] }];
}

/** Antepone el aviso de cambio de ficha sin pasar de 3 mensajes (si no entra, el aviso va pegado al primer texto). */
function juntar(aviso: MensajeWeb[], cuerpo: MensajeWeb[]): MensajeWeb[] {
  if (aviso.length + cuerpo.length <= MAX_MENSAJES) return [...aviso, ...cuerpo];
  const [avisoTexto] = aviso;
  const primero = cuerpo[0];
  if (avisoTexto?.tipo === "texto" && primero?.tipo === "texto") {
    return [texto(`${avisoTexto.texto}\n${primero.texto}`), ...cuerpo.slice(1)].slice(0, MAX_MENSAJES);
  }
  return [avisoTexto, ...cuerpo.slice(-(MAX_MENSAJES - 1))];
}

// ---------------------------------------------------------------------------------------------
// 2. Inicio

function inicio(c: Ctx, sesion: Sesion, autoFicha: VehiculoCatalogo | null): Cuerpo {
  const s: Sesion = { ...sinPaso(sesion), ofrecio: null, saludado: true };
  const hola = `Hola, soy el asistente de ${c.deps.negocio.nombre}.`;
  const base = { sesion: s, guion: guionNuevo(), lead: null, noEntendido: false };
  if (!autoFicha) {
    return { ...base, mensajes: [texto(`${hola} ¿Buscás algo en particular? Te ayudo a encontrarlo.`)], sugerencias: chipsBase(c, s) };
  }
  if (autoFicha.estado === "vendido") {
    return {
      ...base,
      mensajes: [texto(`${hola} ${mayuscula(elAuto(autoFicha))} ya se vendió, pero te ayudo a encontrar algo parecido. ¿Qué estás buscando?`)],
      sugerencias: ["buscar", "marcos"],
    };
  }
  const saludo =
    autoFicha.estado === "reservado"
      ? `${hola} Veo que estás mirando ${elAuto(autoFicha)}: figura como reservado por ahora. Si querés, buscamos otro parecido o le escribís a ${c.deps.negocio.secretaria}.`
      : `${hola} Veo que estás mirando ${autoFicha.tipo === "Moto" ? "esta moto" : "este auto"}. ¿Qué querés saber?`;
  return {
    ...base,
    mensajes: [texto(saludo), { tipo: "tarjetas", tarjetas: [tarjetaWebDe(autoFicha, c)] }],
    sugerencias: chipsBase(c, s),
  };
}

// ---------------------------------------------------------------------------------------------
// 3. Opciones

function opcion(c: Ctx, op: OpcionId, sesion: Sesion, guion: Guion): Cuerpo {
  // "Sí, quiero" ante "¿querés que te avise cuando entre?" del motor: es un "sí" para el motor, no un cierre.
  if (op === "confirmar_si" && guion.paso !== "confirmar" && sesion.ofrecio === "aviso") return libre(c, "sí", sesion);

  // Tocar un chip deja atrás lo que el motor estaba preguntando (nombre, teléfono) y lo que había ofrecido.
  const s: Sesion = { ...sinPaso(sesion), ofrecio: null };
  const base = { sesion: s, lead: null, noEntendido: false };
  if (op === "seguir") {
    return { ...base, guion: guionNuevo(), mensajes: [texto("Dale, ¿qué más querés saber?")], sugerencias: chipsBase(c, s) };
  }
  if (op === "buscar") {
    return {
      ...base,
      guion: guionNuevo(),
      mensajes: [texto("Contame qué buscás: marca, tipo o combustible, y te muestro lo que tenemos.")],
      sugerencias: [],
    };
  }
  const noEsta = OPCIONES_DE_COMPRA.has(op) ? autoNoDisponible(c, s) : null;
  if (noEsta) return yaNoEsta(noEsta, s);
  const r = avanzarGuion(guion, { opcion: op }, ctxGuion(guion, autoDe(c, s.vehiculoActualId), c));
  if (r.mensajes.length === 0) {
    return { ...base, guion: guionNuevo(), mensajes: [texto(SIN_RESPUESTA)], sugerencias: chipsBase(c, s) };
  }
  return { ...base, guion: r.guion, mensajes: r.mensajes, sugerencias: r.sugerencias };
}

// ---------------------------------------------------------------------------------------------
// 4. Texto con una pregunta del guion pendiente

// Preguntas que el motor contesta aunque haya un paso del guion esperando respuesta (decisión 9).
const TEMAS_SUELTOS = new Set<Intencion>([
  "empleo", "humano", "identidad", "avisame", "precio", "financiacion", "permuta", "pagos", "horarios", "ubicacion",
  "garantia", "documentacion", "disponibilidad", "info", "ver_mas", "catalogo",
]);

/** "en 24 cuotas" en el guion de financiar o "tengo un gol para entregar" en el del usado son la respuesta del paso. */
function esTemaSuelto(i: Intencion, g: Guion): boolean {
  if (!TEMAS_SUELTOS.has(i)) return false;
  if (g.flujo === "financiar" && i === "financiacion") return false;
  if (g.flujo === "usado" && i === "permuta") return false;
  return true;
}

function enGuion(c: Ctx, t: string, sesion: Sesion, guion: Guion): Cuerpo {
  const intenciones = detectarIntenciones(t);
  if (intenciones.some((i) => esTemaSuelto(i, guion))) {
    const r = motor(t, sesion, c);
    if (r.responder && !r.noEntendido && r.mensajes.length > 0) {
      // El motor empezó a pedir nombre y teléfono: esa charla manda y el guion se deja.
      if (r.sesion.paso !== "libre") return deMotor(c, r, sesion, guionNuevo());
      let g = guion;
      const usado = g.flujo === "financiar" ? usadoEn(t, c) : null;
      if (usado) g = { ...g, datos: { ...g.datos, usado } };
      const ctx = ctxGuion(g, autoDe(c, r.sesion.vehiculoActualId), c);
      const pregunta = preguntaPendiente(g, ctx);
      const delMotor = r.mensajes.map((m) => aWeb(m, c));
      return {
        mensajes: pregunta ? [...delMotor.slice(0, MAX_MENSAJES - 1), pregunta] : delMotor,
        sugerencias: pregunta ? sugerenciasPendientes(g, ctx) : chipsBase(c, r.sesion),
        sesion: r.sesion,
        guion: g,
        lead: r.lead,
        noEntendido: false,
      };
    }
  }

  const ctx = ctxGuion(guion, autoDe(c, sesion.vehiculoActualId), c);
  if (guion.paso === "confirmar") {
    // "¿Se lo pedimos?": un "sí" escrito vale como el chip; cualquier otra cosa es un tema nuevo.
    if (intenciones.includes("afirmacion")) {
      const r = avanzarGuion(guion, { opcion: "confirmar_si" }, ctx);
      return { mensajes: r.mensajes, sugerencias: r.sugerencias, sesion, guion: r.guion, lead: null, noEntendido: false };
    }
    return libre(c, t, sesion);
  }
  const r = avanzarGuion(guion, { texto: t }, ctx);
  if (r.mensajes.length === 0) return libre(c, t, sesion);
  // La respuesta del paso no pasa por el motor: su sesión (contador de "no entendí") queda como estaba.
  return { mensajes: r.mensajes, sugerencias: r.sugerencias, sesion, guion: r.guion, lead: null, noEntendido: false };
}

// ---------------------------------------------------------------------------------------------
// 5. Texto libre

const NO_ARRANCAN_GUION = new Set<Intencion>(["empleo", "humano", "identidad", "avisame"]);

/** Respuesta del motor tal cual, en formato web. */
function deMotor(c: Ctx, r: ResultadoMotor, antes: Sesion, guion: Guion): Cuerpo {
  let mensajes = r.mensajes.map((m) => aWeb(m, c));
  if (r.sesion.paso === "pidiendo_nombre" && antes.paso !== "pidiendo_nombre") mensajes = pedirNombreWeb(mensajes, c.deps.negocio);
  let sesion = r.sesion;
  // Un único auto en pantalla (por ejemplo "bmw" con un solo BMW) pasa a ser el auto del que se habla, salvo que el
  // motor ya haya elegido otro (un vendido con su parecido, por ejemplo).
  if (sesion.vehiculoActualId === antes.vehiculoActualId) {
    const slugs = [...new Set(mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas.map((t) => t.slug) : [])))];
    const unico = slugs.length === 1 && slugs[0] ? c.catalogo.find((v) => v.slug === slugs[0]) : undefined;
    if (unico) sesion = conAuto(sesion, unico.id);
  }
  return {
    mensajes: mensajes.length > 0 ? mensajes : [texto(SIN_RESPUESTA)],
    sugerencias: chipsBase(c, sesion),
    sesion,
    guion,
    lead: r.lead,
    noEntendido: r.noEntendido,
  };
}

function libre(c: Ctx, t: string, sesion: Sesion): Cuerpo {
  const r = motor(t, sesion, c);
  const cuerpo = deMotor(c, r, sesion, guionNuevo());
  const intenciones = detectarIntenciones(t);
  const hablaDeFinanciar =
    intenciones.includes("financiacion") && !intenciones.some((i) => NO_ARRANCAN_GUION.has(i));
  if (!hablaDeFinanciar || r.noEntendido || cuerpo.sesion.paso !== "libre") return cuerpo;
  // "quiero financiarlo" sobre un vendido o reservado: no se arranca el guion (ni se ofrece simular ese auto).
  const noEsta = autoNoDisponible(c, cuerpo.sesion);
  if (noEsta) return yaNoEsta(noEsta, cuerpo.sesion);

  // "quiero financiarlo, tengo un bmw 2016 para entregar": la respuesta del motor y, abajo, la primera pregunta del
  // guion. El usado queda guardado para sumarlo al mensaje para Marcos.
  const usado = usadoEn(t, c);
  const g0 = usado ? { ...guionNuevo(), flujo: "financiar" as const, datos: { usado } } : guionNuevo();
  const a = avanzarGuion(g0, { opcion: "financiar" }, ctxGuion(g0, autoDe(c, cuerpo.sesion.vehiculoActualId), c));
  const guion: Guion = usado ? { ...a.guion, datos: { ...a.guion.datos, usado } } : a.guion;
  return {
    ...cuerpo,
    mensajes: [...cuerpo.mensajes.slice(0, MAX_MENSAJES - a.mensajes.length), ...a.mensajes],
    sugerencias: a.sugerencias,
    guion,
  };
}

// ---------------------------------------------------------------------------------------------

export function responderWeb(
  entrada: EntradaChat & { mid: string },
  estado: EstadoWeb | null,
  catalogo: VehiculoCatalogo[],
  deps: DepsAsistente,
): SalidaAsistente {
  const ahora = deps.ahora();
  const previo = normalizarEstado(estado, ahora);
  let sesion = previo?.sesion ?? sesionNueva(ahora);
  let guion = previo?.guion ?? guionNuevo();

  // 1. Página: un slug que no está en el catálogo se trata como el catálogo.
  const autoFicha = entrada.pagina === "ficha" && entrada.slug ? (catalogo.find((v) => v.slug === entrada.slug) ?? null) : null;
  const c: Ctx = { entrada, catalogo, deps, ahora, pagina: autoFicha ? "ficha" : "catalogo" };
  let aviso: MensajeWeb[] = [];
  if (autoFicha) {
    const cambioDeFicha =
      previo === null || (previo.ficha !== undefined ? previo.ficha !== autoFicha.slug : sesion.vehiculoActualId !== autoFicha.id);
    if (entrada.inicio) {
      sesion = conAuto(sesion, autoFicha.id);
    } else if (cambioDeFicha && sesion.vehiculoActualId !== autoFicha.id) {
      if (previo !== null) aviso = avisoDeFicha(autoFicha, c);
      sesion = conAuto(sesion, autoFicha.id);
    }
  }

  let cuerpo: Cuerpo;
  if (entrada.inicio) {
    cuerpo = inicio(c, sesion, autoFicha);
  } else if (entrada.opcion) {
    cuerpo = opcion(c, entrada.opcion, sesion, guion);
  } else {
    const t = sanearTexto(entrada.texto ?? "").trim();
    // Un guion de financiar o usado sobre un auto que ya no está (cambió de ficha a un vendido) no sigue: el texto va
    // al motor como charla libre (y "financiar" ahí tampoco arranca el guion para ese auto).
    const cortado = (guion.flujo === "financiar" || guion.flujo === "usado") && autoNoDisponible(c, sesion) !== null;
    if (cortado) guion = guionNuevo();
    const pendiente = preguntaPendiente(guion, ctxGuion(guion, autoDe(c, sesion.vehiculoActualId), c));
    if (t === "") {
      // Nada para leer: se repite lo que se estaba preguntando, o se invita a escribir.
      const ctx = ctxGuion(guion, autoDe(c, sesion.vehiculoActualId), c);
      cuerpo = pendiente
        ? { mensajes: [pendiente], sugerencias: sugerenciasPendientes(guion, ctx), sesion, guion, lead: null, noEntendido: false }
        : { mensajes: [texto(SIN_RESPUESTA)], sugerencias: chipsBase(c, sesion), sesion, guion, lead: null, noEntendido: false };
    } else {
      cuerpo = pendiente ? enGuion(c, t, sesion, guion) : libre(c, t, sesion);
    }
  }

  return {
    respuesta: { mensajes: juntar(aviso, cuerpo.mensajes).slice(0, MAX_MENSAJES), sugerencias: cuerpo.sugerencias },
    estado: { sesion: { ...cuerpo.sesion, ultimaActividad: ahora.toISOString() }, guion: cuerpo.guion, ficha: autoFicha?.slug ?? null },
    lead: cuerpo.lead,
    noEntendido: cuerpo.noEntendido,
  };
}
