import { describe, expect, it } from "vitest";
import { calcularFinanciacion, cuotaSistemaFrances, cuotaTasaDirecta, tablaAmortizacion } from "./calculo";

describe("cuotaSistemaFrances", () => {
  it("calcula la cuota fija conocida para 100.000 a 24% TNA en 12 cuotas", () => {
    // i mensual = 0.02, cuota = 100000*0.02 / (1-1.02^-12) ≈ 9455.96
    expect(cuotaSistemaFrances(100000, 24, 12)).toBeCloseTo(9455.96, 1);
  });

  it("sin interés reparte el capital en partes iguales", () => {
    expect(cuotaSistemaFrances(12000, 0, 12)).toBe(1000);
  });

  it("plazo cero no calcula nada", () => {
    expect(cuotaSistemaFrances(1000, 24, 0)).toBe(0);
  });
});

describe("cuotaTasaDirecta", () => {
  it("cobra el interés simple sobre el capital original, prorrateado en el plazo", () => {
    // interés total = 100000 * 0.24 * (12/12) = 24000 -> cuota = 124000/12
    expect(cuotaTasaDirecta(100000, 24, 12)).toBeCloseTo(10333.33, 1);
  });
});

describe("tablaAmortizacion", () => {
  it("el saldo llega exactamente a 0 en la última cuota", () => {
    const tabla = tablaAmortizacion(100000, 24, 12);
    expect(tabla).toHaveLength(12);
    expect(tabla.at(-1)!.saldo).toBe(0);
  });

  it("la suma de capital amortizado es igual al capital original", () => {
    const tabla = tablaAmortizacion(50000, 45, 24);
    const totalCapital = tabla.reduce((acc, c) => acc + c.capital, 0);
    expect(totalCapital).toBeCloseTo(50000, 1);
  });

  it("el interés de cada cuota baja a medida que el saldo baja", () => {
    const tabla = tablaAmortizacion(100000, 24, 6);
    for (let i = 1; i < tabla.length; i++) {
      expect(tabla[i].interes).toBeLessThanOrEqual(tabla[i - 1].interes);
    }
  });
});

describe("calcularFinanciacion", () => {
  it("la cuota final (con gastos) es mayor o igual que la cuota pura", () => {
    const resultado = calcularFinanciacion({
      capitalAFinanciar: 100000,
      tnaPct: 45,
      gastosOtorgamientoPct: 5,
      plazoMeses: 24,
    });
    expect(resultado.cuotaFinal).toBeGreaterThan(resultado.cuotaPura);
    expect(resultado.capitalConGastos).toBe(105000);
    expect(resultado.tablaAmortizacion).toHaveLength(24);
  });

  it("sin gastos de otorgamiento, cuota pura y final coinciden", () => {
    const resultado = calcularFinanciacion({
      capitalAFinanciar: 100000,
      tnaPct: 45,
      gastosOtorgamientoPct: 0,
      plazoMeses: 24,
    });
    expect(resultado.cuotaFinal).toBe(resultado.cuotaPura);
  });
});
