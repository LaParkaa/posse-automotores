import { toArDay } from "./metrics";

/**
 * Conversaciones del bot de Instagram para el admin: la lista de personas, los números del bot y el reconocimiento
 * de una postulación terminada. Todo sale de lo que el bot ya guarda (ig_mensajes, ig_sesiones y leads): no hay
 * nada que cargar a mano. Código puro, para poder probarlo.
 */

export type MensajeIg = {
  ig_user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  nota: string | null;
};

export type PerfilIg = { ig_user_id: string; nombre: string | null; usuario: string | null };
export type LeadIg = { instagram_id: string | null; created_at: string };

export type FiltroConversaciones = "todas" | "fallas" | "postulaciones" | "datos";
export const FILTROS: Array<{ valor: FiltroConversaciones; texto: string }> = [
  { valor: "todas", texto: "Todas" },
  { valor: "fallas", texto: "Con fallas del bot" },
  { valor: "postulaciones", texto: "Postulaciones" },
  { valor: "datos", texto: "Dejaron sus datos" },
];

export function filtroDeUrl(valor: string | undefined): FiltroConversaciones {
  return FILTROS.find((f) => f.valor === valor)?.valor ?? "todas";
}

/**
 * El bot cierra una postulación completa con "Ya dejé listo tu mensaje para Marcos" o "Armé tu mensaje para
 * Marcos con todos tus datos" (ver `postulacionListo` en textos.ts; un test vigila que sigan coincidiendo). La
 * intro dice "te dejo armado el mensaje", que NO es un cierre.
 */
const CIERRE_POSTULACION = /(?:ya dej[eé] listo tu mensaje para|arm[eé] tu mensaje para)/i;

export function esCierrePostulacion(texto: string): boolean {
  return CIERRE_POSTULACION.test(texto);
}

const DIA_MS = 24 * 60 * 60 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const claveDia = (d: Date) => d.toISOString().slice(0, 10);

/** "27 oct, 15:04" en hora argentina. */
export function fechaHora(iso: string): string {
  const local = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  const hora = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  return `${local.getUTCDate()} ${MESES[local.getUTCMonth()]}, ${hora}`;
}

export type ResumenBot = {
  /** Personas distintas que escribieron. */
  personas: number;
  mensajesRecibidos: number;
  respuestasDelBot: number;
  /** Mensajes de clientes que el bot no supo contestar. */
  noEntendidos: number;
  /** De 0 a 100; null si todavía no escribió nadie. */
  porcentajeEntendido: number | null;
  /** Personas que dejaron nombre y teléfono. */
  dejaronDatos: number;
  /** Personas que llegaron al final de una postulación de vendedor. */
  postulaciones: number;
  /** Personas que escribieron en dos o más días distintos. */
  volvieron: number;
  porDia: Array<{ dia: string; etiqueta: string; personas: number }>;
};

