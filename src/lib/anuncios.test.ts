import { describe, expect, it } from "vitest";
import { ANUNCIOS_INSTAGRAM, pesos, porcentajeGastado } from "./anuncios";

describe("anuncios cargados a mano", () => {
  it("el costo por visita coincide con gasto / visitas (detecta un numero mal copiado)", () => {
    for (const a of ANUNCIOS_INSTAGRAM) {
      expect(a.gasto / a.visitasSitio).toBeCloseTo(a.costoPorVisita, 1);
    }
  });

  it("no se gasta mas que el tope y hay mas clics que visitas efectivas", () => {
    for (const a of ANUNCIOS_INSTAGRAM) {
      expect(a.gasto).toBeLessThanOrEqual(a.presupuesto);
      expect(a.clicsEnlace).toBeGreaterThanOrEqual(a.visitasSitio);
    }
  });
});

describe("pesos", () => {
  it("usa punto de miles y coma de decimales", () => {
    expect(pesos(7979.4)).toBe("$7.979,40");
    expect(pesos(55.8)).toBe("$55,80");
  });

  it("no muestra centavos si el monto es redondo", () => {
    expect(pesos(10000)).toBe("$10.000");
  });
});

describe("porcentajeGastado", () => {
  it("calcula la parte del tope y no pasa de 100", () => {
    expect(porcentajeGastado({ gasto: 7979.4, presupuesto: 10000 })).toBe(80);
    expect(porcentajeGastado({ gasto: 12000, presupuesto: 10000 })).toBe(100);
    expect(porcentajeGastado({ gasto: 100, presupuesto: 0 })).toBe(0);
  });
});
