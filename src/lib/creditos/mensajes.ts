import { formatMoneda } from "./formato";
import type { OperacionCredito } from "./types";

/**
 * Mejor esfuerzo para armar un link de wa.me a partir de lo que un vendedor tipeó como
 * teléfono del cliente (con o sin 0, con o sin 15, con o sin código de país).
 */
export function normalizarWhatsApp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("549")) return digitos;
  if (digitos.startsWith("54")) return `549${digitos.slice(2)}`;
  return `549${digitos.replace(/^0/, "")}`;
}

/** Resumen de la operación para mandarle al cliente por WhatsApp (link wa.me pre-armado). */
export function armarResumenOperacion(op: OperacionCredito): string {
  const lineas = [
    `¡Hola ${op.cliente_nombre || ""}! Te paso el resumen de tu operación con Posse Automotores:`,
    "",
    `🚗 Vehículo: ${op.vehiculo_descripcion ?? "A confirmar"}`,
    `💰 Precio: ${formatMoneda(op.precio_pactado, op.moneda)}`,
  ];

  if (op.entrega_usado) {
    lineas.push(
      `🔄 Toma de usado: ${op.usado_marca ?? ""} ${op.usado_modelo ?? ""} ${op.usado_anio ?? ""} — ${formatMoneda(op.valor_toma ?? 0, op.moneda)}`
    );
  }

  if (op.plazo_meses && op.valor_cuota_final) {
    lineas.push(`🗓️ Plan: ${op.plazo_meses} cuotas de ${formatMoneda(op.valor_cuota_final, op.moneda)}`);
  }

  lineas.push("", `Estado actual: ${op.estado}`, "", "Quedamos a disposición para cualquier consulta.");
  return lineas.join("\n");
}

export function urlWhatsAppOperacion(op: OperacionCredito): string {
  const numero = op.cliente_whatsapp ? normalizarWhatsApp(op.cliente_whatsapp) : "5493537662444";
  return `https://wa.me/${numero}?text=${encodeURIComponent(armarResumenOperacion(op))}`;
}
