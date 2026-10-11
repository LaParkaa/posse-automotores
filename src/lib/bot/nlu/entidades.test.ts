import { describe, expect, it } from "vitest";
import { CATALOGO } from "../__fixtures__/catalogo";
import { extraerEntidades } from "./entidades";

const e = (texto: string) => extraerEntidades(texto, CATALOGO);

describe("autos nombrados", () => {
  it.each([
    ["me pasas mas info del 206", ["v-206"]],
    ["tienen la 208?", ["v-208"]],
    ["cuanto sale el vento?", ["v-vento"]],
    ["tenes una amarrok?", ["v-amarok"]],
    ["precio del corola", ["v-corolla"]],
    ["la partner", ["v-partner"]],
    ["tienen la xr 150?", ["v-xr150"]],
    ["peugeot 208 style", ["v-208"]],
  ])("%j → %j", (texto, ids) => {
    expect(e(texto).vehiculoIds).toEqual(ids);
  });

  it("devuelve varios si el modelo es ambiguo y ninguno si no hay", () => {
    const dos = [...CATALOGO, { ...CATALOGO[1], id: "v-208b", nombre: "Peugeot 208 Active", modelo: "208 Active" }];

    expect(extraerEntidades("la 208", dos).vehiculoIds.sort()).toEqual(["v-208", "v-208b"]);
    expect(e("hola buenas tardes").vehiculoIds).toEqual([]);
  });
});

describe("marca", () => {
  it("detecta una marca sola, con alias", () => {
    expect(e("busco algo peugeot").marca).toBe("Peugeot");
    expect(e("una vw").marca).toBe("Volkswagen");
  });

  it("no la devuelve si se nombra un auto concreto", () => {
    expect(e("peugeot 208 style").marca).toBeNull();
  });
});

describe("tipo, combustible, transmision y año", () => {
  it("tipos", () => {
    expect(e("una pickup nafta").tipos).toEqual(["pickup"]);
    expect(e("algun utilitario asi?").tipos).toEqual(["utilitario"]);
    expect(e("tienen alguna chatita?").tipos).toEqual(["utilitario"]);
    expect([...e("busco una camioneta").tipos].sort()).toEqual(["camioneta", "pickup", "suv"]);
    expect(e("busco un auto").tipos).toEqual([]);
    expect(e("una pick up").tipos).toEqual(["pickup"]);
  });

  it("combustible y transmision", () => {
    expect(e("una pickup nafta").combustible).toBe("nafta");
    expect(e("quiero gas oil").combustible).toBe("diesel");
    expect(e("automatico por favor").transmision).toBe("automatico");
    expect(e("que sea manual").transmision).toBe("manual");
    expect(e("hola").combustible).toBeNull();
  });

  it("no confunde palabras comunes con los diccionarios (no hay tolerancia a typos en ellos)", () => {
    expect(e("soy Manuel").transmision).toBeNull();
    expect(e("motor 1.6").tipos).toEqual([]);
    expect(e("mucho trafico").tipos).toEqual([]);
  });

  it("año de 4 digitos, sin confundirlo con precios, km o modelos", () => {
    expect(e("modelo 2015").anio).toBe(2015);
    expect(e("del 2011").anio).toBe(2011);
    expect(e("2015").anio).toBe(2015);
    expect(e("177 mil km").anio).toBeNull();
    expect(e("esta en $9.500.000").anio).toBeNull();
    expect(e("la 206").anio).toBeNull();
    expect(e("1999999").anio).toBeNull();
  });
});

describe("referencias a lo ya mostrado", () => {
  it("ordinales", () => {
    expect(e("el 2").ordinal).toBe(2);
    expect(e("el segundo").ordinal).toBe(2);
    expect(e("la primera").ordinal).toBe(1);
    expect(e("el ultimo").ordinal).toBe(-1);
  });

  it("un numero de modelo no es ordinal", () => {
    expect(e("el 206").ordinal).toBeNull();
    expect(e("me pasas mas info del 206").ordinal).toBeNull();
  });

  it("deicticos", () => {
    expect(e("ese").deictico).toBe(true);
    expect(e("esa me interesa").deictico).toBe(true);
    expect(e("el mismo").deictico).toBe(true);
    expect(e("tienen alguna pickup nafta y automatica de las que estan en la web").deictico).toBe(false);
  });
});

describe("texto sin contenido", () => {
  it("devuelve entidades vacias", () => {
    expect(e("")).toEqual({
      vehiculoIds: [], marca: null, tipos: [], combustible: null, transmision: null, anio: null, ordinal: null, deictico: false,
    });
  });
});
