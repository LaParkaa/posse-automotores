import { createBotSupabaseClient } from "../supabase";
import { enviarAccion, enviarMensajeInstagram, enviarTarjetas, obtenerPerfil } from "../instagram/graph";
import { obtenerCatalogo } from "./catalogo";
import { esMidPropio, guardarSalida, marcarNoEntendido, reclamarMensaje } from "./conversations";
import type { DepsBot } from "./handler";
import { guardarLeadInstagram } from "./leads";
import { NEGOCIO } from "./negocio";
import {
  aprenderHistoria,
  cargarChat,
  guardarPerfil,
  guardarSesion,
  olvidarHistoria,
  pausarChat,
  vehiculoDeHistoria,
} from "./sesiones";

/**
 * Arma las dependencias reales del bot. Se llama una vez por request: en serverless
 * no hay estado entre invocaciones, y el cliente de Supabase es barato de crear.
 */
export function crearDeps(): DepsBot {
  const db = createBotSupabaseClient();

  return {
    reclamarMensaje: (senderId, mid, contenido) => reclamarMensaje(db, senderId, mid, contenido),
    cargarChat: (senderId) => cargarChat(db, senderId, new Date()),
    guardarSesion: (senderId, sesion) => guardarSesion(db, senderId, sesion),
    catalogo: () => obtenerCatalogo(db),
    vehiculoDeHistoria: (storyId) => vehiculoDeHistoria(db, storyId),
    aprenderHistoria: (storyId, vehiculoId) => aprenderHistoria(db, storyId, vehiculoId),
    olvidarHistoria: (storyId) => olvidarHistoria(db, storyId),
    obtenerPerfil,
    guardarPerfil: (senderId, perfil) => guardarPerfil(db, senderId, perfil),
    guardarLead: (senderId, lead) => guardarLeadInstagram(db, senderId, lead),
    // "Visto" y "escribiendo" son un detalle de trato: enviarAccion nunca lanza y su resultado no importa.
    marcarVisto: async (senderId) => {
      await enviarAccion(senderId, "mark_seen");
    },
    escribiendo: async (senderId) => {
      await enviarAccion(senderId, "typing_on");
    },
    enviarTexto: enviarMensajeInstagram,
    enviarTarjetas,
    guardarSalida: (senderId, partes) => guardarSalida(db, senderId, partes),
    marcarNoEntendido: (mid) => marcarNoEntendido(db, mid),
    esMidPropio: (mid) => esMidPropio(db, mid),
    pausar: (senderId, hasta) => pausarChat(db, senderId, hasta),
    esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    ahora: () => new Date(),
    siteUrl: process.env.SITE_URL ?? "",
    negocio: NEGOCIO,
  };
}
