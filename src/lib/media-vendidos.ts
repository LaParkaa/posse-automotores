import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_VEHICULOS = "vehiculos-posse";

type Media = { cover_image_url: string | null; imagenes: string[] | null; videos: string[] | null };

/** Ruta dentro del bucket de una URL pública; null si la foto vive en otro lado (p. ej. /public). */
export function rutaEnBucket(url: string | null): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${BUCKET_VEHICULOS}/`;
  const i = url.indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length));
}

/**
 * Un auto vendido solo conserva la portada: el resto de las fotos y todos los videos
 * se borran del bucket. Devuelve las rutas a borrar y cómo queda la fila.
 */
export function sobrantesDeVendido(v: Media): { rutas: string[]; imagenes: string[]; videos: string[] } {
  const portada = v.cover_image_url ?? v.imagenes?.[0] ?? null;
  const rutaPortada = rutaEnBucket(portada);
  const rutas = [...(v.imagenes ?? []), ...(v.videos ?? [])]
    .map(rutaEnBucket)
    .filter((r): r is string => r !== null && r !== rutaPortada);
  return { rutas: [...new Set(rutas)], imagenes: portada ? [portada] : [], videos: [] };
}

/**
 * Deja al auto vendido solo con la portada. Primero actualiza la fila y después borra los archivos:
 * si el borrado falla queda basura en el bucket, nunca una foto rota en la web.
 * No lanza: es limpieza, y no debe trabar el registro de la venta.
 */
export async function limpiarMediaDeVendido(db: SupabaseClient, id: string): Promise<number> {
  try {
    const { data, error } = await db
      .from("vehiculos_posse")
      .select("estado, cover_image_url, imagenes, videos")
      .eq("id", id)
      .single();
    if (error || !data || data.estado !== "vendido") return 0;

    const { rutas, imagenes, videos } = sobrantesDeVendido(data);
    if ((data.imagenes ?? []).length === imagenes.length && (data.videos ?? []).length === 0 && rutas.length === 0) return 0;

    const { error: errorFila } = await db
      .from("vehiculos_posse")
      .update({ cover_image_url: imagenes[0] ?? null, imagenes, videos })
      .eq("id", id);
    if (errorFila) throw errorFila;

    if (rutas.length > 0) {
      const { error: errorBorrado } = await db.storage.from(BUCKET_VEHICULOS).remove(rutas);
      if (errorBorrado) throw errorBorrado;
    }
    return rutas.length;
  } catch (err) {
    console.error(`[vendidos] No se pudo limpiar la media del auto ${id}:`, err);
    return 0;
  }
}
