import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadInput } from "../types";
import { normalizarEstado, type EstadoWeb } from "./asistente";
import { esSlugValido } from "./pedido";

/** Una fila de `web_mensajes` (sin el visitante, que se agrega al guardar). */
export type FilaMensajeWeb = {
  role: "user" | "assistant";
  content: string;
  tipo: "texto" | "tarjetas" | "cierre";
  via: "opcion" | "texto" | null;
  vehiculo_slug: string | null;
  nota: string | null;
};

const ahoraISO = () => new Date().toISOString();

/**
 * Estado guardado del visitante, o null si no hay (o si pasaron más de 24 h: charla nueva). Lo que está en la base
 * no se da por bueno: la sesión, el guion y la ficha se normalizan y lo inválido se descarta. Si la base falla, lanza.
 */
export async function cargarEstadoWeb(db: SupabaseClient, visitante: string, ahora: Date): Promise<EstadoWeb | null> {
  const { data, error } = await db
    .from("web_sesiones")
    .select("estado, guion, ficha")
    .eq("visitante", visitante)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer la sesion web: ${error.message}`);
  if (!data) return null;

  const fila = data as { estado?: unknown; guion?: unknown; ficha?: unknown };
  const estado = normalizarEstado({ sesion: fila.estado, guion: fila.guion, ficha: esSlugValido(fila.ficha) ? fila.ficha : null }, ahora);
  return estado ? { ...estado, ficha: estado.ficha ?? null } : null;
}

/** Guarda (o reemplaza) el estado del visitante. `ficha` ausente o que no sea un slug se guarda como null. */
export async function guardarEstadoWeb(db: SupabaseClient, visitante: string, e: EstadoWeb): Promise<void> {
  const { error } = await db
    .from("web_sesiones")
    .upsert(
      { visitante, estado: e.sesion, guion: e.guion, ficha: esSlugValido(e.ficha) ? e.ficha : null, actualizado: ahoraISO() },
      { onConflict: "visitante" },
    );

  if (error) throw new Error(`No se pudo guardar la sesion web: ${error.message}`);
}

export async function guardarMensajesWeb(db: SupabaseClient, visitante: string, filas: FilaMensajeWeb[]): Promise<void> {
  if (filas.length === 0) return;
  const { error } = await db.from("web_mensajes").insert(filas.map((f) => ({ visitante, ...f })));

  if (error) throw new Error(`No se pudieron guardar los mensajes web: ${error.message}`);
}

/** Cuántos mensajes del cliente (role "user") hay desde `desde`; de un visitante si se pasa, de todos si no. */
export async function contarMensajesWeb(db: SupabaseClient, desde: Date, visitante?: string): Promise<number> {
  let consulta = db
    .from("web_mensajes")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", desde.toISOString());
  if (visitante !== undefined) consulta = consulta.eq("visitante", visitante);

  const { count, error } = await consulta;

  if (error) throw new Error(`No se pudieron contar los mensajes web: ${error.message}`);
  return count ?? 0;
}

/**
 * Guarda el lead en la tabla que lee /admin/leads, con origen "web". El teléfono va en `telefono` (lo que muestra el
 * admin) y en `whatsapp` (así se cumple leads_contacto_check); `instagram_id` queda vacío. Si ya hay un lead web con
 * ese teléfono no se duplica (el motor puede volver a pedir guardarlo en un mensaje posterior).
 */
export async function guardarLeadWeb(db: SupabaseClient, _visitante: string, lead: LeadInput): Promise<void> {
  const { data: existentes, error: errorBusqueda } = await db
    .from("leads")
    .select("id")
    .eq("origen", "web")
    .eq("telefono", lead.telefono)
    .limit(1);

  if (errorBusqueda) throw new Error(`No se pudo buscar el lead: ${errorBusqueda.message}`);
  if (existentes && existentes.length > 0) return;

  const { error } = await db.from("leads").insert({
    nombre: lead.nombre,
    telefono: lead.telefono,
    whatsapp: lead.telefono,
    vehiculo_interes: lead.vehiculo_interes ?? null,
    mensaje: lead.mensaje ?? null,
    origen: "web",
  });

  if (error) throw new Error(`No se pudo guardar el lead: ${error.message}`);
}
