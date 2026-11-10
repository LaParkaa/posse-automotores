import { randomUUID } from "node:crypto";
import { obtenerCatalogo } from "@/lib/bot/catalogo";
import { NEGOCIO } from "@/lib/bot/negocio";
import { contarMensajesWeb, guardarEstadoWeb, guardarLeadWeb, guardarMensajesWeb, cargarEstadoWeb } from "@/lib/bot/web/almacen";
import { procesarChat, RESPUESTA_FALLA, type DepsChat } from "@/lib/bot/web/chat";
import { LIMITES } from "@/lib/bot/web/limites";
import { validarPedidoChat } from "@/lib/bot/web/pedido";
import { esRobot } from "@/lib/eventos";
import { createBotSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Tope por consulta a la base: la ruta dura 10 s (maxDuration) y el pedido hace varias consultas seguidas.
const TOPE_CONSULTA_MS = 2000;

const SIN_CACHE = { "Cache-Control": "no-store" };

function json(cuerpo: unknown, status = 200) {
  return Response.json(cuerpo, { status, headers: SIN_CACHE });
}

/** Las dependencias reales del chat. Se arman por pedido: en serverless no hay estado entre invocaciones. */
function crearDepsChat(request: Request): DepsChat {
  const db = createBotSupabaseClient(TOPE_CONSULTA_MS);
  return {
    catalogo: () => obtenerCatalogo(db),
    cargarEstado: (v) => cargarEstadoWeb(db, v, new Date()),
    guardarEstado: (v, e) => guardarEstadoWeb(db, v, e),
    guardarMensajes: (v, filas) => guardarMensajesWeb(db, v, filas),
    contar: (desde, visitante) => contarMensajesWeb(db, desde, visitante),
    guardarLead: (v, lead) => guardarLeadWeb(db, v, lead),
    ahora: () => new Date(),
    mid: () => randomUUID(),
    siteUrl: process.env.SITE_URL ?? new URL(request.url).origin,
    negocio: NEGOCIO,
  };
}

/**
 * Chat del asistente de la web. Pública, así que se cuida: no contesta a robots (204), corta cuerpos grandes o mal
 * formados (400) y nunca devuelve detalles de un error: si algo falla, 200 con un texto amable y el botón de Marcos.
 */
export async function POST(request: Request) {
  if (esRobot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });

  const invalido = () => json({ error: "Pedido inválido" }, 400);

  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > LIMITES.maxBytes) return invalido();

  let cuerpo: unknown;
  try {
    const texto = await request.text();
    if (new TextEncoder().encode(texto).length > LIMITES.maxBytes) return invalido();
    cuerpo = JSON.parse(texto);
  } catch {
    return invalido();
  }

  const pedido = validarPedidoChat(cuerpo);
  if (!pedido) return invalido();

  try {
    return json(await procesarChat(pedido, crearDepsChat(request)));
  } catch (e) {
    // procesarChat no lanza; esto cubre armar las dependencias (por ejemplo, variables de entorno que faltan).
    console.error("[chat] No se pudo atender el pedido:", e instanceof Error ? e.message : "error desconocido");
    return json(RESPUESTA_FALLA(NEGOCIO));
  }
}
