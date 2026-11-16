"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { calcularFinanciacion } from "@/lib/creditos/calculo";
import { actualizarOperacionCredito, crearRecibo } from "@/lib/creditos/data";
import { slugDeTipoDocumento } from "@/lib/creditos/documentos";
import type { EstadoOperacion, MedioPago, Moneda, TipoDocumento } from "@/lib/creditos/types";

function num(formData: FormData, campo: string): number {
  const valor = Number(formData.get(campo));
  return Number.isFinite(valor) ? valor : 0;
}

function texto(formData: FormData, campo: string): string | null {
  const valor = (formData.get(campo) as string | null)?.trim();
  return valor ? valor : null;
}

export async function actualizarOperacion(
  id: string,
  formData: FormData
): Promise<{ ok: false; error: string } | void> {
  const clienteNombre = texto(formData, "cliente_nombre");
  if (!clienteNombre || clienteNombre.length < 2) {
    return { ok: false, error: "Escribí el nombre del cliente" };
  }

  const moneda = (formData.get("moneda") as Moneda) ?? "ARS";
  const precioPactado = num(formData, "precio_pactado");
  const entregaEfectivo = num(formData, "entrega_efectivo");
  const entregaUsado = formData.get("entrega_usado") === "true";
  const valorToma = entregaUsado ? num(formData, "valor_toma") : 0;
  const plazoMeses = num(formData, "plazo_meses");
  const tnaAplicada = num(formData, "tna_aplicada");
  const gastosAplicados = num(formData, "gastos_aplicados_pct");
  const estado = (formData.get("estado") as EstadoOperacion) ?? "Simulado";

  const capitalAFinanciar = Math.max(precioPactado - entregaEfectivo - valorToma, 0);
  const resultado = calcularFinanciacion({
    capitalAFinanciar,
    tnaPct: tnaAplicada,
    gastosOtorgamientoPct: gastosAplicados,
    plazoMeses: plazoMeses || 1,
  });

  const actualizacion = await actualizarOperacionCredito(id, {
    vehiculo_descripcion: texto(formData, "vehiculo_descripcion"),
    precio_pactado: precioPactado,
    moneda,

    entrega_usado: entregaUsado,
    usado_marca: entregaUsado ? texto(formData, "usado_marca") : null,
    usado_modelo: entregaUsado ? texto(formData, "usado_modelo") : null,
    usado_anio: entregaUsado ? num(formData, "usado_anio") || null : null,
    usado_version: entregaUsado ? texto(formData, "usado_version") : null,
    usado_dominio: entregaUsado ? texto(formData, "usado_dominio") : null,
    usado_km: entregaUsado ? texto(formData, "usado_km") : null,
    valor_toma: entregaUsado ? valorToma : null,

    cliente_nombre: clienteNombre,
    cliente_dni_cuil: texto(formData, "cliente_dni_cuil"),
    cliente_whatsapp: texto(formData, "cliente_whatsapp"),
    cliente_email: texto(formData, "cliente_email"),
    cliente_domicilio: texto(formData, "cliente_domicilio"),
    cliente_localidad: texto(formData, "cliente_localidad"),
    situacion_laboral: texto(formData, "situacion_laboral"),
    notas_internas: texto(formData, "notas_internas"),

    entrega_efectivo: entregaEfectivo,
    capital_a_financiar: capitalAFinanciar,
    plan_id: texto(formData, "plan_id"),
    plazo_meses: plazoMeses || null,
    tna_aplicada: tnaAplicada,
    gastos_aplicados_pct: gastosAplicados,
    valor_cuota_pura: resultado.cuotaPura,
    valor_cuota_final: resultado.cuotaFinal,
    estado,
  });

  if (!actualizacion.ok) {
    return { ok: false, error: actualizacion.error };
  }

  revalidatePath(`/admin/creditos/${id}`);
  revalidatePath("/admin/creditos");
}

export async function generarDocumento(
  operacionId: string,
  tipoDocumento: TipoDocumento,
  monto: number | null,
  medioPago: MedioPago | null
) {
  await crearRecibo({ operacionId, tipoDocumento, monto, medioPago });
  revalidatePath(`/admin/creditos/${operacionId}`);
  redirect(`/admin/creditos/${operacionId}/imprimir/${slugDeTipoDocumento(tipoDocumento)}`);
}
