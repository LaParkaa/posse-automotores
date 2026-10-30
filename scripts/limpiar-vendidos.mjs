// Deja a los autos vendidos (y a los borrados) solo con la portada: borra del bucket el resto de las
// fotos y los videos. Los autos que se venden de ahora en más se limpian solos al marcarlos vendidos.
//
//   node --env-file=.env.local scripts/limpiar-vendidos.mjs              -> solo muestra qué borraría
//   node --env-file=.env.local scripts/limpiar-vendidos.mjs --confirmar  -> borra de verdad
import { createClient } from "@supabase/supabase-js";

const BUCKET = "vehiculos-posse";
const confirmar = process.argv.includes("--confirmar");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ruta = (url) => {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length));
};

const { data: autos, error } = await db
  .from("vehiculos_posse")
  .select("id, nombre, estado, deleted_at, cover_image_url, imagenes, videos")
  .or("estado.eq.vendido,deleted_at.not.is.null");
if (error) throw error;

let total = 0;
for (const v of autos) {
  const portada = v.cover_image_url ?? v.imagenes?.[0] ?? null;
  const rutaPortada = ruta(portada);
  const rutas = [...new Set([...(v.imagenes ?? []), ...(v.videos ?? [])].map(ruta).filter((r) => r && r !== rutaPortada))];
  if (rutas.length === 0) continue;
  total += rutas.length;
  console.log(`${v.nombre}: ${rutas.length} archivo(s)`);
  if (!confirmar) continue;

  // Primero la fila y después los archivos: si el borrado falla queda basura, nunca una foto rota en la web.
  const { error: errorFila } = await db
    .from("vehiculos_posse")
    .update({ cover_image_url: portada, imagenes: portada ? [portada] : [], videos: [] })
    .eq("id", v.id);
  if (errorFila) throw errorFila;
  const { error: errorBorrado } = await db.storage.from(BUCKET).remove(rutas);
  if (errorBorrado) throw errorBorrado;
}

console.log(confirmar ? `\nListo: ${total} archivos borrados.` : `\n${total} archivos para borrar. Corré con --confirmar para borrarlos.`);
