/**
 * Estado del chat del lado del navegador. Puro: sin React ni DOM; el storage entra por parámetro.
 * Solo importa tipos del servidor (y la guarda `esOpcionId`, una función diminuta y pura).
 */
import { esOpcionId } from "@/lib/bot/web/tipos";
import type { MensajeWeb, OpcionId, RespuestaChat, TarjetaWeb } from "@/lib/bot/web/tipos";

export type Burbuja = {
  id: string;
  de: "cliente" | "asistente";
  mensaje: MensajeWeb | { tipo: "texto"; texto: string };
};

export type EstadoChat = {
  abierto: boolean;
  burbujas: Burbuja[];
  sugerencias: OpcionId[];
  pendiente: boolean;
  saludado: boolean;
};

export type AccionChat =
  | { tipo: "abrir" }
  | { tipo: "cerrar" }
  | { tipo: "enviar"; texto: string }
  /** Pide el saludo (`inicio`): queda pendiente sin burbuja del cliente. */
  | { tipo: "iniciar" }
  /** Cualquier respuesta buena cuenta como saludo: no se saluda en el medio de una charla. */
  | { tipo: "recibir"; respuesta: RespuestaChat }
  | { tipo: "fallo"; negocio: { whatsappUrl: string } }
  /** Lo leído de sessionStorage al montar; no pisa una charla que ya empezó. */
  | { tipo: "restaurar"; guardado: EstadoChat };

export const CLAVE_CHAT = "posse_chat";
export const CLAVE_GLOBO = "posse_chat_globo";

const MAX_BURBUJAS = 100;
const MAX_BYTES = 100_000;

export const estadoInicial: EstadoChat = {
  abierto: false,
  burbujas: [],
  sugerencias: [],
  pendiente: false,
  saludado: false,
};

const TEXTO_FALLO = "Uy, ahora no te pude responder. Escribile directo a Marcos por WhatsApp y te contesta él.";
const TEXTO_CIERRE_FALLO = "Hablar con Marcos por WhatsApp";

/** El cierre muestra el mensaje que va a llegar a Marcos: el `text` del link (o una línea genérica si no trae). */
function textoDelLink(url: string): string {
  try {
    return new URL(url).searchParams.get("text")?.trim() || TEXTO_CIERRE_FALLO;
  } catch {
    return TEXTO_CIERRE_FALLO;
  }
}

