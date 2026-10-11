import { describe, expect, it } from "vitest";
import { CATALOGO } from "../__fixtures__/catalogo";
import type { VehiculoCatalogo } from "../types";
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

// Catalogo local: los de la fixture mas los autos extra que cada caso necesita.
const extra = (id: string, marca: string, modelo: string): VehiculoCatalogo => ({
  ...CATALOGO[0],
  id,
  marca,
  modelo,
  nombre: `${marca} ${modelo}`,
});
const conExtra = (...autos: VehiculoCatalogo[]) => [...CATALOGO, ...autos];

describe("modelos: la tolerancia a typos no nombra palabras comunes", () => {
  it.each([
    ["esta en venta?"],
    ["tienen autos en venta?"],
    ["vendo mi auto"],
    ["hay ventas de usados?"],
    ["con este viento no salgo"],
  ])("%j no nombra el Vento", (texto) => {
    expect(e(texto).vehiculoIds).toEqual([]);
  });

  it("no nombra el Corsa con 'cosa', 'casa' ni 'foco'", () => {
    const catalogo = conExtra(extra("v-corsa", "Chevrolet", "Corsa"));

    expect(extraerEntidades("tenes otra cosa?", catalogo).vehiculoIds).toEqual([]);
    expect(extraerEntidades("pasame a casa", catalogo).vehiculoIds).toEqual([]);
    expect(extraerEntidades("el corsa", catalogo).vehiculoIds).toEqual(["v-corsa"]);
  });

  it("la palabra de la lista de exclusion si coincide cuando es el modelo exacto", () => {
    // La lista veta la tolerancia, no la igualdad: un modelo llamado "Rango" se nombra "rango".
    const catalogo = conExtra(extra("v-rango", "Land Rover", "Rango"));

    expect(extraerEntidades("el rango", catalogo).vehiculoIds).toEqual(["v-rango"]);
  });

  it("exige la misma primera letra en el typo", () => {
    expect(e("tenes una zmarok?").vehiculoIds).toEqual([]);
  });

  it("los typos reales siguen funcionando", () => {
    expect(e("tenes una amarrok?").vehiculoIds).toEqual(["v-amarok"]);
    expect(e("precio del corola").vehiculoIds).toEqual(["v-corolla"]);
  });
});

describe("marca: la tolerancia a typos es mas estricta", () => {
  it("'buena onda' no es Honda", () => {
    expect(e("buena onda").marca).toBeNull();
  });

  it("'honda' escrita bien sigue siendo Honda", () => {
    expect(e("una honda").marca).toBe("Honda");
  });

  it("un typo de 6+ letras con la misma inicial si cuenta", () => {
    expect(e("peugot").marca).toBe("Peugeot");
  });

  it("los alias siguen por igualdad exacta", () => {
    expect(e("una vw").marca).toBe("Volkswagen");
  });
});

describe("modelos muy cortos", () => {
  const mercedes = extra("v-a200", "Mercedes-Benz", "A 200");
  const tcross = extra("v-tcross", "Volkswagen", "T-Cross");
  const soloLetra = extra("v-x", "Genérica", "Q");
  const fiatUno = extra("v-uno", "Fiat", "Uno");

  it("un modelo de una letra solo se nombra junto a su segundo token", () => {
    const catalogo = conExtra(mercedes);

    expect(extraerEntidades("a cuanto esta?", catalogo).vehiculoIds).toEqual([]);
    expect(extraerEntidades("el a 200", catalogo).vehiculoIds).toEqual(["v-a200"]);
  });

  it("'t-cross' se normaliza a 't cross' y se nombra con ambos tokens", () => {
    const catalogo = conExtra(tcross);

    expect(extraerEntidades("la t cross", catalogo).vehiculoIds).toEqual(["v-tcross"]);
    expect(extraerEntidades("la t-cross", catalogo).vehiculoIds).toEqual(["v-tcross"]);
    expect(extraerEntidades("hay t de algo cross", catalogo).vehiculoIds).toEqual([]);
  });

  it("un modelo de una sola letra sin segundo token nunca se nombra", () => {
    expect(extraerEntidades("la q", conExtra(soloLetra)).vehiculoIds).toEqual([]);
  });

  it("un modelo de dos letras sigue nombrandose solo", () => {
    expect(e("tienen la xr 150?").vehiculoIds).toEqual(["v-xr150"]);
    expect(e("la xr").vehiculoIds).toEqual(["v-xr150"]);
  });

  it("'uno' solo nombra al Fiat Uno si tambien aparece la marca", () => {
    const catalogo = conExtra(fiatUno);

    expect(extraerEntidades("tenes uno de nafta?", catalogo).vehiculoIds).toEqual([]);
    expect(extraerEntidades("el fiat uno", catalogo).vehiculoIds).toEqual(["v-uno"]);
  });
});

describe("año: no sale de frases de km o de precio", () => {
  it.each([
    ["tiene 2000 km"],
    ["2000 kms"],
    ["2000 kilometros"],
    ["2000 dolares"],
    ["2000 pesos"],
    ["2000 usd"],
    ["2000 mil"],
    ["mil 2000"],
    ["usd 2000"],
    ["u$s 2000"],
  ])("%j → null", (texto) => {
    expect(e(texto).anio).toBeNull();
  });

  it("un año valido despues de una frase rechazada se sigue encontrando", () => {
    expect(e("2000 km del 2015").anio).toBe(2015);
  });

  it("'modelo 2015' sigue siendo 2015", () => {
    expect(e("modelo 2015").anio).toBe(2015);
  });
});

describe("decisiones declaradas", () => {
  it("la marca 'Mercedes-Benz' se nombra como 'mercedes'", () => {
    const catalogo = conExtra(extra("v-merc", "Mercedes-Benz", "Clase C"));

    expect(extraerEntidades("busco un mercedes", catalogo).marca).toBe("Mercedes-Benz");
  });

  it("un modelo '2008' se nombra con 'la 2008' y no cuenta como año", () => {
    const catalogo = conExtra(extra("v-2008", "Peugeot", "2008"));
    const entidades = extraerEntidades("la 2008", catalogo);

    expect(entidades.vehiculoIds).toEqual(["v-2008"]);
    expect(entidades.anio).toBeNull();
  });

  it("catalogo vacio: entidades vacias", () => {
    expect(extraerEntidades("la 208 nafta", [])).toMatchObject({ vehiculoIds: [], marca: null });
  });

  it("se nombran los autos vendidos y los reservados", () => {
    expect(e("la partner").vehiculoIds).toEqual(["v-partner"]);
    expect(e("la xr 150").vehiculoIds).toEqual(["v-xr150"]);
  });

  it.each([
    ["1979", null],
    ["1980", 1980],
    ["2030", 2030],
    ["2031", null],
  ])("limites de año: %j → %j", (texto, anio) => {
    expect(e(texto).anio).toBe(anio);
  });

  it("limite de ordinal: hasta 4 tokens", () => {
    expect(e("el 2").ordinal).toBe(2);
    expect(e("dame el segundo").ordinal).toBe(2);
    expect(e("dame el segundo de los cinco").ordinal).toBeNull();
    expect(e("el 2 de la lista").ordinal).toBeNull();
  });

  it("'constructor', 'toString' y '__proto__' no rompen ni encuentran nada", () => {
    const vacias = {
      vehiculoIds: [], marca: null, tipos: [], combustible: null, transmision: null, anio: null, ordinal: null, deictico: false,
    };

    expect(e("constructor")).toEqual(vacias);
    expect(e("toString")).toEqual(vacias);
    expect(e("__proto__ hasOwnProperty")).toEqual(vacias);
  });
});
