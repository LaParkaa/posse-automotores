import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarSesion, type Sesion } from "./sesion";
import type { Perfil } from "./types";

export type EstadoChat = { sesion: Sesion | null; pausaHasta: Date | null; perfil: Perfil | null };

const CHAT_VACIO = (): EstadoChat => ({ sesion: null, pausaHasta: null, perfil: null });

const ahoraISO = () => new Date().toISOString();

function aFecha(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const fecha = new Date(v);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function aPerfil(v: unknown): Perfil | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { nombre, usuario } = v as Record<string, unknown>;
  const perfil: Perfil = {
    ...(typeof nombre === "string" ? { nombre } : {}),
    ...(typeof usuario === "string" ? { usuario } : {}),
  };
  return Object.keys(perfil).length > 0 ? perfil : null;
}

/**
 * Estado completo del chat. Si la lectura falla devuelve todo null (y lo registra): el bot
 * tiene que poder contestar igual, empezando como si fuera un cliente nuevo.
 */
export async function cargarChat(db: SupabaseClient, igUserId: string, ahora: Date): Promise<EstadoChat> {
  try {
    const { data, error } = await db
      .from("ig_sesiones")
      .select("estado, pausa_hasta, perfil")
      .eq("ig_user_id", igUserId)
      .maybeSingle();

    if (error) {
      console.error("[bot] No se pudo leer la sesion:", error.message);
      return CHAT_VACIO();
    }
    if (!data) return CHAT_VACIO();

    const fila = data as { estado?: unknown; pausa_hasta?: unknown; perfil?: unknown };
    return {
      sesion: normalizarSesion(fila.estado, ahora),
      pausaHasta: aFecha(fila.pausa_hasta),
      perfil: aPerfil(fila.perfil),
    };
  } catch (e) {
    console.error("[bot] Fallo al leer la sesion:", e);
    return CHAT_VACIO();
  }
}

// Cada upsert manda SOLO las columnas que escribe: guardar la sesion no debe pisar
// la pausa ni el perfil, y viceversa.
export async function guardarSesion(db: SupabaseClient, igUserId: string, sesion: Sesion): Promise<void> {
  const { error } = await db
    .from("ig_sesiones")
    .upsert({ ig_user_id: igUserId, estado: sesion, actualizado: ahoraISO() }, { onConflict: "ig_user_id" });

  if (error) throw new Error(`No se pudo guardar la sesion: ${error.message}`);
}

export async function pausarChat(db: SupabaseClient, igUserId: string, hasta: Date): Promise<void> {
  const { error } = await db
    .from("ig_sesiones")
    .upsert({ ig_user_id: igUserId, pausa_hasta: hasta.toISOString(), actualizado: ahoraISO() }, { onConflict: "ig_user_id" });

  if (error) throw new Error(`No se pudo pausar el chat: ${error.message}`);
}

export async function guardarPerfil(db: SupabaseClient, igUserId: string, perfil: Perfil): Promise<void> {
  const { error } = await db
    .from("ig_sesiones")
    .upsert({ ig_user_id: igUserId, perfil, actualizado: ahoraISO() }, { onConflict: "ig_user_id" });

  if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`);
}

/** Auto al que apunta una historia de Instagram, o null si no se conoce (o si la base falla). */
export async function vehiculoDeHistoria(db: SupabaseClient, storyId: string): Promise<string | null> {
  const { data, error } = await db.from("ig_historias").select("vehiculo_id").eq("story_id", storyId).maybeSingle();

  if (error) {
    console.error("[bot] No se pudo leer la historia:", error.message);
    return null;
  }
  const id = (data as { vehiculo_id?: unknown } | null)?.vehiculo_id;
  return typeof id === "string" ? id : null;
}

/**
 * Aprende (o refuerza) el vinculo historia -> auto. Si ya apuntaba al mismo auto suma una
 * confirmacion; si apuntaba a otro, la ultima palabra del cliente reemplaza el vinculo.
 */
export async function aprenderHistoria(db: SupabaseClient, storyId: string, vehiculoId: string): Promise<void> {
  const { data, error: errorLectura } = await db
    .from("ig_historias")
    .select("vehiculo_id, confirmaciones")
    .eq("story_id", storyId)
    .maybeSingle();

  if (errorLectura) throw new Error(`No se pudo leer la historia: ${errorLectura.message}`);

  const existente = data as { vehiculo_id?: unknown; confirmaciones?: unknown } | null;
  if (existente && existente.vehiculo_id === vehiculoId) {
    const previas = typeof existente.confirmaciones === "number" ? existente.confirmaciones : 1;
    const { error } = await db
      .from("ig_historias")
      .update({ confirmaciones: previas + 1, actualizado: ahoraISO() })
      .eq("story_id", storyId);
    if (error) throw new Error(`No se pudo reforzar la historia: ${error.message}`);
    return;
  }

  const { error } = await db
    .from("ig_historias")
    .upsert(
      { story_id: storyId, vehiculo_id: vehiculoId, confirmaciones: 1, actualizado: ahoraISO() },
      { onConflict: "story_id" },
    );
  if (error) throw new Error(`No se pudo aprender la historia: ${error.message}`);
}

/** Borra un vinculo que el cliente desmintio ("no es ese"). */
export async function olvidarHistoria(db: SupabaseClient, storyId: string): Promise<void> {
  const { error } = await db.from("ig_historias").delete().eq("story_id", storyId);

  if (error) throw new Error(`No se pudo olvidar la historia: ${error.message}`);
}