/** Ids correlativos `b<n>`: el siguiente es el mayor número en uso más uno (no choca tras recortar o restaurar). */
function siguienteNumero(burbujas: Burbuja[]): number {
  let max = -1;
  for (const b of burbujas) {
    const m = /^b(\d+)$/.exec(b.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function agregar(burbujas: Burbuja[], nuevas: Omit<Burbuja, "id">[]): Burbuja[] {
  let n = siguienteNumero(burbujas);
  return [...burbujas, ...nuevas.map((b) => ({ id: `b${n++}`, ...b }))];
}

/**
 * El saludo (con la tarjeta del auto) va una sola vez, al principio: no si ya saludó, si hay algo en curso o si la
 * persona ya escribió (por ejemplo, el primer saludo falló y después charló bien).
 */
export function necesitaSaludo(e: EstadoChat): boolean {
  return !e.saludado && !e.pendiente && !e.burbujas.some((b) => b.de === "cliente");
}

export function reducirChat(e: EstadoChat, a: AccionChat): EstadoChat {
  switch (a.tipo) {
    case "abrir":
      return { ...e, abierto: true };
    case "cerrar":
      return { ...e, abierto: false };
    case "enviar":
      if (e.pendiente) return e;
      return {
        ...e,
        pendiente: true,
        burbujas: agregar(e.burbujas, [{ de: "cliente", mensaje: { tipo: "texto", texto: a.texto } }]),
      };
    case "iniciar":
      return necesitaSaludo(e) ? { ...e, pendiente: true } : e;
    case "recibir":
      return {
        ...e,
        pendiente: false,
        saludado: true,
        sugerencias: a.respuesta.sugerencias,
        burbujas: agregar(
          e.burbujas,
          a.respuesta.mensajes.map((mensaje) => ({ de: "asistente" as const, mensaje })),
        ),
      };
    case "fallo":
      return {
        ...e,
        pendiente: false,
        burbujas: agregar(e.burbujas, [
          { de: "asistente", mensaje: { tipo: "texto", texto: TEXTO_FALLO } },
          {
            de: "asistente",
            mensaje: { tipo: "cierre", texto: textoDelLink(a.negocio.whatsappUrl), url: a.negocio.whatsappUrl, vehiculoSlug: null },
          },
        ]),
      };
    case "restaurar":
      if (e.burbujas.length > 0 || e.saludado || e.pendiente) return e;
      return { ...a.guardado, abierto: e.abierto, pendiente: false };
  }
}

/* ---------- persistencia ---------- */

/** Guarda solo lo necesario para retomar: las últimas burbujas, sin `abierto` ni `pendiente`. */
export function serializarChat(e: EstadoChat): string {
  let burbujas = e.burbujas.slice(-MAX_BURBUJAS);
  const armar = () =>
    JSON.stringify({ burbujas, sugerencias: e.sugerencias, saludado: e.saludado, abierto: false, pendiente: false });
  let json = armar();
  // Si pesa de más (tarjetas muy largas), suelta las más viejas hasta entrar en el tope de lectura.
  while (json.length > MAX_BYTES && burbujas.length > 0) {
    burbujas = burbujas.slice(1);
    json = armar();
  }
  return json;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const esTexto = (v: unknown): v is string => typeof v === "string";
const esTextoONulo = (v: unknown): v is string | null => v === null || typeof v === "string";

function tarjetaValida(t: unknown): t is TarjetaWeb {
  if (!esObjeto(t)) return false;
  if (!esTextoONulo(t.slug) || !esTexto(t.titulo) || !esTexto(t.subtitulo) || !esTextoONulo(t.imagenUrl)) return false;
  if (t.estado !== null && t.estado !== "disponible" && t.estado !== "reservado" && t.estado !== "vendido") return false;
  if (!Array.isArray(t.botones)) return false;
  return t.botones.every((b) => esObjeto(b) && esTexto(b.titulo) && esTexto(b.url));
}

function mensajeValido(m: unknown): m is Burbuja["mensaje"] {
  if (!esObjeto(m)) return false;
  switch (m.tipo) {
    case "texto":
      return esTexto(m.texto);
    case "tarjetas":
      return Array.isArray(m.tarjetas) && m.tarjetas.every(tarjetaValida);
    case "cierre":
      return esTexto(m.texto) && esTexto(m.url) && esTextoONulo(m.vehiculoSlug);
    default:
      return false;
  }
}

function burbujaValida(b: unknown): b is Burbuja {
  return esObjeto(b) && esTexto(b.id) && (b.de === "cliente" || b.de === "asistente") && mensajeValido(b.mensaje);
}

const MAX_MENSAJES_RESPUESTA = 10;

/** Valida la respuesta de POST /api/chat antes de mostrarla. `null` si no tiene la forma esperada. */
export function leerRespuesta(dato: unknown): RespuestaChat | null {
  if (!esObjeto(dato) || !Array.isArray(dato.mensajes) || !Array.isArray(dato.sugerencias)) return null;
  if (dato.mensajes.length === 0 || dato.mensajes.length > MAX_MENSAJES_RESPUESTA) return null;
  if (dato.sugerencias.length > MAX_MENSAJES_RESPUESTA * 2) return null;
  if (!dato.mensajes.every(mensajeValido) || !dato.sugerencias.every(esOpcionId)) return null;
  return { mensajes: dato.mensajes as MensajeWeb[], sugerencias: dato.sugerencias as OpcionId[] };
}

/** Lee lo guardado validando la forma (el storage lo puede tocar cualquiera). `null` si no sirve. */
export function leerChatGuardado(raw: string | null): EstadoChat | null {
  if (raw === null || raw.length > MAX_BYTES) return null;
  let dato: unknown;
  try {
    dato = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!esObjeto(dato)) return null;
  if (!Array.isArray(dato.burbujas) || dato.burbujas.length > MAX_BURBUJAS) return null;
  if (!Array.isArray(dato.sugerencias) || dato.sugerencias.length > MAX_BURBUJAS) return null;
  if (typeof dato.saludado !== "boolean") return null;
  if (!dato.burbujas.every(burbujaValida)) return null;
  if (!dato.sugerencias.every(esOpcionId)) return null;
  return {
    abierto: false,
    pendiente: false,
    saludado: dato.saludado,
    burbujas: dato.burbujas as Burbuja[],
    sugerencias: dato.sugerencias as OpcionId[],
  };
}

export function guardarChatEnSesion(storage: Pick<Storage, "setItem">, e: EstadoChat): void {
  try {
    storage.setItem(CLAVE_CHAT, serializarChat(e));
  } catch {
    /* storage bloqueado o lleno: el chat sigue andando sin persistir */
  }
}

export function cargarChatDeSesion(storage: Pick<Storage, "getItem">): EstadoChat | null {
  try {
    return leerChatGuardado(storage.getItem(CLAVE_CHAT));
  } catch {
    return null;
  }
}

/** `true` también si el storage falla: ante la duda no insistimos con el globo. */
export function globoYaMostrado(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(CLAVE_GLOBO) !== null;
  } catch {
    return true;
  }
}

export function marcarGloboMostrado(storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(CLAVE_GLOBO, "1");
  } catch {
    /* sin storage no se puede recordar; no pasa nada */
  }
}
