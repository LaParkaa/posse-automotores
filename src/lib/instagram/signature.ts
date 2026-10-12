import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIJO = "sha256=";

/**
 * Comprueba que el webhook lo mando Meta: HMAC-SHA256 del cuerpo crudo con el
 * app secret. Hay que firmar el texto exacto que llego, no el JSON re-serializado.
 */
export function verificarFirma(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith(PREFIJO)) return false;

  const recibida = Buffer.from(header.slice(PREFIJO.length), "hex");
  const esperada = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();

  // timingSafeEqual lanza si los largos difieren; un hex invalido da un buffer mas corto.
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}
