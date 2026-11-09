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
