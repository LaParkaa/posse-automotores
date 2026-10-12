import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehiculoCatalogo } from "./types";

// Nunca se piden sale_price, sale_notes ni sold_at: son datos internos de la venta y
// el bot responde a clientes, asi que ni siquiera deben llegar a memoria.
const COLUMNAS =
  "id, slug, nombre, marca, modelo, anio, kilometraje, combustible, transmision, motor, tipo, descripcion, precio_texto, cover_image_url, estado, created_at";
// Dos consultas separadas: con una sola ordenada por created_at, una racha de autos vendidos mas
// nuevos desplazaria del limite a un auto disponible viejo y el bot diria que no lo tiene.
const LIMITE_EN_VENTA = 500;
const LIMITE_VENDIDOS = 60;

/**
 * Lee el catalogo publico para el bot: primero lo que esta en venta (disponible o reservado),
 * despues los vendidos mas recientes (el bot los nombra para decir "ese ya se vendio").
 * Devuelve null si la base falla (y lo registra): el llamador decide como degradar, esta funcion nunca lanza.
 */
export async function obtenerCatalogo(db: SupabaseClient): Promise<VehiculoCatalogo[] | null> {
  try {
    const [enVenta, vendidos] = await Promise.all([
      db
        .from("vehiculos_posse")
        .select(COLUMNAS)
        .in("estado", ["disponible", "reservado"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMITE_EN_VENTA),
      db
        .from("vehiculos_posse")
        .select(COLUMNAS)
        .eq("estado", "vendido")
        .is("deleted_at", null)
        // Se ordena por sold_at (dato interno) sin traerlo: ordenar no lo expone al bot.
        .order("sold_at", { ascending: false, nullsFirst: false })
        .limit(LIMITE_VENDIDOS),
    ]);

    const fallo = enVenta.error ?? vendidos.error;
    if (fallo) {
      console.error("[bot] No se pudo leer el catalogo:", fallo.message);
      return null;
    }
    return [...((enVenta.data ?? []) as VehiculoCatalogo[]), ...((vendidos.data ?? []) as VehiculoCatalogo[])];
  } catch (e) {
    console.error("[bot] Fallo al leer el catalogo:", e);
    return null;
  }
}
