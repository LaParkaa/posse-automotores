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

      eventos.push({
        tipo: "mensaje",
        senderId,
        mid,
        texto: typeof text === "string" && text.trim() !== "" ? text.trim() : null,
        historiaId: historiaDe(evento.message),
        adjuntos: adjuntosDe(evento.message),
      });
    }
  }

  return eventos;
}
