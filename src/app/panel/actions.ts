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

/** Los únicos estados a los que puede volver un auto sin registrar una venta. */
const ESTADOS_EN_STOCK = ["disponible", "reservado"] as const;
type EstadoEnStock = (typeof ESTADOS_EN_STOCK)[number];

export async function cambiarEstado(
  id: string,
  estado: EstadoEnStock
): Promise<ResultadoAccion> {
  // Una Server Action es un endpoint POST público: el tipo de TypeScript no
  // frena a quien la llame por fuera del cliente. Sin esta validación se podría
  // dejar un auto en "vendido" con sold_at nulo, que es justo lo que las
  // métricas de ventas descartan.
  if (!ESTADOS_EN_STOCK.includes(estado)) {
    return { ok: false, error: "Estado inválido" };
  }

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
