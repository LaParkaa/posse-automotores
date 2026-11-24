import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_VEHICULOS, rutaEnBucket } from "@/lib/media-vendidos";
import type { ImagenDescargada } from "./descargar";

const CARPETA = "llaves/";

/** Borra del bucket la foto vieja de una llave. Es limpieza: si falla, solo queda un archivo de más. */
async function borrarFotoVieja(db: SupabaseClient, url: string | null): Promise<void> {
  const ruta = rutaEnBucket(url);
  if (!ruta || !ruta.startsWith(CARPETA)) return; // nunca toca fotos del auto ni de otras carpetas
  try {
    await db.storage.from(BUCKET_VEHICULOS).remove([ruta]);
  } catch (e) {
    console.error("[llaves] No se pudo borrar la foto vieja:", e instanceof Error ? e.message : e);
  }
}

/**
 * Sube la imagen al bucket de Posse (así el link nunca se rompe) y la deja como foto de la llave del auto.
 * Devuelve la dirección pública. Si falla la base, no deja el archivo huérfano.
 */
export async function guardarImagenLlave(
  db: SupabaseClient,
  id: string,
  imagen: ImagenDescargada,
  ahora: number = Date.now(),
): Promise<string> {
  const ruta = `${CARPETA}${id}-${ahora}.${imagen.ext}`;
  const subida = await db.storage.from(BUCKET_VEHICULOS).upload(ruta, imagen.bytes, {
    contentType: imagen.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (subida.error) throw new Error(`No se pudo subir la imagen: ${subida.error.message}`);

  const { data: publica } = db.storage.from(BUCKET_VEHICULOS).getPublicUrl(ruta);
  const url = publica.publicUrl;

  const { data: previo } = await db.from("vehiculos_posse").select("key_image_url").eq("id", id).maybeSingle();
  const { error } = await db.from("vehiculos_posse").update({ key_image_url: url }).eq("id", id);
  if (error) {
    await db.storage.from(BUCKET_VEHICULOS).remove([ruta]);
    throw new Error(`No se pudo guardar la llave: ${error.message}`);
  }

  await borrarFotoVieja(db, (previo?.key_image_url as string | null | undefined) ?? null);
  return url;
}

/** Deja al auto sin foto de llave y borra el archivo si era uno de los que sube este módulo. */
export async function quitarImagenLlave(db: SupabaseClient, id: string): Promise<void> {
  const { data: previo } = await db.from("vehiculos_posse").select("key_image_url").eq("id", id).maybeSingle();
  const { error } = await db.from("vehiculos_posse").update({ key_image_url: null }).eq("id", id);
  if (error) throw new Error(`No se pudo quitar la llave: ${error.message}`);
  await borrarFotoVieja(db, (previo?.key_image_url as string | null | undefined) ?? null);
}
