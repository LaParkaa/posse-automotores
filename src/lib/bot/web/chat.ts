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
  /** Tiempo máximo de todo el pedido (ms); pasado eso se devuelve RESPUESTA_FALLA. Por defecto 8000 (la ruta dura 10 s). */
  presupuestoMs?: number;
};

const PRESUPUESTO_POR_DEFECTO_MS = 8000;

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
 *  - Si no se puede leer el estado, se sigue como charla nueva pero NO se guarda el estado después (no se pisa un
 *    guion en curso). Si no se puede guardar (mensajes, estado o lead), se anota en consola y se devuelve igual la
 *    respuesta.
 *  - Todo el pedido tiene un presupuesto (`presupuestoMs`, 8 s por defecto): si se agota, RESPUESTA_FALLA y lo que
 *    siga corriendo ya no guarda nada.
 *  - `inicio` es solo lectura: no guarda mensajes, estado ni lead.
 */
export async function procesarChat(pedido: PedidoChat, deps: DepsChat): Promise<RespuestaChat> {
  // Pasado el presupuesto se contesta con la falla y `vivo` pasa a falso: lo que siga corriendo ya no guarda nada.
  const ctl = { vivo: true };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const presupuesto = deps.presupuestoMs ?? PRESUPUESTO_POR_DEFECTO_MS;
    const agotado = new Promise<RespuestaChat>((resolver) => {
      timer = setTimeout(() => {
        ctl.vivo = false;
        registrar("se agotó el tiempo del pedido", new Error(`más de ${presupuesto} ms`));
        resolver(RESPUESTA_FALLA(deps.negocio));
      }, presupuesto);
    });
    const hecho = procesar(pedido, deps, ctl).catch((e): RespuestaChat => {
      registrar("fallo inesperado", e);
      return RESPUESTA_FALLA(deps.negocio);
    });
    return await Promise.race([hecho, agotado]);
  } catch (e) {
    registrar("fallo inesperado", e);
    return RESPUESTA_FALLA(deps.negocio);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function procesar(pedido: PedidoChat, deps: DepsChat, ctl: { vivo: boolean }): Promise<RespuestaChat> {
  const { visitante, ...entrada } = pedido;
  const ahora = deps.ahora();

  // 1. Topes (antes de gastar nada). Un error al contar no corta el servicio.
  try {
    const desde = new Date(ahora.getTime() - LIMITES.ventanaMinutos * 60_000);
    const [delVisitante, global] = await Promise.all([deps.contar(desde, visitante), deps.contar(desde)]);
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
  let estadoLeido = true;
  try {
    estado = await deps.cargarEstado(visitante);
  } catch (e) {
    estadoLeido = false;
    registrar("no se pudo leer el estado (se sigue como charla nueva, sin guardar el estado)", e);
  }
  if (!ctl.vivo) return RESPUESTA_FALLA(deps.negocio);

  // 3. El asistente.
  const salida = responderWeb({ ...entrada, mid: deps.mid() }, estado, catalogo, {
    negocio: deps.negocio,
    siteUrl: deps.siteUrl,
    ahora: deps.ahora,
  });

  let mensajes = salida.respuesta.mensajes;

  // 4. Lead. Si no se pudo guardar, la persona igual tiene que poder llegar a Marcos.
  if (salida.lead && !entrada.inicio && ctl.vivo) {
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

  // El saludo (inicio) es solo lectura: no guarda nada, se recalcula cuando hace falta. Así no se puede usar para
  // escribir en la base sin pasar por los topes (que cuentan mensajes del cliente).
  if (entrada.inicio || !ctl.vivo) return respuesta;

  // 5. Persistencia: cada parte por separado, para que una falla no tire la otra.
  const ficha = salida.estado.ficha ?? null;
  // El auto de la fila del cliente es el que quedó como actual (el de la ficha o el que se nombró en el catálogo);
  // sin eso, el de la ficha; si no hay ninguno, null.
  const idActual = salida.estado.sesion.vehiculoActualId;
  const autoActual = idActual ? catalogo.find((v) => v.id === idActual)?.slug : undefined;
  const slugDelAuto = autoActual ?? ficha;
  const esOpcion = entrada.opcion !== undefined;
  const filas: FilaMensajeWeb[] = [
    {
      role: "user",
      content: esOpcion ? ETIQUETAS_OPCION[entrada.opcion!] : (entrada.texto ?? ""),
      tipo: "texto",
      via: esOpcion ? "opcion" : "texto",
      vehiculo_slug: slugDelAuto,
      nota: salida.noEntendido ? "no_entendido" : null,
    },
  ];
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
    if (!ctl.vivo) return respuesta;
    await deps.guardarMensajes(visitante, filas);
  } catch (e) {
    registrar("no se pudieron guardar los mensajes", e);
  }
  // Si la lectura falló no se sabe qué había: guardar el estado de "charla nueva" pisaría un guion en curso.
  if (estadoLeido && ctl.vivo) {
    try {
      await deps.guardarEstado(visitante, salida.estado);
    } catch (e) {
      registrar("no se pudo guardar el estado", e);
    }
  }

  return respuesta;
}
