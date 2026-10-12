import { describe, expect, it } from "vitest";
import { normalizar } from "./normalizar";
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

  it("unifica todas las formas de 'cero kilometros' en 0km", () => {
    expect(aplicarFrases("un 0 km")).toBe("un 0km");
    expect(aplicarFrases("auto okm")).toBe("auto 0km");
    expect(aplicarFrases("un 0km")).toBe("un 0km");
    expect(aplicarFrases("cero kms")).toBe("0km");
    expect(aplicarFrases("cero kilometro")).toBe("0km");
    expect(aplicarFrases("cero kilometros")).toBe("0km");
  });

  it("no toca un kilometraje comun", () => {
    expect(aplicarFrases("tiene 120 km")).toBe("tiene 120 km");
    expect(aplicarFrases("tiene 10 km")).toBe("tiene 10 km");
    expect(aplicarFrases("tiene 1.0 km")).toBe("tiene 1.0 km");
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

describe("diccionarios sin prototipo", () => {
  it.each([
    ["SINONIMOS_TIPO", SINONIMOS_TIPO],
    ["SINONIMOS_COMBUSTIBLE", SINONIMOS_COMBUSTIBLE],
    ["SINONIMOS_TRANSMISION", SINONIMOS_TRANSMISION],
    ["ALIAS_MARCA", ALIAS_MARCA],
  ])("%s no hereda de Object.prototype", (_nombre, dic) => {
    expect(dic["constructor"]).toBeUndefined();
    expect(dic["toString"]).toBeUndefined();
  });
});

describe("alias de marca de Mercedes", () => {
  it("resuelve mercedes, merce y benz", () => {
    expect(ALIAS_MARCA["mercedes"]).toBe("mercedes");
    expect(ALIAS_MARCA["merce"]).toBe("mercedes");
    expect(ALIAS_MARCA["benz"]).toBe("mercedes");
  });
});

describe("invariantes de los diccionarios", () => {
  const diccionarios = [SINONIMOS_TIPO, SINONIMOS_COMBUSTIBLE, SINONIMOS_TRANSMISION, ALIAS_MARCA];

  it("toda clave ya esta normalizada (si no, el token del usuario nunca la encontraria)", () => {
    for (const dic of diccionarios) {
      for (const clave of Object.keys(dic)) {
        expect(normalizar(clave)).toBe(clave);
      }
    }
  });

  it("todo valor de SINONIMOS_TIPO es una clave de claveTipo", () => {
    for (const valores of Object.values(SINONIMOS_TIPO)) {
      for (const valor of valores) {
        expect(claveTipo(valor)).toBe(valor);
      }
    }
  });
});
