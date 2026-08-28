"use server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

const RUTAS = ["/", "/catalogo", "/panel", "/admin/vehiculos"];

function revalidar() {
  // El callback explícito importa: revalidatePath toma un segundo parámetro
  // ("page" | "layout") y pasarle el índice del forEach rompería la llamada.
  RUTAS.forEach((ruta) => revalidatePath(ruta));
}

async function actualizar(id: string, campos: Record<string, unknown>): Promise<ResultadoAccion> {
  await requireAdminSession();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("vehiculos_posse").update(campos).eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true };
}

/** Campos de venta en blanco: un auto que vuelve al stock no conserva la venta. */
const SIN_VENTA = { sold_at: null, sale_price: null, sale_notes: null };

export async function cambiarEstado(
  id: string,
  estado: "disponible" | "reservado"
): Promise<ResultadoAccion> {
  return actualizar(id, { estado, ...SIN_VENTA });
}

export async function marcarVendido(
  id: string,
  datos: { precio: number | null; nota: string | null }
): Promise<ResultadoAccion> {
  return actualizar(id, {
    estado: "vendido",
    sold_at: new Date().toISOString(),
    sale_price: datos.precio,
    sale_notes: datos.nota,
  });
}

export async function deshacerVenta(id: string): Promise<ResultadoAccion> {
  return actualizar(id, { estado: "disponible", ...SIN_VENTA });
}
