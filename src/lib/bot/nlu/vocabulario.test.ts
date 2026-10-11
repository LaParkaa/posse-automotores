import { describe, expect, it } from "vitest";
import {
  ALIAS_MARCA,
  aplicarFrases,
  claveTipo,
  SINONIMOS_COMBUSTIBLE,
  SINONIMOS_TIPO,
  SINONIMOS_TRANSMISION,
} from "./vocabulario";

describe("claveTipo", () => {
  it.each([
    ["Pick-up", "pickup"],
    ["Sedán", "sedan"],
    ["SUV", "suv"],
    ["Utilitario", "utilitario"],
    ["Moto", "moto"],
  ])("%s → %s", (tipo, clave) => {
    expect(claveTipo(tipo)).toBe(clave);
  });
});

describe("aplicarFrases", () => {
  it("junta las expresiones de varias palabras en una sola", () => {
    expect(aplicarFrases("busco una pick up nafta")).toBe("busco una pickup nafta");
    expect(aplicarFrases("quiero gas oil")).toBe("quiero gasoil");
    expect(aplicarFrases("un cero km")).toBe("un 0km");
  });
});

describe("sinonimos de tipo", () => {
  it("entiende las formas coloquiales", () => {
    expect(SINONIMOS_TIPO["chatita"]).toContain("utilitario");
    expect(SINONIMOS_TIPO["furgon"]).toContain("utilitario");
    expect(SINONIMOS_TIPO["pickup"]).toContain("pickup");
    expect(SINONIMOS_TIPO["hilux"]).toContain("pickup");
    expect(SINONIMOS_TIPO["moto"]).toContain("moto");
    expect(SINONIMOS_TIPO["hatch"]).toContain("hatchback");
    expect(SINONIMOS_TIPO["sedan"]).toContain("sedan");
  });

  it("'camioneta' abarca pick-up, camioneta y SUV", () => {
    expect([...SINONIMOS_TIPO["camioneta"]].sort()).toEqual(["camioneta", "pickup", "suv"]);
  });

  it("'auto' y 'autos' no restringen el tipo (no estan en el diccionario)", () => {
    expect(SINONIMOS_TIPO["auto"]).toBeUndefined();
    expect(SINONIMOS_TIPO["autos"]).toBeUndefined();
  });
});

describe("combustible, transmision y marcas", () => {
  it("normaliza combustibles", () => {
    expect(SINONIMOS_COMBUSTIBLE["nafta"]).toBe("nafta");
    expect(SINONIMOS_COMBUSTIBLE["naftero"]).toBe("nafta");
    expect(SINONIMOS_COMBUSTIBLE["gasoil"]).toBe("diesel");
    expect(SINONIMOS_COMBUSTIBLE["diesel"]).toBe("diesel");
    expect(SINONIMOS_COMBUSTIBLE["gnc"]).toBe("gnc");
  });

  it("normaliza transmisiones", () => {
    expect(SINONIMOS_TRANSMISION["automatico"]).toBe("automatico");
    expect(SINONIMOS_TRANSMISION["automatica"]).toBe("automatico");
    expect(SINONIMOS_TRANSMISION["at"]).toBe("automatico");
    expect(SINONIMOS_TRANSMISION["manual"]).toBe("manual");
    expect(SINONIMOS_TRANSMISION["mecanico"]).toBe("manual");
  });

  it("resuelve alias de marca", () => {
    expect(ALIAS_MARCA["vw"]).toBe("volkswagen");
    expect(ALIAS_MARCA["chevy"]).toBe("chevrolet");
  });
});
