"use server";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase";

function num(formData: FormData, campo: string): number {
  const valor = Number(formData.get(campo));
  return Number.isFinite(valor) ? valor : 0;
}

function texto(formData: FormData, campo: string): string {
  return ((formData.get(campo) as string | null) ?? "").trim();
}

function plazos(formData: FormData): number[] {
  return formData
    .getAll("plazos_habilitados")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function crearPlan(formData: FormData): Promise<{ ok: false; error: string } | void> {
  const nombre = texto(formData, "nombre");
  if (!nombre) return { ok: false, error: "Escribí el nombre del plan" };

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("planes_financiacion").insert({
    nombre,
    tna_pct: num(formData, "tna_pct"),
    gastos_otorgamiento_pct: num(formData, "gastos_otorgamiento_pct"),
    max_financiable_pct: num(formData, "max_financiable_pct") || 100,
    antiguedad_max_anios: num(formData, "antiguedad_max_anios") || null,
    plazos_habilitados: plazos(formData),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/creditos/tasas");
}

export async function actualizarPlan(id: string, formData: FormData): Promise<{ ok: false; error: string } | void> {
  const nombre = texto(formData, "nombre");
  if (!nombre) return { ok: false, error: "Escribí el nombre del plan" };

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("planes_financiacion")
    .update({
      nombre,
      tna_pct: num(formData, "tna_pct"),
      gastos_otorgamiento_pct: num(formData, "gastos_otorgamiento_pct"),
      max_financiable_pct: num(formData, "max_financiable_pct") || 100,
      antiguedad_max_anios: num(formData, "antiguedad_max_anios") || null,
      plazos_habilitados: plazos(formData),
      activo: formData.get("activo") === "true",
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/creditos/tasas");
}

export async function eliminarPlan(id: string) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("planes_financiacion").delete().eq("id", id);
  revalidatePath("/admin/creditos/tasas");
}
