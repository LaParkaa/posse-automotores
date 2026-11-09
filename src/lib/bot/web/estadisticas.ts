import { vistaPrevia, ventanaDeDias, type ConversacionResumen } from "../../conversaciones";
import type { TipoEvento } from "../../eventos";

/**
 * Los números del asistente de la página para el admin: el embudo (de ver un auto a tocar WhatsApp), las
 * conversaciones y lo que el asistente no entendió. Todo sale de web_mensajes, eventos y leads; no hay nada que
 * cargar a mano. Código puro: el reloj llega por `ahora`. Los conteos de personas son de visitantes DISTINTOS.
 */

export type MensajeWebFila = {
  visitante: string;
  role: "user" | "assistant";
  content: string;
  tipo: "texto" | "tarjetas" | "cierre";
  vehiculo_slug: string | null;
  nota: string | null;
  created_at: string;
};

export type EventoChat = {
  tipo: TipoEvento;
  ruta: string;
  vehiculo_slug: string | null;
  visitante: string | null;
  creado: string;
};

export type ResumenBotWeb = {
  embudo: {
    /** Visitantes que miraron la ficha de un auto o el catálogo. */
    vieronPagina: number;
    abrieron: number;
    /** Escribieron o tocaron una opción al menos una vez. */
    interactuaron: number;
    /** Llegaron a que el asistente les armara el mensaje para Marcos. */
    armaronMensaje: number;
    tocaronWhatsapp: number;
  };
  /** Visitantes con algún mensaje propio. */
  conversaciones: number;
  /** Promedio de mensajes del cliente por conversación; null sin conversaciones. */
  mensajesPorConversacion: number | null;
  /** Leads que dejaron sus datos desde la página. */
  dejaronDatos: number;
  autosMasConsultados: Array<{ slug: string; conversaciones: number }>;
  /** Lo que el cliente escribió y el asistente no entendió: top 10, mismo texto normalizado. */
  noEntendidos: Array<{ texto: string; veces: number }>;
  /** Para poner el chat al lado del simulador de financiación. */
  comparacion: { simulaciones: number; mensajesArmados: number; toquesWhatsappChat: number };
  porDia: Array<{ dia: string; etiqueta: string; personas: number }>;
};

