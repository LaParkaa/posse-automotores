"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { buildSlug } from "@/lib/utils";

/** Únicos valores de estado que acepta el check constraint de la tabla. */
const ESTADOS_VALIDOS = ["disponible", "reservado", "vendido"] as const;
type EstadoValido = (typeof ESTADOS_VALIDOS)[number];

function parseEstado(valor: FormDataEntryValue | null): EstadoValido {
  // El <select> del formulario es input no confiable: validamos contra la
  // lista real en vez de castear a ciegas, porque la tabla tiene un check
  // constraint que rechazaría con un error crudo de Postgres cualquier otra cosa.
  return ESTADOS_VALIDOS.includes(valor as EstadoValido) ? (valor as EstadoValido) : "disponible";
}

/**
 * Calcula los campos de venta (sold_at, sale_price, sale_notes) a partir del
 * estado elegido en el formulario y el sold_at que ya tenía la fila.
 * - Si el estado no es "vendido", se limpian los tres campos: un auto que
 *   vuelve al stock no puede conservar datos de una venta vieja.
 * - Si es "vendido", se conserva el sold_at existente (no se mueve la fecha
 *   al reguardar), o se usa la fecha/hora actual si todavía no tenía una.
 */
function camposDeVenta(estado: EstadoValido, soldAtActual: string | null) {
  if (estado !== "vendido") {
    return { sold_at: null, sale_price: null, sale_notes: null };
  }
  return { sold_at: soldAtActual ?? new Date().toISOString() };
}

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

  const estado = parseEstado(formData.get("estado"));

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
    estado,
    ...camposDeVenta(estado, null),
    badge: (formData.get("badge") as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/panel");
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

  // Si no podemos confirmar qué sold_at tenía la fila, abortamos. Seguir
  // asumiendo "no tenía venta previa" volvería a fechar hoy una venta vieja,
  // que es exactamente la corrupción que este archivo existe para evitar.
  const { data: filaActual, error: errorLectura } = await supabase
    .from("vehiculos_posse")
    .select("sold_at")
    .eq("id", id)
    .single();

  if (errorLectura) throw new Error(errorLectura.message);

  const estado = parseEstado(formData.get("estado"));

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
      estado,
      ...camposDeVenta(estado, filaActual?.sold_at ?? null),
      badge: (formData.get("badge") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/panel");
  redirect("/admin/vehiculos");
}
