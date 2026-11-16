import { describe, expect, it } from "vitest";
import { armarResumenOperacion, normalizarWhatsApp, urlWhatsAppOperacion } from "./mensajes";
import type { OperacionCredito } from "./types";

describe("normalizarWhatsApp", () => {
  it("agrega 549 cuando falta el código de país", () => {
    expect(normalizarWhatsApp("3537662444")).toBe("5493537662444");
  });

  it("agrega el 9 cuando viene con 54 pero sin el 9 de celular", () => {
    expect(normalizarWhatsApp("543537662444")).toBe("5493537662444");
  });

  it("respeta un número que ya viene completo", () => {
    expect(normalizarWhatsApp("5493537662444")).toBe("5493537662444");
  });

  it("saca el 0 inicial típico de los fijos", () => {
    expect(normalizarWhatsApp("03537662444")).toBe("5493537662444");
  });
});

const OPERACION_BASE: OperacionCredito = {
  id: "op-1",
  vehiculo_stock_id: null,
  vehiculo_ref_id: null,
  vehiculo_descripcion: "Volkswagen Gol Trend 2015",
  precio_pactado: 15000000,
  moneda: "ARS",
  entrega_usado: false,
  usado_marca: null,
  usado_modelo: null,
  usado_anio: null,
  usado_version: null,
  usado_dominio: null,
  usado_km: null,
  valor_toma: null,
  cliente_nombre: "Juan Pérez",
  cliente_dni_cuil: null,
  cliente_whatsapp: "3537662444",
  cliente_email: null,
  cliente_domicilio: null,
  cliente_localidad: null,
  situacion_laboral: null,
  notas_internas: null,
  entrega_efectivo: 0,
  capital_a_financiar: 10000000,
  plan_id: null,
  plazo_meses: 24,
  tna_aplicada: 45,
  gastos_aplicados_pct: 5,
  valor_cuota_pura: 500000,
  valor_cuota_final: 520000,
  estado: "Simulado",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("armarResumenOperacion / urlWhatsAppOperacion", () => {
  it("incluye vehículo, precio y cuota", () => {
    const resumen = armarResumenOperacion(OPERACION_BASE);
    expect(resumen).toContain("Volkswagen Gol Trend 2015");
    expect(resumen).toContain("24 cuotas");
  });

  it("usa el whatsapp del cliente, normalizado", () => {
    const url = urlWhatsAppOperacion(OPERACION_BASE);
    expect(url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
  });

  it("cae al whatsapp del local si el cliente no tiene uno", () => {
    const url = urlWhatsAppOperacion({ ...OPERACION_BASE, cliente_whatsapp: null });
    expect(url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
  });
});
