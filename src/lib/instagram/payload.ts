export type MensajeEntrante = {
  senderId: string;
  mid: string;
  /** null cuando el mensaje no trae texto (foto, audio, sticker...). */
  texto: string | null;
};

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
