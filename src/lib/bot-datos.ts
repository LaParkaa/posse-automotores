import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventoChat, MensajeWebFila } from "./bot/web/estadisticas";
import { ventanaDeDias, type LeadIg, type MensajeIg, type PerfilIg } from "./conversaciones";

/**
 * Lectura de las tablas del bot para el admin (solo servidor, con la clave de servicio). Todo se calcula en cada
 * visita a la pantalla, así que los números siempre están al día sin que nadie cargue nada.
 */

const POR_PAGINA = 1000;
// Tope de seguridad: 30.000 mensajes por consulta. Una concesionaria no lo alcanza en 90 días.
const MAX_PAGINAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Instante de hace `dias` días (el reloj se lee acá, fuera del render). */
export const haceDias = (dias: number) => new Date(Date.now() - dias * DIA_MS).toISOString();

export type DatosBot = {
  mensajes: MensajeIg[];
  perfiles: PerfilIg[];
  leads: LeadIg[];
  /** Hubo más mensajes que el tope: se muestran los más recientes. */
  truncado: boolean;
};

async function traerMensajes(db: SupabaseClient, desde: string): Promise<{ mensajes: MensajeIg[]; truncado: boolean }> {
  const mensajes: MensajeIg[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const { data, error } = await db
      .from("ig_mensajes")
      .select("ig_user_id, role, content, created_at, nota")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);
    if (error) throw new Error(`No se pudieron leer los mensajes: ${error.message}`);
    mensajes.push(...(data as MensajeIg[]));
    if (data.length < POR_PAGINA) return { mensajes, truncado: false };
  }
  return { mensajes, truncado: true };
}

async function traerPerfiles(db: SupabaseClient): Promise<PerfilIg[]> {
  const { data, error } = await db.from("ig_sesiones").select("ig_user_id, perfil");
  if (error) throw new Error(`No se pudieron leer los perfiles: ${error.message}`);
  return (data ?? []).map((s) => {
    const perfil = (s.perfil ?? {}) as { nombre?: string; usuario?: string };
    return { ig_user_id: s.ig_user_id as string, nombre: perfil.nombre ?? null, usuario: perfil.usuario ?? null };
  });
}

async function traerLeadsInstagram(db: SupabaseClient): Promise<LeadIg[]> {
  const { data, error } = await db.from("leads").select("instagram_id, created_at").eq("origen", "instagram");
  if (error) throw new Error(`No se pudieron leer los leads: ${error.message}`);
  return (data ?? []) as LeadIg[];
}

/** Lo necesario para resumir el bot y listar sus conversaciones de los últimos `dias` días. */
export async function cargarDatosBot(db: SupabaseClient, dias: number): Promise<DatosBot> {
  // Un día de más: el corte exacto se hace después, en hora argentina.
  const [{ mensajes, truncado }, perfiles, leads] = await Promise.all([
    traerMensajes(db, haceDias(dias + 1)),
    traerPerfiles(db),
    traerLeadsInstagram(db),
  ]);
  return { mensajes, perfiles, leads, truncado };
}

/** El chat completo de una persona, del primer mensaje al último. */
export async function traerChat(db: SupabaseClient, igUserId: string): Promise<MensajeIg[]> {
  const { data, error } = await db
    .from("ig_mensajes")
    .select("ig_user_id, role, content, created_at, nota")
    .eq("ig_user_id", igUserId)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`No se pudo leer la conversación: ${error.message}`);
  return (data ?? []) as MensajeIg[];
}

export async function traerPerfil(db: SupabaseClient, igUserId: string): Promise<PerfilIg | undefined> {
  const { data } = await db.from("ig_sesiones").select("ig_user_id, perfil").eq("ig_user_id", igUserId).maybeSingle();
  if (!data) return undefined;
  const perfil = (data.perfil ?? {}) as { nombre?: string; usuario?: string };
  return { ig_user_id: igUserId, nombre: perfil.nombre ?? null, usuario: perfil.usuario ?? null };
}

export async function dejoDatos(db: SupabaseClient, igUserId: string): Promise<boolean> {
  const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("instagram_id", igUserId);
  return (count ?? 0) > 0;
}

// ---- Asistente de la página (web_mensajes, eventos y leads con origen "web") ----

