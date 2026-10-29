import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadIg, MensajeIg, PerfilIg } from "./conversaciones";

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
