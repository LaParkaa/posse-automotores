import type { SupabaseClient } from "@supabase/supabase-js";

// Codigo de Postgres para "unique_violation".
const VIOLACION_UNICA = "23505";

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

/**
 * Guarda lo que el bot mando, una fila por mensaje con su mid. Ese mid es lo que despues
 * permite distinguir el eco de un mensaje propio del de una persona escribiendo desde la cuenta.
 */
export async function guardarSalida(
  db: SupabaseClient,
  igUserId: string,
  partes: Array<{ texto: string; mid: string | null }>,
): Promise<void> {
  if (partes.length === 0) return;

  const { error } = await db
    .from("ig_mensajes")
    .insert(partes.map((p) => ({ ig_user_id: igUserId, role: "assistant", content: p.texto, mid: p.mid })));

  if (error) throw new Error(`No se pudo guardar la salida: ${error.message}`);
}

/**
 * Meta devuelve al webhook los mensajes que manda la propia cuenta (eco). Si el mid esta
 * guardado lo mando el bot; si no, escribio una persona y hay que pausar el bot.
 * Ante un error de la base LANZA: devolver false pausaria el chat 6 horas por un fallo transitorio,
 * y quien llama prefiere no decidir antes que decidir mal.
 */
export async function esMidPropio(db: SupabaseClient, mid: string): Promise<boolean> {
  const { data, error } = await db.from("ig_mensajes").select("mid").eq("mid", mid).limit(1);

  if (error) throw new Error(`No se pudo verificar el mid propio: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

/** Deja una nota en el mensaje del cliente que el bot no entendio, para mejorar el diccionario. */
export async function marcarNoEntendido(db: SupabaseClient, mid: string): Promise<void> {
  try {
    const { error } = await db.from("ig_mensajes").update({ nota: "no_entendido" }).eq("mid", mid);
    if (error) console.error("[bot] No se pudo marcar el mensaje como no entendido:", error.message);
  } catch (e) {
    // Es solo una marca para analisis: nunca debe romper la respuesta al cliente.
    console.error("[bot] Fallo al marcar no entendido:", e);
  }
}
