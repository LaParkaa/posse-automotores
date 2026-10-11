import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import type { VehiculoCatalogo } from "./types";
import { buscar, filtrosDeEntidades, recientes, similares } from "./busqueda";

const ids = (vs: { id: string }[]) => vs.map((v) => v.id);
const por = (id: string) => CATALOGO.find((v) => v.id === id)!;

describe("buscar", () => {
  it("sin filtros devuelve todos los disponibles, los mas nuevos primero", () => {
    const r = buscar(CATALOGO, {});

    expect(ids(r.exactos)).toEqual(["v-amarok", "v-206", "v-208", "v-vento", "v-kangoo", "v-corolla"]);
    expect(r.alternativos).toEqual([]);
    expect(r.relajados).toEqual([]);
  });

  it("no incluye vendidos ni reservados", () => {
    expect(ids(buscar(CATALOGO, { tipos: ["utilitario"] }).exactos)).toEqual(["v-kangoo"]);
    expect(ids(buscar(CATALOGO, { tipos: ["moto"] }).exactos)).toEqual([]);
  });

  it("filtra por tipo, marca, año, combustible y transmision", () => {
    expect(ids(buscar(CATALOGO, { tipos: ["pickup"] }).exactos)).toEqual(["v-amarok"]);
    expect(ids(buscar(CATALOGO, { marca: "Peugeot" }).exactos)).toEqual(["v-206", "v-208"]);
    expect(ids(buscar(CATALOGO, { anio: 2011 }).exactos)).toEqual(["v-206", "v-corolla"]);
    expect(ids(buscar(CATALOGO, { combustible: "diesel" }).exactos)).toEqual(["v-amarok"]);
    expect(ids(buscar(CATALOGO, { transmision: "automatico" }).exactos)).toEqual(["v-amarok", "v-vento"]);
  });

  it("si no hay coincidencia exacta relaja filtros y avisa cuales soltó", () => {
    const r = buscar(CATALOGO, { tipos: ["pickup"], combustible: "nafta" });

    expect(r.exactos).toEqual([]);
    expect(ids(r.alternativos)).toEqual(["v-amarok"]);
    expect(r.relajados).toEqual(["combustible"]);
  });

  it("relaja en orden: año, transmision, combustible, marca; nunca el tipo", () => {
    const r = buscar(CATALOGO, { tipos: ["sedan"], anio: 1990, transmision: "manual", combustible: "gnc", marca: "Honda" });

    expect(r.relajados).toEqual(["anio", "transmision", "combustible", "marca"]);
    expect(ids(r.alternativos)).toEqual(["v-vento", "v-corolla"]);
  });

  it("si ni relajando hay algo (tipo sin stock) devuelve vacio", () => {
    const r = buscar(CATALOGO, { tipos: ["moto"] });

    expect(r.exactos).toEqual([]);
    expect(r.alternativos).toEqual([]);
  });
});

describe("filtrosDeEntidades", () => {
  it("copia solo lo que el cliente dijo", () => {
    const f = filtrosDeEntidades({
      vehiculoIds: [], marca: "Peugeot", tipos: ["pickup"], combustible: null, transmision: "manual", anio: null, ordinal: null, deictico: false,
    });

    expect(f).toEqual({ marca: "Peugeot", tipos: ["pickup"], transmision: "manual" });
  });

  it("devuelve {} si no hay ninguno", () => {
    expect(
      filtrosDeEntidades({ vehiculoIds: [], marca: null, tipos: [], combustible: null, transmision: null, anio: null, ordinal: null, deictico: false }),
    ).toEqual({});
  });
});

describe("similares", () => {
  it("de un auto vendido devuelve los disponibles del mismo tipo", () => {
    expect(ids(similares(CATALOGO, por("v-partner")))).toEqual(["v-kangoo"]);
  });

  it("prioriza el mismo tipo por cercania de año y completa con la misma marca", () => {
    expect(ids(similares(CATALOGO, por("v-206")))).toEqual(["v-208"]);
  });

  it("no incluye al propio auto y respeta el maximo", () => {
    const r = similares(CATALOGO, por("v-corolla"), 1);

    expect(r).toHaveLength(1);
    expect(r[0].id).not.toBe("v-corolla");
    expect(r[0].tipo).toBe("Sedán");
  });
});

describe("recientes", () => {
  it("devuelve los ultimos cargados de cualquier estado", () => {
    expect(ids(recientes(CATALOGO, 5))).toEqual(["v-amarok", "v-206", "v-208", "v-vento", "v-kangoo"]);
    expect(ids(recientes(CATALOGO, 20))).toHaveLength(CATALOGO.length);
  });
});

// Los datos del catalogo se cargan a mano desde el panel de admin: el texto es libre y no siempre
// respeta el formato esperado, asi que la busqueda tiene que tolerar variantes.
const conCampos = (base: string, campos: Partial<VehiculoCatalogo>): VehiculoCatalogo => ({
  ...por(base),
  id: `x-${base}`,
  ...campos,
});

