import type { MensajeEntrante } from "../instagram/payload";
import { EMPRESA } from "./prompt";
import type { LeadInput, RespuestaIA, TurnoHistorial } from "./types";

export const MENSAJE_ADJUNTO =
  "¡Gracias por escribirnos! 😊 Por ahora solo puedo leer mensajes de texto. Contame qué vehículo estás buscando y te ayudo.";
export const MENSAJE_ERROR_TECNICO = `😔 Tuve un problema técnico. Probá de nuevo en un momento o escribinos por WhatsApp al ${EMPRESA.whatsapp}.`;

// Queda en el historial para que se entienda el turno, pero no se le manda a la IA como consulta.
const CONTENIDO_ADJUNTO = "[El cliente envió un adjunto]";

/** Todo lo que toca red o base de datos entra por aca, asi el flujo se testea sin ninguna de las dos. */
export type DepsBot = {
  reclamarMensaje(senderId: string, mid: string, contenido: string): Promise<boolean>;
  obtenerHistorial(senderId: string): Promise<TurnoHistorial[]>;
  obtenerStockTexto(): Promise<string>;
  responderIA(entrada: { stockTexto: string; historial: TurnoHistorial[] }): Promise<RespuestaIA>;
  guardarLead(senderId: string, lead: LeadInput): Promise<void>;
  guardarRespuesta(senderId: string, texto: string): Promise<void>;
  enviar(senderId: string, texto: string): Promise<void>;
};

/**
 * Procesa un lote de mensajes en orden y nunca lanza: un mensaje que falla no puede
 * frenar a los demas ni tumbar el webhook (Meta reintentaria el lote entero).
 */
export async function procesarMensajes(mensajes: MensajeEntrante[], deps: DepsBot): Promise<void> {
  for (const mensaje of mensajes) {
    try {
      await procesarMensaje(mensaje, deps);
    } catch (err) {
      console.error(`[bot] Error procesando el mensaje ${mensaje.mid}:`, err);
      await avisarError(mensaje.senderId, deps);
    }
  }
}

async function procesarMensaje({ senderId, mid, texto }: MensajeEntrante, deps: DepsBot): Promise<void> {
  const esNuevo = await deps.reclamarMensaje(senderId, mid, texto ?? CONTENIDO_ADJUNTO);
  if (!esNuevo) return;

  if (texto === null) {
    await responder(senderId, MENSAJE_ADJUNTO, deps);
    return;
  }

  // El mensaje actual ya esta en el historial porque se registro al reclamarlo.
  const [historial, stockTexto] = await Promise.all([
    deps.obtenerHistorial(senderId),
    deps.obtenerStockTexto(),
  ]);

  const respuesta = await deps.responderIA({ stockTexto, historial });

  if (respuesta.lead) {
    try {
      await deps.guardarLead(senderId, respuesta.lead);
    } catch (err) {
      // El cliente igual recibe su respuesta; el lead fallido queda en los logs.
      console.error(`[bot] No se pudo guardar el lead de ${senderId}:`, err);
    }
  }

  await responder(senderId, respuesta.texto, deps);
}

async function responder(senderId: string, texto: string, deps: DepsBot): Promise<void> {
  await deps.enviar(senderId, texto);

  try {
    await deps.guardarRespuesta(senderId, texto);
  } catch (err) {
    // Ya se envio: tirar el error mandaria un segundo mensaje de disculpas sin motivo.
    console.error(`[bot] No se pudo guardar la respuesta para ${senderId}:`, err);
  }
}

async function avisarError(senderId: string, deps: DepsBot): Promise<void> {
  try {
    await deps.enviar(senderId, MENSAJE_ERROR_TECNICO);
  } catch (err) {
    console.error(`[bot] No se pudo avisar el error a ${senderId}:`, err);
  }
}
