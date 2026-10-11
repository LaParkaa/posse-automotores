export type MensajeEntrante = {
  senderId: string;
  mid: string;
  /** null cuando el mensaje no trae texto (foto, audio, sticker...). */
  texto: string | null;
};

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
  // Mensaje enviado DESDE la cuenta (por el bot o por una persona). Sirve para pausar el bot.
  | { tipo: "eco"; destinatarioId: string; mid: string };

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Saca los mensajes de cliente de un payload de webhook de Instagram.
 *
 * Meta manda en el mismo webhook lecturas, reacciones, postbacks y "ecos" de lo
 * que envia la propia cuenta. Solo nos interesan los mensajes entrantes: el resto
 * se descarta para no responderle al bot su propia respuesta.
 */
export function extraerMensajes(body: unknown): MensajeEntrante[] {
  if (!esObjeto(body) || body.object !== "instagram" || !Array.isArray(body.entry)) {
    return [];
  }

  const mensajes: MensajeEntrante[] = [];

  for (const entry of body.entry) {
    if (!esObjeto(entry) || !Array.isArray(entry.messaging)) continue;

    for (const evento of entry.messaging) {
      if (!esObjeto(evento) || !esObjeto(evento.sender) || !esObjeto(evento.message)) continue;

      const senderId = evento.sender.id;
      const { mid, text, is_echo: esEco, is_deleted: estaBorrado } = evento.message;

      if (typeof senderId !== "string" || typeof mid !== "string") continue;
      if (esEco === true || estaBorrado === true) continue;

      const texto = typeof text === "string" && text.trim() !== "" ? text.trim() : null;
      mensajes.push({ senderId, mid, texto });
    }
  }

  return mensajes;
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
 * Como `extraerMensajes`, pero conserva lo que el bot nuevo necesita: de que historia viene
 * el mensaje, que adjuntos trae y los ecos (que el bot viejo descartaba).
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
        if (typeof destinatario === "string") eventos.push({ tipo: "eco", destinatarioId: destinatario, mid });
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
