export type EventoEntrante =
  | {
      tipo: "mensaje";
      senderId: string;
      mid: string;
      /** null cuando no trae texto (audio, foto, reel compartido...). */
      texto: string | null;
      /** Id de la historia cuando el mensaje es una respuesta a una historia. */
      historiaId: string | null;
      /** Tipos de adjunto tal como los manda Meta ("audio", "image", "ig_reel", "story_mention"...). */
      adjuntos: string[];
      /**
       * Textos legibles de los adjuntos (titulo, telefono). Instagram convierte un telefono escrito en una
       * "tarjeta de contacto": el numero llega aca y no en `texto`. Solo si hay alguno.
       */
      adjuntosTexto?: string[];
    }
  // Mensaje enviado DESDE la cuenta (por el bot, por una persona o por una respuesta automatica de
  // Instagram). Sirve para pausar el bot; el texto permite reconocer las respuestas automaticas.
  | { tipo: "eco"; destinatarioId: string; mid: string; texto: string | null };

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function historiaDe(mensaje: Objeto): string | null {
  const respuestaA = mensaje.reply_to;
  if (!esObjeto(respuestaA) || !esObjeto(respuestaA.story)) return null;
  const id = respuestaA.story.id;
  return typeof id === "string" && id !== "" ? id : null;
}

function adjuntosDe(mensaje: Objeto): string[] {
  if (!Array.isArray(mensaje.attachments)) return [];
  return mensaje.attachments.flatMap((a) => (esObjeto(a) && typeof a.type === "string" ? [a.type] : []));
}

const MAX_TEXTOS_ADJUNTO = 8;
const MAX_LARGO_TEXTO_ADJUNTO = 200;
const PROFUNDIDAD_MAXIMA = 3;

/**
 * Textos de los adjuntos (titulo, telefono...), acotados. Los links se ignoran: los de fotos y videos traen
 * numeros largos que no son un telefono. `tel:+54...` no es un link con "//", asi que se conserva.
 */
function textosDeAdjuntos(mensaje: Objeto): string[] {
  if (!Array.isArray(mensaje.attachments)) return [];
  const textos: string[] = [];

  const juntar = (valor: unknown, profundidad: number): void => {
    if (textos.length >= MAX_TEXTOS_ADJUNTO) return;
    if (typeof valor === "string") {
      const limpio = valor.trim().slice(0, MAX_LARGO_TEXTO_ADJUNTO);
      if (limpio !== "" && !/^[a-z][a-z0-9+.-]*:\/\//i.test(limpio)) textos.push(limpio);
    } else if (profundidad < PROFUNDIDAD_MAXIMA && esObjeto(valor)) {
      for (const v of Object.values(valor)) juntar(v, profundidad + 1);
    }
  };

  for (const adjunto of mensaje.attachments) {
    if (!esObjeto(adjunto)) continue;
    for (const [clave, valor] of Object.entries(adjunto)) if (clave !== "type") juntar(valor, 0);
  }
  return textos;
}

/**
 * Saca los eventos de un payload de webhook de Instagram: mensajes de clientes (con la historia de
 * la que vienen y los adjuntos que traen) y ecos de lo que envia la propia cuenta.
 */
export function extraerEventos(body: unknown): EventoEntrante[] {
  if (!esObjeto(body) || body.object !== "instagram" || !Array.isArray(body.entry)) return [];

  const eventos: EventoEntrante[] = [];

  for (const entry of body.entry) {
    if (!esObjeto(entry) || !Array.isArray(entry.messaging)) continue;

    for (const evento of entry.messaging) {
      if (!esObjeto(evento) || !esObjeto(evento.message)) continue;

      const { mid, text, is_echo: esEco, is_deleted: estaBorrado } = evento.message;
      if (typeof mid !== "string" || estaBorrado === true) continue;

      if (esEco === true) {
        const destinatario = esObjeto(evento.recipient) ? evento.recipient.id : undefined;
        if (typeof destinatario === "string") {
          eventos.push({
            tipo: "eco",
            destinatarioId: destinatario,
            mid,
            texto: typeof text === "string" && text.trim() !== "" ? text.trim() : null,
          });
        }
        continue;
      }

      const senderId = esObjeto(evento.sender) ? evento.sender.id : undefined;
      if (typeof senderId !== "string") continue;

      const adjuntosTexto = textosDeAdjuntos(evento.message);
      eventos.push({
        tipo: "mensaje",
        senderId,
        mid,
        texto: typeof text === "string" && text.trim() !== "" ? text.trim() : null,
        historiaId: historiaDe(evento.message),
        adjuntos: adjuntosDe(evento.message),
        ...(adjuntosTexto.length > 0 ? { adjuntosTexto } : {}),
      });
    }
  }

  return eventos;
}
