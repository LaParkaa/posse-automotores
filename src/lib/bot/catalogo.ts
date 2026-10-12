import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehiculoCatalogo } from "./types";

// Nunca se piden sale_price, sale_notes ni sold_at: son datos internos de la venta y
// el bot responde a clientes, asi que ni siquiera deben llegar a memoria.
const COLUMNAS =
  "id, slug, nombre, marca, modelo, anio, kilometraje, combustible, transmision, motor, tipo, descripcion, precio_texto, cover_image_url, estado, created_at";
const LIMITE_CATALOGO = 120;

/**
 * Lee el catalogo publico para el bot. Devuelve null si la base falla (y lo registra):
 * el llamador decide como degradar, esta funcion nunca lanza.
 */
export async function obtenerCatalogo(db: SupabaseClient): Promise<VehiculoCatalogo[] | null> {
  try {
    const { data, error } = await db
      .from("vehiculos_posse")
      .select(COLUMNAS)
      .in("estado", ["disponible", "reservado", "vendido"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIMITE_CATALOGO);

    if (error) {
      console.error("[bot] No se pudo leer el catalogo:", error.message);
      return null;
    }
    return (data ?? []) as VehiculoCatalogo[];
  } catch (e) {
    console.error("[bot] Fallo al leer el catalogo:", e);
    return null;
  }
}
