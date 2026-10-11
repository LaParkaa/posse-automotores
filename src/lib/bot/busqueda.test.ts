import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
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
