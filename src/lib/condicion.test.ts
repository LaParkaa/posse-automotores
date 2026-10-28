import { describe, expect, it } from "vitest";
import { condicionDeUrl, cumpleCondicion, esCeroKm } from "./condicion";

const km = (kilometraje: string) => ({ kilometraje });

describe("esCeroKm", () => {
  it.each(["0", "0km", "0 km", "0.000 km", " 0 "])("%j es 0km", (valor) => {
    expect(esCeroKm(km(valor))).toBe(true);
  });

  it.each(["190.000 km", "104.000km", "85.000", "Consultá km", "", "10 km"])("%j es usado", (valor) => {
    expect(esCeroKm(km(valor))).toBe(false);
  });
});

describe("cumpleCondicion", () => {
  it("sin condicion deja pasar todo", () => {
    expect(cumpleCondicion(km("0"), undefined)).toBe(true);
    expect(cumpleCondicion(km("85.000"), undefined)).toBe(true);
  });

  it("usados deja los que tienen km y 0km solo los de 0", () => {
    expect(cumpleCondicion(km("85.000"), "usados")).toBe(true);
    expect(cumpleCondicion(km("0km"), "usados")).toBe(false);
    expect(cumpleCondicion(km("0km"), "0km")).toBe(true);
    expect(cumpleCondicion(km("85.000"), "0km")).toBe(false);
  });
});

describe("condicionDeUrl", () => {
  it("solo acepta los dos valores conocidos", () => {
    expect(condicionDeUrl("usados")).toBe("usados");
    expect(condicionDeUrl("0km")).toBe("0km");
    expect(condicionDeUrl("financiados")).toBeUndefined();
    expect(condicionDeUrl(undefined)).toBeUndefined();
  });
});
