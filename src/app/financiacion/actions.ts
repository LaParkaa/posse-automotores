"use server";
import { crearOperacionCredito } from "@/lib/creditos/data";

/**
 * Guarda la simulación pública como una operación "Simulado (Web)" para que un vendedor la
 * retome en /admin/creditos. Es best-effort: si falla, no tiene que frenar el envío del
 * WhatsApp del cliente, que es el objetivo principal del botón.
 */
export async function guardarSimulacionWeb(datos: {
  vehiculoDescripcion: string;
  clienteNombre: string;
  montoAFinanciar: number;
  plazoMeses: number;
  tnaAplicada: number;
  cuotaEstimada: number;
}) {
  try {
    await crearOperacionCredito({
      vehiculo_descripcion: datos.vehiculoDescripcion,
      precio_pactado: 0,
      moneda: "ARS",
      cliente_nombre: datos.clienteNombre,
      capital_a_financiar: datos.montoAFinanciar,
      plazo_meses: datos.plazoMeses,
      tna_aplicada: datos.tnaAplicada,
      gastos_aplicados_pct: 0,
      valor_cuota_pura: datos.cuotaEstimada,
      valor_cuota_final: datos.cuotaEstimada,
      estado: "Simulado (Web)",
    });
  } catch {
    // Best-effort: la simulación del cliente ya se envió por WhatsApp, no hace falta avisarle esto.
  }
}
