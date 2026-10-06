const GRAPH_URL = "https://graph.facebook.com/v21.0/me/messages";
const TIMEOUT_MS = 8000;

/** Instagram rechaza textos de mas de 1000 bytes (no caracteres). */
export const MAX_BYTES_MENSAJE = 1000;

const codificador = new TextEncoder();
const bytes = (texto: string) => codificador.encode(texto).length;

/**
 * Divide un texto en partes de hasta `maxBytes` bytes UTF-8, cortando en los
 * espacios o saltos de linea. Una palabra mas larga que el limite se corta por
 * caracteres como ultimo recurso.
 */
export function partirTexto(texto: string, maxBytes = MAX_BYTES_MENSAJE): string[] {
  const partes: string[] = [];
  let actual = "";

  const cerrar = () => {
    const parte = actual.trim();
    if (parte !== "") partes.push(parte);
    actual = "";
  };

  // El split con grupo de captura conserva los espacios y saltos de linea como tokens.
  for (const token of texto.split(/(\s+)/)) {
    if (token === "") continue;

    if (bytes(actual + token) <= maxBytes) {
      actual += token;
      continue;
    }

    cerrar();
    if (token.trim() === "") continue; // el espacio sobrante entre partes se descarta
    if (bytes(token) <= maxBytes) {
      actual = token;
      continue;
    }

    for (const caracter of token) {
      if (bytes(actual + caracter) > maxBytes) cerrar();
      actual += caracter;
    }
  }

  cerrar();
  return partes;
}

/** Envia un mensaje de texto al usuario de Instagram. Lanza si la Graph API falla. */
export async function enviarMensajeInstagram(destinatarioId: string, texto: string): Promise<void> {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("Falta la variable de entorno PAGE_ACCESS_TOKEN");

  // En orden y de a uno: si se mandaran en paralelo podrian llegar desordenados.
  for (const parte of partirTexto(texto)) {
    const respuesta = await fetch(GRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipient: { id: destinatarioId }, message: { text: parte } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(`Graph API ${respuesta.status}: ${detalle.slice(0, 300)}`);
    }
  }
}
