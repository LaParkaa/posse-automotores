/**
 * Id del visitante para el chat: el mismo número al azar del sitio (`posse_vid`, ver src/lib/rastreo.ts). Si el
 * navegador no deja guardarlo (o la persona pidió "No rastrear"), se usa uno temporal de la pestaña. Puro: los
 * storages entran por parámetro.
 */

export const CLAVE_VISITANTE = "posse_vid";
export const CLAVE_VISITANTE_TEMPORAL = "posse_chat_vid";

// Mismo formato que valida /api/chat.
const VALIDO = /^[A-Za-z0-9-]{8,64}$/;

type Almacen = Pick<Storage, "getItem" | "setItem">;

/** Lee el id guardado o, si no hay y se puede, crea uno. null si el storage falla, no guarda o tiene basura. */
function deAlmacen(almacen: Almacen | null, clave: string, crear: boolean, nuevo: () => string): string | null {
  if (!almacen) return null;
  try {
    const guardado = almacen.getItem(clave);
    if (guardado !== null) return VALIDO.test(guardado) ? guardado : null;
    if (!crear) return null;
    const id = nuevo();
    almacen.setItem(clave, id);
    return almacen.getItem(clave) === id ? id : null;
  } catch {
    return null;
  }
}

export function idDeVisitanteChat(o: {
  local: Almacen | null;
  sesion: Almacen | null;
  /** false con "No rastrear": no se crea un id permanente (se usa uno existente si ya estaba). */
  crear: boolean;
  nuevo: () => string;
}): string {
  return (
    deAlmacen(o.local, CLAVE_VISITANTE, o.crear, o.nuevo) ??
    deAlmacen(o.sesion, CLAVE_VISITANTE_TEMPORAL, true, o.nuevo) ??
    o.nuevo()
  );
}

type Azar = { randomUUID?: () => string; getRandomValues?: <T extends ArrayBufferView | null>(a: T) => T };

/**
 * Id nuevo al azar. `crypto.randomUUID` solo existe en contextos seguros (https o localhost): probando por la red
 * local con http no está, así que se cae a `getRandomValues` y, en último caso, a `Math.random`. Nunca lanza.
 */
export function idAlAzar(c: Azar | undefined = globalThis.crypto): string {
  try {
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* sigue con lo siguiente */
  }
  const bytes = new Uint8Array(16);
  try {
    if (c?.getRandomValues) c.getRandomValues(bytes);
    else throw new Error("sin getRandomValues");
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Con getRandomValues falso (tests) los bytes quedan en 0: se mezcla la hora para que igual cambie.
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
