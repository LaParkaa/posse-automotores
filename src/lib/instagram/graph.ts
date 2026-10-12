import type { Perfil, Tarjeta } from "../bot/types";

const GRAPH_BASE_POR_DEFECTO = "https://graph.facebook.com/v21.0";

// Se leen del entorno en cada llamada (no al cargar el modulo) para que un cambio de configuracion
// o un test con vi.stubEnv se note sin reiniciar nada.
/**
 * Con "API setup with Instagram Login" Meta usa otro host (graph.instagram.com); con Facebook Login
 * sigue siendo graph.facebook.com. Sin barras finales para que al concatenar no queden dobles.
 */
function graphBase(): string {
  const base = (process.env.IG_GRAPH_BASE ?? "").trim().replace(/\/+$/, "");
  return base || GRAPH_BASE_POR_DEFECTO;
}

/** Con Instagram Login los mensajes salen por el id de la cuenta; "me" es el comportamiento de siempre. */
function urlMensajes(): string {
  const id = (process.env.IG_ID ?? "").trim();
  return `${graphBase()}/${id || "me"}/messages`;
}

// Corto a proposito: el envio comparte con el resto del turno (base de datos, demoras de
// "escribiendo...") la ventana de ~20 s de Meta, y si se pasa, el mensaje ya reclamado no se reintenta.
const TIMEOUT_MS = 5000;
// "Visto" y "escribiendo..." son un adorno: si Meta tarda, mejor perderlos que gastar la ventana.
const TIMEOUT_ACCION_MS = 1500;

/**
 * Un texto largo se manda en varias partes. Si una falla despues de que otras ya se entregaron,
 * este error lleva sus ids: el bot los necesita para reconocer sus ecos y no tomarlos por una persona.
 */
export class ErrorEnvioParcial extends Error {
  constructor(
    mensaje: string,
    readonly ids: string[],
    opciones?: { cause?: unknown },
  ) {
    super(mensaje, opciones);
    this.name = "ErrorEnvioParcial";
  }
}

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

/** POST al endpoint de mensajes. Devuelve el message_id si Meta lo informa. Lanza si la API rechaza. */
async function postMensajes(cuerpo: unknown, timeoutMs = TIMEOUT_MS): Promise<string | null> {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("Falta la variable de entorno PAGE_ACCESS_TOKEN");

  const respuesta = await fetch(urlMensajes(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`Graph API ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = (await respuesta.json().catch(() => null)) as { message_id?: unknown } | null;
  return typeof datos?.message_id === "string" ? datos.message_id : null;
}

/**
 * Envia un texto. Devuelve los message_id de cada parte: el bot los guarda para reconocer sus
 * propios mensajes cuando Meta los devuelve como "eco" (y no confundirlos con una persona).
 */
export async function enviarMensajeInstagram(destinatarioId: string, texto: string): Promise<string[]> {
  const ids: string[] = [];

  // En orden y de a uno: si se mandaran en paralelo podrian llegar desordenados.
  for (const parte of partirTexto(texto)) {
    try {
      const id = await postMensajes({ recipient: { id: destinatarioId }, message: { text: parte } });
      if (id) ids.push(id);
    } catch (err) {
      if (ids.length === 0) throw err;
      const mensaje = err instanceof Error ? err.message : String(err);
      throw new ErrorEnvioParcial(mensaje, ids, { cause: err });
    }
  }

  return ids;
}

function recortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

/** Tarjetas (plantilla generica): hasta 10 con imagen, titulo, subtitulo y 3 botones de enlace. */
export async function enviarTarjetas(destinatarioId: string, tarjetas: Tarjeta[]): Promise<string[]> {
  const elementos = tarjetas.slice(0, 10).map((t) => ({
    title: recortar(t.titulo, 80),
    subtitle: recortar(t.subtitulo, 80),
    ...(t.imagenUrl ? { image_url: t.imagenUrl } : {}),
    buttons: t.botones.slice(0, 3).map((b) => ({ type: "web_url", url: b.url, title: recortar(b.titulo, 20) })),
  }));
  if (elementos.length === 0) return [];

  const id = await postMensajes({
    recipient: { id: destinatarioId },
    message: { attachment: { type: "template", payload: { template_type: "generic", elements: elementos } } },
  });
  return id ? [id] : [];
}

/** "Visto" y "escribiendo...": son un detalle de trato, nunca deben romper la respuesta. */
export async function enviarAccion(destinatarioId: string, accion: "mark_seen" | "typing_on"): Promise<boolean> {
  try {
    await postMensajes({ recipient: { id: destinatarioId }, sender_action: accion }, TIMEOUT_ACCION_MS);
    return true;
  } catch {
    return false;
  }
}

/** Nombre y @usuario del cliente (mejor esfuerzo: sin permiso o con error, el bot sigue sin nombre). */
export async function obtenerPerfil(igsid: string): Promise<Perfil | null> {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const respuesta = await fetch(
      `${graphBase()}/${encodeURIComponent(igsid)}?fields=name,username`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) },
    );
    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as { name?: unknown; username?: unknown };
    const nombre = typeof datos.name === "string" && datos.name.trim() !== "" ? datos.name.trim() : undefined;
    const usuario = typeof datos.username === "string" && datos.username.trim() !== "" ? datos.username.trim() : undefined;
    return nombre || usuario ? { nombre, usuario } : null;
  } catch {
    return null;
  }
}
