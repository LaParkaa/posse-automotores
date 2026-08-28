"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { buildSlug } from "@/lib/utils";

/**
 * El slug tiene unique constraint. Si ya existe un vehiculo con el mismo
 * nombre y anio (otra unidad del mismo modelo), le agrega un sufijo -2, -3, etc.
 */
async function buildUniqueSlug(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  base: string,
  excludeId?: string
) {
  let query = supabase
    .from("vehiculos_posse")
    .select("slug")
    .like("slug", `${base}%`);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const ocupados = new Set((data ?? []).map((v) => v.slug));
  if (!ocupados.has(base)) return base;

  let n = 2;
  while (ocupados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function createVehiculo(formData: FormData) {
  const supabase = createAdminSupabaseClient();
  const nombre = formData.get("nombre") as string;
  const anio = Number(formData.get("anio"));
  const slug = await buildUniqueSlug(supabase, buildSlug(nombre, anio));

  const imagenesRaw = formData.get("imagenes") as string;
  const imagenes = imagenesRaw
    ? imagenesRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const coverImageUrl = imagenes[0] ?? null;

  const videosRaw = formData.get("videos") as string;
  const videos = videosRaw
    ? videosRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const { error } = await supabase.from("vehiculos_posse").insert({
    slug,
    nombre,
    marca: formData.get("marca") as string,
    modelo: formData.get("modelo") as string,
    anio,
    kilometraje: (formData.get("kilometraje") as string) || "Consultá km",
    combustible: formData.get("combustible") as string,
    transmision: formData.get("transmision") as string,
    motor: (formData.get("motor") as string) || null,
    tipo: (formData.get("tipo") as string) || null,
    descripcion: (formData.get("descripcion") as string) || null,
    precio_texto: (formData.get("precio_texto") as string) || "Consultá precio",
    cover_image_url: coverImageUrl,
    imagenes,
    videos,
    estado: (formData.get("estado") as string) || "disponible",
    badge: (formData.get("badge") as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
  redirect("/admin/vehiculos");
}

export async function updateVehiculo(id: string, formData: FormData) {
  const supabase = createAdminSupabaseClient();
  const nombre = formData.get("nombre") as string;
  const anio = Number(formData.get("anio"));
  const slug = await buildUniqueSlug(supabase, buildSlug(nombre, anio), id);

  const imagenesRaw = formData.get("imagenes") as string;
  const imagenes = imagenesRaw
    ? imagenesRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const coverImageUrl = imagenes[0] ?? null;

  const videosRaw = formData.get("videos") as string;
  const videos = videosRaw
    ? videosRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const { error } = await supabase
    .from("vehiculos_posse")
    .update({
      slug,
      nombre,
      marca: formData.get("marca") as string,
      modelo: formData.get("modelo") as string,
      anio,
      kilometraje: (formData.get("kilometraje") as string) || "Consultá km",
      combustible: formData.get("combustible") as string,
      transmision: formData.get("transmision") as string,
      motor: (formData.get("motor") as string) || null,
      tipo: (formData.get("tipo") as string) || null,
      descripcion: (formData.get("descripcion") as string) || null,
      precio_texto: (formData.get("precio_texto") as string) || "Consultá precio",
      cover_image_url: coverImageUrl,
      imagenes,
      videos,
      estado: (formData.get("estado") as string) || "disponible",
      badge: (formData.get("badge") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
  redirect("/admin/vehiculos");
}
