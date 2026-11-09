import type { Negocio } from "../negocio";
import { MAX_MENSAJES } from "../turno";
import type { LeadInput, VehiculoCatalogo } from "../types";
import { buildWhatsAppUrlWeb } from "../../utils";
import type { FilaMensajeWeb } from "./almacen";
import { responderWeb, type EstadoWeb } from "./asistente";
import { evaluarLimite, LIMITES } from "./limites";
import type { PedidoChat } from "./pedido";
import { ETIQUETAS_OPCION, type MensajeWeb, type RespuestaChat } from "./tipos";

/** Todo lo que toca la red o el reloj, inyectado: la ruta pasa las reales y los tests, falsas. */
export type DepsChat = {
  catalogo(): Promise<VehiculoCatalogo[] | null>;
  cargarEstado(v: string): Promise<EstadoWeb | null>;
  guardarEstado(v: string, e: EstadoWeb): Promise<void>;
  guardarMensajes(v: string, filas: FilaMensajeWeb[]): Promise<void>;
  contar(desde: Date, visitante?: string): Promise<number>;
  guardarLead(v: string, l: LeadInput): Promise<void>;
  ahora(): Date;
  mid(): string;
  siteUrl: string;
  negocio: Negocio;
};

/** Cierre que lleva al WhatsApp de Marcos sin auto ni datos: el mismo link que usa el resto del sitio. */
function cierreGenerico(texto: string): MensajeWeb {
  return { tipo: "cierre", texto, url: buildWhatsAppUrlWeb(null), vehiculoSlug: null };
}

const textoSimple = (texto: string): MensajeWeb => ({ tipo: "texto", texto });

/** Cuando algo se rompe: un texto fijo (nunca el error) y el botón para escribirle a Marcos. */
export const RESPUESTA_FALLA = (negocio: Negocio): RespuestaChat => ({
  mensajes: [
    textoSimple(`Uy, ahora no puedo contestarte. Escribile a ${negocio.secretaria} por WhatsApp y te ayuda enseguida.`),
    cierreGenerico(`Hola ${negocio.secretaria}, te escribo desde la web. Quiero consultar por un vehículo.`),
  ],
  sugerencias: [],
});

function respuestaLimite(negocio: Negocio, tipo: "visitante" | "global"): RespuestaChat {
  const texto =
    tipo === "visitante"
      ? `Hiciste muchas consultas seguidas y tengo que frenar un rato. Para seguir, escribile a ${negocio.secretaria} por WhatsApp.`
      : `Ahora hay muchas consultas al mismo tiempo y no llego a contestarte. Escribile a ${negocio.secretaria} por WhatsApp y te atiende.`;
  return {
    mensajes: [
      textoSimple(texto),
      cierreGenerico(`Hola ${negocio.secretaria}, te escribo desde la web. Quiero consultar por un vehículo.`),
    ],
    sugerencias: [],
  };
}

const registrar = (donde: string, e: unknown) =>
  console.error(`[chat] ${donde}:`, e instanceof Error ? e.message : "error desconocido");

const tieneBotonDeMarcos = (mensajes: MensajeWeb[]) =>
  mensajes.some((m) =>
    m.tipo === "cierre"
      ? m.url.startsWith("https://wa.me/")
      : m.tipo === "tarjetas" && m.tarjetas.some((t) => t.botones.some((b) => b.url.startsWith("https://wa.me/"))),
  );

function contenidoDe(m: MensajeWeb): string {
  if (m.tipo === "tarjetas") return `Mostró: ${m.tarjetas.map((t) => t.titulo).join(", ")}`;
  return m.texto;
}

/**
 * Responde un pedido del chat web y guarda lo que corresponde. NUNCA lanza: cualquier falla termina en una respuesta
 * 200 amable con el botón de Marcos.
 *
 * Decisiones sobre qué pasa cuando algo falla:
 *  - Los topes se miran ANTES de correr el asistente y, si cortan, no se guarda nada.
 *  - Si no se pueden contar los mensajes (base caída, tabla sin crear), se contesta igual ("falla abierto"): el chat
 *    es un servicio al cliente y el peor abuso posible es acotado (el asistente es una función pura, sin costo por
 *    llamada más que la lectura del catálogo).
 *  - Sin catálogo no hay nada que decir: se devuelve RESPUESTA_FALLA y no se guarda nada.
 *  - Si no se puede leer el estado, se sigue como charla nueva. Si no se puede guardar (mensajes, estado o lead), se
 *    anota en consola y se devuelve igual la respuesta.
 */
