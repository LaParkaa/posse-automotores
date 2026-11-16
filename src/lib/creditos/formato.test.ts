import { describe, expect, it } from "vitest";
import { formatARS, formatUSD, montoEnLetras, numeroALetras } from "./formato";

describe("formatARS / formatUSD", () => {
  it("formatea con separador de miles es-AR", () => {
    expect(formatARS(15400000)).toBe("$ 15.400.000");
    expect(formatUSD(14500)).toBe("USD 14.500");
  });

  it("redondea decimales", () => {
    expect(formatARS(1000.6)).toBe("$ 1.001");
  });
});

describe("numeroALetras", () => {
  it("convierte números simples", () => {
    expect(numeroALetras(0)).toBe("cero");
    expect(numeroALetras(1)).toBe("uno");
    expect(numeroALetras(21)).toBe("veintiuno");
    expect(numeroALetras(100)).toBe("cien");
    expect(numeroALetras(101)).toBe("ciento uno");
    expect(numeroALetras(1000)).toBe("mil");
  });

  it("convierte montos grandes típicos de una venta", () => {
    expect(numeroALetras(15400000)).toBe("quince millones cuatrocientos mil");
    expect(numeroALetras(1000000)).toBe("un millón");
  });
});

describe("montoEnLetras", () => {
  it("agrega la moneda y los centavos", () => {
    expect(montoEnLetras(15400000, "ARS")).toBe("Quince millones cuatrocientos mil pesos con 00/100");
    expect(montoEnLetras(1500.5, "USD")).toBe("Mil quinientos dólares con 50/100");
  });
});