export type DatosWeb = {
  mensajes: MensajeWebFila[];
  eventos: EventoChat[];
  /** Leads que dejaron sus datos desde la página (desde la medianoche argentina del primer día, el mismo corte que el resto del resumen). */
  leadsWeb: number;
  /** Visitantes (distintos) cuyo chat terminó en un lead, en la misma ventana. Los leads viejos, sin visitante, no figuran. */
  visitantesConDatos: string[];
  /** Hubo más filas que el tope: se muestran las más recientes. */
  truncado: boolean;
};

const COLUMNAS_WEB = "visitante, role, content, tipo, vehiculo_slug, nota, created_at";
const COLUMNAS_EVENTO = "tipo, ruta, vehiculo_slug, visitante, creado";
// Los eventos que usa el resumen del asistente; el resto (whatsapp, simular) no hace falta traerlo.
const TIPOS_DEL_CHAT = ["visita", "chat_abrio", "chat_whatsapp", "simulacion"];

/** Lee una tabla de a páginas, de la fila más reciente a la más vieja, con el mismo tope que `traerMensajes`. */
async function traerPaginado<T>(
  pedirPagina: (desdeFila: number, hastaFila: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  falla: string,
): Promise<{ filas: T[]; truncado: boolean }> {
  const filas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const { data, error } = await pedirPagina(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);
    if (error) throw new Error(`${falla}: ${error.message}`);
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < POR_PAGINA) return { filas, truncado: false };
  }
  return { filas, truncado: true };
}

/** Lo necesario para resumir el asistente de la página y listar sus conversaciones de los últimos `dias` días. */
export async function cargarDatosWeb(db: SupabaseClient, dias: number): Promise<DatosWeb> {
  // Un día de más: el corte exacto se hace después, en hora argentina.
  const desde = haceDias(dias + 1);
  // Los leads solo llegan como número, así que se cortan ya en la consulta, en el mismo instante que `enVentana`.
  const desdeLeads = ventanaDeDias(dias, new Date().toISOString()).desde;
  const [mensajes, eventos, leads] = await Promise.all([
    traerPaginado<MensajeWebFila>(
      (a, b) =>
        db.from("web_mensajes").select(COLUMNAS_WEB).gte("created_at", desde).order("created_at", { ascending: false }).range(a, b),
      "No se pudieron leer los mensajes de la página",
    ),
    traerPaginado<EventoChat>(
      (a, b) =>
        db
          .from("eventos")
          .select(COLUMNAS_EVENTO)
          .in("tipo", TIPOS_DEL_CHAT)
          .gte("creado", desde)
          .order("creado", { ascending: false })
          .range(a, b),
      "No se pudieron leer los eventos",
    ),
    traerPaginado<{ web_visitante: string | null }>(
      (a, b) =>
        db
          .from("leads")
          .select("web_visitante")
          .eq("origen", "web")
          .gte("created_at", desdeLeads)
          .order("created_at", { ascending: false })
          .range(a, b),
      "No se pudieron leer los leads",
    ),
  ]);
  return {
    mensajes: mensajes.filas,
    eventos: eventos.filas,
    leadsWeb: leads.filas.length,
    visitantesConDatos: [...new Set(leads.filas.map((l) => l.web_visitante).filter((v): v is string => !!v))],
    truncado: mensajes.truncado || eventos.truncado,
  };
}

/** El chat completo de un visitante de la página, del primer mensaje al último. */
export async function traerChatWeb(db: SupabaseClient, visitante: string): Promise<MensajeWebFila[]> {
  const { data, error } = await db
    .from("web_mensajes")
    .select(COLUMNAS_WEB)
    .eq("visitante", visitante)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`No se pudo leer la conversación: ${error.message}`);
  return (data ?? []) as MensajeWebFila[];
}

/** ¿Este visitante dejó sus datos (hay un lead web con su id)? */
export async function dejoDatosWeb(db: SupabaseClient, visitante: string): Promise<boolean> {
  const { count, error } = await db
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("origen", "web")
    .eq("web_visitante", visitante);
  if (error) throw new Error(`No se pudieron leer los leads: ${error.message}`);
  return (count ?? 0) > 0;
}
