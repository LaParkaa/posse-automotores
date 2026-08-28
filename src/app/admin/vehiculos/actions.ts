"use server";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { marcarVendido, deshacerVenta } from "@/app/panel/actions";

// La contabilidad de la venta (sold_at, sale_price, sale_notes) vive en las
// Server Actions del panel (src/app/panel/actions.ts). Delegamos acá en vez
// de reimplementarla para que este panel viejo no pueda desincronizarse del
// nuevo y volver a corromper esos campos.
export async function toggleEstado(id: string, estadoActual: string) {
  if (estadoActual === "vendido") {
    await deshacerVenta(id);
    return;
  }
  await marcarVendido(id, { precio: null, nota: null });
}

export async function softDeleteVehiculo(id: string) {
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("vehiculos_posse")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/panel");
}
