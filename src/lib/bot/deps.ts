import { createAdminSupabaseClient } from "../supabase";
import { enviarMensajeInstagram } from "../instagram/graph";
import { responderIA } from "./ai";
import { guardarRespuesta, obtenerHistorial, reclamarMensaje } from "./conversations";
import type { DepsBot } from "./handler";
import { guardarLeadInstagram } from "./leads";
import { obtenerStockTexto } from "./stock";

/**
 * Arma las dependencias reales del bot. Se llama una vez por request: en serverless
 * no hay estado entre invocaciones, y el cliente de Supabase es barato de crear.
 */
export function crearDeps(): DepsBot {
  const db = createAdminSupabaseClient();
  const siteUrl = process.env.SITE_URL ?? "";

  return {
    reclamarMensaje: (senderId, mid, contenido) => reclamarMensaje(db, senderId, mid, contenido),
    obtenerHistorial: (senderId) => obtenerHistorial(db, senderId),
    obtenerStockTexto: () => obtenerStockTexto(db, siteUrl),
    responderIA,
    guardarLead: (senderId, lead) => guardarLeadInstagram(db, senderId, lead),
    guardarRespuesta: (senderId, texto) => guardarRespuesta(db, senderId, texto),
    enviar: enviarMensajeInstagram,
  };
}
