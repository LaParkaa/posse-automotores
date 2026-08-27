import { createAdminSupabaseClient } from "./supabase";
import type { Vehiculo } from "./types";
import vehiculosLocales from "../../vehiculos.json";

type VehiculoLocal = {
  slug: string;
  nombre: string;
  marca: string;
  modelo: string;
  anio: string;
  kilometraje: string;
  combustible: string;
  transmision: string;
  motor?: string;
  tipo?: string;
  descripcion?: string;
  imagenes?: string[];
  videos?: string[];
  estado?: "disponible" | "vendido";
};

const localVehiculos: Vehiculo[] = (vehiculosLocales as VehiculoLocal[]).map((v, index) => {
  const cover = v.imagenes?.[0] ? `/${v.imagenes[0]}` : null;

  return {
    id: `local-${v.slug}`,
    slug: v.slug,
    nombre: v.nombre,
    marca: v.marca,
    modelo: v.modelo,
    anio: Number.parseInt(v.anio, 10) || new Date().getFullYear(),
    kilometraje: v.kilometraje,
    combustible: v.combustible,
    transmision: v.transmision,
    motor: v.motor ?? null,
    tipo: v.tipo ?? "Auto",
    descripcion: v.descripcion ?? null,
    precio_texto: "Consultar",
    cover_image_url: cover,
    imagenes: v.imagenes?.map((img) => `/${img}`) ?? [],
    videos: v.videos?.map((vid) => `/${vid}`) ?? [],
    estado: v.estado ?? "disponible",
    badge: index === 0 ? "Destacado" : null,
    created_at: new Date(Date.now() - index * 1000).toISOString(),
    deleted_at: null,
    sold_at: null,
    sale_price: null,
    sale_notes: null,
  };
});

async function withLocalFallback<T>(query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (error) {
    console.warn("No se pudo conectar a Supabase. Usando datos locales de muestra.", error);
    return fallback;
  }
}

export async function getVehiculosDisponibles(): Promise<Vehiculo[]> {
  return withLocalFallback((async () => {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("vehiculos_posse")
      .select("*")
      .in("estado", ["disponible", "reservado"])
      .is("deleted_at", null)
      .order("estado", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  })(), localVehiculos.filter((v) => v.estado !== "vendido"));
}

export async function getVehiculosVendidos(): Promise<Vehiculo[]> {
  return withLocalFallback((async () => {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("vehiculos_posse")
      .select("*")
      .eq("estado", "vendido")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  })(), localVehiculos.filter((v) => v.estado === "vendido"));
}

export async function getVehiculoBySlug(slug: string): Promise<Vehiculo | null> {
  return withLocalFallback((async () => {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("vehiculos_posse")
      .select("*")
      .eq("slug", slug)
      .in("estado", ["disponible", "reservado"])
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data;
  })(), localVehiculos.find((v) => v.slug === slug) ?? null);
}

export async function getAllVehiculos(): Promise<Vehiculo[]> {
  return withLocalFallback((async () => {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("vehiculos_posse")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  })(), localVehiculos);
}

export async function getVehiculoById(id: string): Promise<Vehiculo | null> {
  return withLocalFallback((async () => {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("vehiculos_posse")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data;
  })(), localVehiculos.find((v) => v.id === id) ?? null);
}

export async function countVehiculos(): Promise<{ total: number; disponibles: number; vendidos: number }> {
  return withLocalFallback((async () => {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("vehiculos_posse")
      .select("estado")
      .is("deleted_at", null);
    const all = data ?? [];
    return {
      total: all.length,
      disponibles: all.filter((v) => v.estado === "disponible").length,
      vendidos: all.filter((v) => v.estado === "vendido").length,
    };
  })(), {
    total: localVehiculos.length,
    disponibles: localVehiculos.filter((v) => v.estado === "disponible").length,
    vendidos: localVehiculos.filter((v) => v.estado === "vendido").length,
  });
}