/** Resume los últimos `dias` días (el día de `ahora` incluido, en hora argentina). */
export function resumirBot(mensajes: MensajeIg[], leads: LeadIg[], dias: number, ahora: string): ResumenBot {
  const hoy = toArDay(ahora).getTime();
  const primero = hoy - (dias - 1) * DIA_MS;
  const enVentana = (iso: string) => {
    const t = toArDay(iso).getTime();
    return t >= primero && t <= hoy;
  };

  const personasPorDia = new Map<string, Set<string>>();
  for (let i = 0; i < dias; i++) personasPorDia.set(claveDia(new Date(primero + i * DIA_MS)), new Set());

  const personas = new Set<string>();
  const postulantes = new Set<string>();
  const diasDePersona = new Map<string, Set<string>>();
  let recibidos = 0;
  let respuestas = 0;
  let noEntendidos = 0;

  for (const m of mensajes) {
    if (!enVentana(m.created_at)) continue;
    const dia = claveDia(toArDay(m.created_at));
    if (m.role === "user") {
      recibidos++;
      if (m.nota === "no_entendido") noEntendidos++;
      personas.add(m.ig_user_id);
      personasPorDia.get(dia)?.add(m.ig_user_id);
      const propios = diasDePersona.get(m.ig_user_id) ?? new Set<string>();
      propios.add(dia);
      diasDePersona.set(m.ig_user_id, propios);
    } else {
      respuestas++;
      if (esCierrePostulacion(m.content)) postulantes.add(m.ig_user_id);
    }
  }

  const conDatos = new Set(leads.filter((l) => l.instagram_id && enVentana(l.created_at)).map((l) => l.instagram_id as string));

  return {
    personas: personas.size,
    mensajesRecibidos: recibidos,
    respuestasDelBot: respuestas,
    noEntendidos,
    porcentajeEntendido: recibidos === 0 ? null : Math.round((1 - noEntendidos / recibidos) * 100),
    dejaronDatos: conDatos.size,
    postulaciones: postulantes.size,
    volvieron: [...diasDePersona.values()].filter((d) => d.size >= 2).length,
    porDia: [...personasPorDia].map(([dia, set]) => {
      const d = new Date(`${dia}T00:00:00Z`);
      return { dia, etiqueta: `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`, personas: set.size };
    }),
  };
}

export type ConversacionResumen = {
  id: string;
  nombre: string;
  usuario: string | null;
  mensajes: number;
  primerMensaje: string;
  ultimoMensaje: string;
  ultimoTexto: string;
  ultimoEsDelCliente: boolean;
  noEntendidos: number;
  postulo: boolean;
  dejoDatos: boolean;
};

const MAX_VISTA_PREVIA = 90;

function vistaPrevia(texto: string): string {
  const una = texto.replace(/\s+/g, " ").trim();
  return una.length > MAX_VISTA_PREVIA ? `${una.slice(0, MAX_VISTA_PREVIA - 1)}…` : una;
}

export function nombreDeConversacion(id: string, perfil: PerfilIg | undefined): string {
  return perfil?.nombre?.trim() || (perfil?.usuario ? `@${perfil.usuario}` : `Persona …${id.slice(-4)}`);
}

/** Una fila por persona, la conversación más reciente primero; `filtro` deja solo las que cumplen. */
export function armarConversaciones(
  mensajes: MensajeIg[],
  perfiles: PerfilIg[],
  idsConDatos: Set<string>,
  filtro: FiltroConversaciones = "todas",
): ConversacionResumen[] {
  const perfilDe = new Map(perfiles.map((p) => [p.ig_user_id, p]));
  const porPersona = new Map<string, MensajeIg[]>();
  for (const m of mensajes) porPersona.set(m.ig_user_id, [...(porPersona.get(m.ig_user_id) ?? []), m]);

  const filas: ConversacionResumen[] = [];
  for (const [id, propios] of porPersona) {
    const orden = [...propios].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const ultimo = orden[orden.length - 1];
    const perfil = perfilDe.get(id);
    filas.push({
      id,
      nombre: nombreDeConversacion(id, perfil),
      usuario: perfil?.usuario ?? null,
      mensajes: orden.length,
      primerMensaje: orden[0].created_at,
      ultimoMensaje: ultimo.created_at,
      ultimoTexto: vistaPrevia(ultimo.content),
      ultimoEsDelCliente: ultimo.role === "user",
      noEntendidos: orden.filter((m) => m.role === "user" && m.nota === "no_entendido").length,
      postulo: orden.some((m) => m.role === "assistant" && esCierrePostulacion(m.content)),
      dejoDatos: idsConDatos.has(id),
    });
  }

  const cumple = (f: ConversacionResumen) =>
    filtro === "fallas" ? f.noEntendidos > 0 : filtro === "postulaciones" ? f.postulo : filtro === "datos" ? f.dejoDatos : true;
  return filas.filter(cumple).sort((a, b) => b.ultimoMensaje.localeCompare(a.ultimoMensaje));
}
