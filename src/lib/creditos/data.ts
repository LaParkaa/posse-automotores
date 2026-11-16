import { createAdminSupabaseClient } from "@/lib/supabase";
import type {
  CategoriaVehiculoRef,
  EstadoOperacion,
  MedioPago,
  OperacionCredito,
  PlanFinanciacion,
  PlanFinanciacionPublico,
  ReciboDocumento,
  TipoDocumento,
  VehiculoRef,
} from "./types";

// Esta capa es de datos administrativos (no de catálogo público), así que, a diferencia de
// src/lib/data.ts, no tiene fallback local: si Supabase falla, la página de /admin/creditos
// tiene que mostrar el error, no datos de muestra.

export async function getPlanesFinanciacion(): Promise<PlanFinanciacion[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("planes_financiacion")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/** Planes activos para el simulador público: sin el desglose de gastos de otorgamiento (margen interno). */
export async function getPlanesActivosPublicos(): Promise<PlanFinanciacionPublico[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("planes_financiacion_publicos")
    .select("*");
  if (error) throw new Error(error.message);
  return data;
}

export async function getCatalogoVehiculosRef(categoria?: CategoriaVehiculoRef): Promise<VehiculoRef[]> {
  const supabase = createAdminSupabaseClient();
  let query = supabase.from("catalogo_vehiculos_ref").select("*").eq("activo", true);
  if (categoria) query = query.eq("categoria", categoria);
  const { data, error } = await query.order("marca", { ascending: true }).order("modelo", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export type FiltroOperaciones = {
  estado?: EstadoOperacion;
  busqueda?: string;
};

export async function getOperacionesCredito(filtro: FiltroOperaciones = {}): Promise<OperacionCredito[]> {
  const supabase = createAdminSupabaseClient();
  let query = supabase.from("operaciones_credito").select("*").order("created_at", { ascending: false });
  if (filtro.estado) query = query.eq("estado", filtro.estado);
  if (filtro.busqueda) {
    const texto = filtro.busqueda.trim();
    query = query.or(
      `cliente_nombre.ilike.%${texto}%,cliente_dni_cuil.ilike.%${texto}%,vehiculo_descripcion.ilike.%${texto}%`
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getOperacionCreditoById(id: string): Promise<OperacionCredito | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("operaciones_credito").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

export async function getKpisCreditos(): Promise<{
  simulacionesDelMes: number;
  aprobadas: number;
  capitalTotalFinanciado: number;
}> {
  const supabase = createAdminSupabaseClient();
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("operaciones_credito")
    .select("estado, capital_a_financiar, created_at");
  if (error) throw new Error(error.message);

  const simulacionesDelMes = data.filter((o) => new Date(o.created_at) >= inicioMes).length;
  const aprobadas = data.filter((o) => o.estado === "Aprobado" || o.estado === "Liquidado / Entregado").length;
  const capitalTotalFinanciado = data
    .filter((o) => o.estado === "Aprobado" || o.estado === "Liquidado / Entregado")
    .reduce((acc, o) => acc + Number(o.capital_a_financiar ?? 0), 0);

  return { simulacionesDelMes, aprobadas, capitalTotalFinanciado };
}

export async function crearOperacionCredito(
  datos: Partial<OperacionCredito>
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("operaciones_credito").insert(datos).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function actualizarOperacionCredito(
  id: string,
  datos: Partial<OperacionCredito>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("operaciones_credito")
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getRecibosDeOperacion(operacionId: string): Promise<ReciboDocumento[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("recibos_documentos")
    .select("*")
    .eq("operacion_id", operacionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getRecibosPorTipo(
  operacionId: string,
  tipoDocumento: TipoDocumento
): Promise<ReciboDocumento | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("recibos_documentos")
    .select("*")
    .eq("operacion_id", operacionId)
    .eq("tipo_documento", tipoDocumento)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function crearRecibo(datos: {
  operacionId: string;
  tipoDocumento: TipoDocumento;
  monto?: number | null;
  medioPago?: MedioPago | null;
}): Promise<ReciboDocumento> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("recibos_documentos")
    .insert({
      operacion_id: datos.operacionId,
      tipo_documento: datos.tipoDocumento,
      monto: datos.monto ?? null,
      medio_pago: datos.medioPago ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
