import { createAdminSupabaseClient } from "./supabase";
import type { Vehiculo } from "./types";

export async function getVehiculosDisponibles(): Promise<Vehiculo[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("estado", "disponible")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getVehiculosVendidos(): Promise<Vehiculo[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("estado", "vendido")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getVehiculoBySlug(slug: string): Promise<Vehiculo | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("slug", slug)
    .eq("estado", "disponible")
    .is("deleted_at", null)
    .single();
  if (error) return null;
  return data;
}

export async function getAllVehiculos(): Promise<Vehiculo[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getVehiculoById(id: string): Promise<Vehiculo | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) return null;
  return data;
}

export async function countVehiculos(): Promise<{ total: number; disponibles: number; vendidos: number }> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("vehiculos")
    .select("estado")
    .is("deleted_at", null);
  const all = data ?? [];
  return {
    total: all.length,
    disponibles: all.filter((v) => v.estado === "disponible").length,
    vendidos: all.filter((v) => v.estado === "vendido").length,
  };
}