describe("buscar: combustible en texto libre", () => {
  const encuentra = (combustible: string, filtro: string) =>
    ids(buscar([conCampos("v-206", { combustible })], { combustible: filtro }).exactos);

  it.each(["Nafta/GNC", "Nafta-GNC", "Nafta + GNC"])("%s se encuentra por nafta y por gnc", (valor) => {
    expect(encuentra(valor, "gnc")).toEqual(["x-v-206"]);
    expect(encuentra(valor, "nafta")).toEqual(["x-v-206"]);
  });

  it("Diésel y Diesel se encuentran por diesel", () => {
    expect(encuentra("Diésel", "diesel")).toEqual(["x-v-206"]);
    expect(encuentra("Diesel", "diesel")).toEqual(["x-v-206"]);
  });

  it("Gasoil se encuentra por diesel", () => {
    expect(encuentra("Gasoil", "diesel")).toEqual(["x-v-206"]);
  });

  it("Gasolina se encuentra por nafta", () => {
    expect(encuentra("Gasolina", "nafta")).toEqual(["x-v-206"]);
  });

  it("un auto a Nafta no se encuentra por gnc", () => {
    expect(encuentra("Nafta", "gnc")).toEqual([]);
  });
});

describe("buscar: transmision con sinonimos", () => {
  const encuentra = (transmision: string, filtro: "automatico" | "manual") =>
    ids(buscar([conCampos("v-206", { transmision })], { transmision: filtro }).exactos);

  it.each(["CVT", "DSG", "Semiautomático", "Tiptronic", "Secuencial", "AT", "Automática"])(
    "%s cuenta como automatica y no como manual",
    (valor) => {
      expect(encuentra(valor, "automatico")).toEqual(["x-v-206"]);
      expect(encuentra(valor, "manual")).toEqual([]);
    },
  );

  it("Mecánica cuenta como manual y no como automatica", () => {
    expect(encuentra("Mecánica", "manual")).toEqual(["x-v-206"]);
    expect(encuentra("Mecánica", "automatico")).toEqual([]);
  });

  it("un valor desconocido no matchea ninguna", () => {
    expect(encuentra("Rara", "manual")).toEqual([]);
    expect(encuentra("Rara", "automatico")).toEqual([]);
  });
});

describe("limites de similares y recientes", () => {
  it("similares con max 0 o negativo devuelve []", () => {
    // Con varios candidatos: un slice(0, -1) devolveria todos menos el ultimo en vez de nada.
    const sedanes = ["a", "b", "c"].map((n) => conCampos("v-corolla", { id: `x-${n}` }));
    const catalogo = [...CATALOGO, ...sedanes];

    expect(similares(catalogo, por("v-vento"), 0)).toEqual([]);
    expect(similares(catalogo, por("v-vento"), -1)).toEqual([]);
  });

  it("recientes con cantidad negativa devuelve []", () => {
    expect(recientes(CATALOGO, -3)).toEqual([]);
    expect(recientes(CATALOGO, 0)).toEqual([]);
  });
});

describe("casos borde de la busqueda", () => {
  it("con el catalogo vacio no devuelve nada", () => {
    expect(buscar([], { tipos: ["sedan"] })).toEqual({ exactos: [], alternativos: [], relajados: [] });
    expect(similares([], por("v-206"))).toEqual([]);
    expect(recientes([], 5)).toEqual([]);
  });

  it("tipos vacio se comporta como sin filtro de tipo", () => {
    expect(buscar(CATALOGO, { tipos: [] })).toEqual(buscar(CATALOGO, {}));
  });

  it("un tipo desconocido no da exactos ni alternativos", () => {
    const r = buscar(CATALOGO, { tipos: ["nave"] });

    expect(r.exactos).toEqual([]);
    expect(r.alternativos).toEqual([]);
  });

  it("no muta el arreglo de entrada", () => {
    const antes = ids(CATALOGO);
    const copia = structuredClone(CATALOGO);

    buscar(CATALOGO, { marca: "Peugeot" });
    similares(CATALOGO, por("v-206"));
    recientes(CATALOGO, 5);

    expect(ids(CATALOGO)).toEqual(antes);
    expect(CATALOGO).toEqual(copia);
  });

  it("la relajacion se detiene apenas aparecen resultados", () => {
    const r = buscar(CATALOGO, { tipos: ["sedan"], anio: 1990 });

    expect(r.relajados).toEqual(["anio"]);
    expect(ids(r.alternativos)).toEqual(["v-vento", "v-corolla"]);
  });

  it("si solo hay tipos y nada matchea, relajados es []", () => {
    const r = buscar(CATALOGO, { tipos: ["moto"] });

    expect(r.relajados).toEqual([]);
  });
});

describe("similares: plan B por marca", () => {
  const civicVendido = conCampos("v-corolla", {
    id: "x-civic", marca: "Honda", modelo: "Civic", nombre: "Honda Civic", tipo: "Sedán", estado: "vendido",
  });
  const motoHonda = conCampos("v-xr150", { id: "x-xr", estado: "disponible" });

  it("sin ninguno del mismo tipo completa con la misma marca", () => {
    // Sin otros sedanes disponibles, el unico parecido es la moto de la misma marca.
    const soloHonda = [civicVendido, motoHonda, por("v-kangoo")];
    expect(ids(similares(soloHonda, civicVendido))).toEqual(["x-xr"]);
  });

  it("un auto sin tipo cae directo a la misma marca", () => {
    const sinTipo = conCampos("v-206", { id: "x-sin-tipo", tipo: null });

    expect(ids(similares([...CATALOGO, sinTipo], sinTipo))).toEqual(["v-206", "v-208"]);
  });
});
