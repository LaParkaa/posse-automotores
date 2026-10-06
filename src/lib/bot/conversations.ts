import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurnoHistorial } from "./types";

// Suficiente contexto para una charla de ventas sin pagar tokens de mas.
const LIMITE_HISTORIAL = 10;
// Codigo de Postgres para "unique_violation".
const VIOLACION_UNICA = "23505";

/**
 * Deja el historial en la forma que exige la API de Claude: empieza con un turno
 * del usuario y no repite rol seguido. Al cortar los ultimos N mensajes puede
 * quedar una respuesta del bot al principio, o dos mensajes del cliente juntos.
 */
export function normalizarHistorial(filas: TurnoHistorial[]): TurnoHistorial[] {
  const resultado: TurnoHistorial[] = [];

  for (const fila of filas) {
    if (resultado.length === 0 && fila.role !== "user") continue;

    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.role === fila.role) {
      ultimo.content += `\n${fila.content}`;
    } else {
      resultado.push({ role: fila.role, content: fila.content });
    }
  }

  return resultado;
}

/**
 * Registra el mensaje del cliente. Devuelve false si ya estaba (Meta reintenta los
 * webhooks que tardan en responder): asi nunca se contesta dos veces lo mismo.
 * El insert con unique sobre "mid" hace de candado atomico entre invocaciones.
 */
export async function reclamarMensaje(
  db: SupabaseClient,
  igUserId: string,
  mid: string,
  contenido: string,
): Promise<boolean> {
  const { error } = await db
    .from("ig_mensajes")
    .insert({ mid, ig_user_id: igUserId, role: "user", content: contenido });

  if (!error) return true;
  if (error.code === VIOLACION_UNICA) return false;
  throw new Error(`No se pudo registrar el mensaje: ${error.message}`);
}

export async function obtenerHistorial(db: SupabaseClient, igUserId: string): Promise<TurnoHistorial[]> {
  const { data, error } = await db
    .from("ig_mensajes")
    .select("role, content")
    .eq("ig_user_id", igUserId)
    .order("created_at", { ascending: false })
    .limit(LIMITE_HISTORIAL);

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);

  // Se pide del mas nuevo al mas viejo para quedarse con los ultimos N; se da vuelta para la IA.
  return normalizarHistorial([...((data ?? []) as TurnoHistorial[])].reverse());
}

export async function guardarRespuesta(db: SupabaseClient, igUserId: string, texto: string): Promise<void> {
  const { error } = await db
    .from("ig_mensajes")
    .insert({ ig_user_id: igUserId, role: "assistant", content: texto });

  if (error) throw new Error(`No se pudo guardar la respuesta: ${error.message}`);
}