const MAX_NO_ENTENDIDOS = 10;
// Una visita que cuenta como "vio un auto": la ficha (/vehiculos/slug) o el catálogo (con o sin filtros).
const RUTA_DE_AUTOS = /^\/(?:vehiculos\/|catalogo(?:[/?#]|$))/;

const normalizar = (texto: string) => texto.replace(/\s+/g, " ").trim().toLowerCase();

function agregar<K>(mapa: Map<K, Set<string>>, clave: K, visitante: string) {
  const set = mapa.get(clave);
  if (set) set.add(visitante);
  else mapa.set(clave, new Set([visitante]));
}

/** Resume los últimos `dias` días (el día de `ahora` incluido, en hora argentina). */
export function resumirBotWeb(a: {
  mensajes: MensajeWebFila[];
  eventos: EventoChat[];
  leadsWeb: number;
  dias: number;
  ahora: string;
}): ResumenBotWeb {
  const ventana = ventanaDeDias(a.dias, a.ahora);

  const personasPorDia = new Map<string, Set<string>>();
  for (const { dia } of ventana.dias) personasPorDia.set(dia, new Set());

  const vieron = new Set<string>();
  const abrieron = new Set<string>();
  const tocaronWhatsapp = new Set<string>();
  let simulaciones = 0;
  let toquesWhatsappChat = 0;

  for (const e of a.eventos) {
    if (!ventana.enVentana(e.creado)) continue;
    if (e.tipo === "simulacion") simulaciones++;
    if (e.tipo === "chat_whatsapp") toquesWhatsappChat++;
    if (!e.visitante) continue;
    if (e.tipo === "visita" && RUTA_DE_AUTOS.test(e.ruta)) vieron.add(e.visitante);
    else if (e.tipo === "chat_abrio") abrieron.add(e.visitante);
    else if (e.tipo === "chat_whatsapp") tocaronWhatsapp.add(e.visitante);
  }

  const mensajesDelCliente = new Map<string, number>();
  const armaron = new Set<string>();
  const autosPorVisitante = new Map<string, Set<string>>();
  const noEntendidos = new Map<string, number>();
  let mensajesArmados = 0;

  for (const m of a.mensajes) {
    if (!m.visitante || !ventana.enVentana(m.created_at)) continue;
    if (m.vehiculo_slug) agregar(autosPorVisitante, m.visitante, m.vehiculo_slug);
    if (m.tipo === "cierre") {
      mensajesArmados++;
      armaron.add(m.visitante);
    }
    if (m.role !== "user") continue;
    mensajesDelCliente.set(m.visitante, (mensajesDelCliente.get(m.visitante) ?? 0) + 1);
    personasPorDia.get(ventana.claveDeDia(m.created_at))?.add(m.visitante);
    if (m.nota === "no_entendido") {
      const texto = normalizar(m.content);
      if (texto) noEntendidos.set(texto, (noEntendidos.get(texto) ?? 0) + 1);
    }
  }

  // Un auto "se consulta" cuando una conversación (alguien que escribió) lo mencionó o lo tenía abierto.
  const consultas = new Map<string, number>();
  for (const [visitante, slugs] of autosPorVisitante) {
    if (!mensajesDelCliente.has(visitante)) continue;
    for (const slug of slugs) consultas.set(slug, (consultas.get(slug) ?? 0) + 1);
  }

  const conversaciones = mensajesDelCliente.size;
  const totalDelCliente = [...mensajesDelCliente.values()].reduce((suma, n) => suma + n, 0);

  return {
    embudo: {
      vieronPagina: vieron.size,
      abrieron: abrieron.size,
      interactuaron: conversaciones,
      armaronMensaje: armaron.size,
      tocaronWhatsapp: tocaronWhatsapp.size,
    },
    conversaciones,
    mensajesPorConversacion: conversaciones === 0 ? null : totalDelCliente / conversaciones,
    dejaronDatos: a.leadsWeb,
    autosMasConsultados: [...consultas]
      .map(([slug, conversaciones]) => ({ slug, conversaciones }))
      .sort((x, y) => y.conversaciones - x.conversaciones || x.slug.localeCompare(y.slug)),
    noEntendidos: [...noEntendidos]
      .map(([texto, veces]) => ({ texto, veces }))
      .sort((x, y) => y.veces - x.veces || x.texto.localeCompare(y.texto))
      .slice(0, MAX_NO_ENTENDIDOS),
    comparacion: { simulaciones, mensajesArmados, toquesWhatsappChat },
    porDia: ventana.dias.map(({ dia, etiqueta }) => ({ dia, etiqueta, personas: personasPorDia.get(dia)?.size ?? 0 })),
  };
}

/** Una fila por visitante, la conversación más reciente primero. Nadie tiene nombre: es "Visitante". */
export function armarConversacionesWeb(mensajes: MensajeWebFila[], conDatos: Set<string>): ConversacionResumen[] {
  const porVisitante = new Map<string, MensajeWebFila[]>();
  for (const m of mensajes) {
    if (!m.visitante) continue;
    const propios = porVisitante.get(m.visitante);
    if (propios) propios.push(m);
    else porVisitante.set(m.visitante, [m]);
  }

  const filas: ConversacionResumen[] = [];
  for (const [id, propios] of porVisitante) {
    const orden = [...propios].sort((x, y) => x.created_at.localeCompare(y.created_at));
    const ultimo = orden[orden.length - 1];
    filas.push({
      id,
      nombre: "Visitante",
      usuario: null,
      mensajes: orden.length,
      primerMensaje: orden[0].created_at,
      ultimoMensaje: ultimo.created_at,
      ultimoTexto: vistaPrevia(ultimo.content),
      ultimoEsDelCliente: ultimo.role === "user",
      noEntendidos: orden.filter((m) => m.role === "user" && m.nota === "no_entendido").length,
      postulo: orden.some((m) => m.tipo === "cierre"),
      dejoDatos: conDatos.has(id),
    });
  }
  return filas.sort((x, y) => y.ultimoMensaje.localeCompare(x.ultimoMensaje));
}