export async function procesarChat(pedido: PedidoChat, deps: DepsChat): Promise<RespuestaChat> {
  try {
    return await procesar(pedido, deps);
  } catch (e) {
    registrar("fallo inesperado", e);
    return RESPUESTA_FALLA(deps.negocio);
  }
}

async function procesar(pedido: PedidoChat, deps: DepsChat): Promise<RespuestaChat> {
  const { visitante, ...entrada } = pedido;
  const ahora = deps.ahora();

  // 1. Topes (antes de gastar nada). Un error al contar no corta el servicio.
  try {
    const desde = new Date(ahora.getTime() - LIMITES.ventanaMinutos * 60_000);
    const delVisitante = await deps.contar(desde, visitante);
    const global = delVisitante >= LIMITES.porVisitante ? 0 : await deps.contar(desde);
    const decision = evaluarLimite({ visitante: delVisitante, global });
    if (decision !== "ok") return respuestaLimite(deps.negocio, decision);
  } catch (e) {
    registrar("no se pudo medir el límite (se contesta igual)", e);
  }

  // 2. Catálogo y estado.
  let catalogo: VehiculoCatalogo[] | null = null;
  try {
    catalogo = await deps.catalogo();
  } catch (e) {
    registrar("no se pudo leer el catálogo", e);
  }
  if (!catalogo) return RESPUESTA_FALLA(deps.negocio);

  let estado: EstadoWeb | null = null;
  try {
    estado = await deps.cargarEstado(visitante);
  } catch (e) {
    registrar("no se pudo leer el estado (se sigue como charla nueva)", e);
  }

  // 3. El asistente.
  const salida = responderWeb({ ...entrada, mid: deps.mid() }, estado, catalogo, {
    negocio: deps.negocio,
    siteUrl: deps.siteUrl,
    ahora: deps.ahora,
  });

  let mensajes = salida.respuesta.mensajes;

  // 4. Lead. Si no se pudo guardar, la persona igual tiene que poder llegar a Marcos.
  if (salida.lead) {
    try {
      await deps.guardarLead(visitante, salida.lead);
    } catch (e) {
      registrar("no se pudo guardar el lead", e);
      if (!tieneBotonDeMarcos(mensajes)) {
        const cierre = cierreGenerico(`Hola ${deps.negocio.secretaria}, te escribo desde la web. Quiero consultar por un vehículo.`);
        mensajes = [...mensajes.slice(0, MAX_MENSAJES - 1), cierre];
      }
    }
  }
  const respuesta: RespuestaChat = { mensajes, sugerencias: salida.respuesta.sugerencias };

  // 5. Persistencia: cada parte por separado, para que una falla no tire la otra.
  const ficha = salida.estado.ficha ?? null;
  const filas: FilaMensajeWeb[] = [];
  if (!entrada.inicio) {
    const esOpcion = entrada.opcion !== undefined;
    filas.push({
      role: "user",
      content: esOpcion ? ETIQUETAS_OPCION[entrada.opcion!] : (entrada.texto ?? ""),
      tipo: "texto",
      via: esOpcion ? "opcion" : "texto",
      vehiculo_slug: ficha,
      nota: salida.noEntendido ? "no_entendido" : null,
    });
  }
  for (const m of mensajes) {
    filas.push({
      role: "assistant",
      content: contenidoDe(m),
      tipo: m.tipo,
      via: null,
      vehiculo_slug: m.tipo === "cierre" ? m.vehiculoSlug : null,
      nota: null,
    });
  }
  try {
    await deps.guardarMensajes(visitante, filas);
  } catch (e) {
    registrar("no se pudieron guardar los mensajes", e);
  }
  try {
    await deps.guardarEstado(visitante, salida.estado);
  } catch (e) {
    registrar("no se pudo guardar el estado", e);
  }

  return respuesta;
}
