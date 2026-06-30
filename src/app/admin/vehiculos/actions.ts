"use server";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase";

export async function toggleEstado(id: string, estadoActual: string) {
  const nuevoEstado = estadoActual === "disponible" ? "vendido" : "disponible";
  const supabase = createAdminSupabaseClient();
  await supabase.from("vehiculos").update({ estado: nuevoEstado }).eq("id", id);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
}

export async function softDeleteVehiculo(id: string) {
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("vehiculos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
}
