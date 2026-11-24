import { describe, expect, it } from "vitest";
import { autosConLlave, consultaLlave, filtrarLlaves, formatearPatente, normalizarPatente } from "./consulta";

const auto = (extra: Partial<Parameters<typeof filtrarLlaves>[0][number]> = {}) => ({
  nombre: "Chevrolet Cruze LTZ AT",
  marca: "Chevrolet",
  modelo: "Cruze",
  anio: 2018,
  patente: null as string | null,
  ...extra,
});

describe("consultaLlave", () => {
  it("arma la búsqueda con marca, modelo y año", () => {
    expect(consultaLlave({ marca: "Chevrolet", modelo: "Cruze", anio: 2018 })).toBe("llave Chevrolet Cruze 2018 original");
  });

  it("no deja espacios dobles si falta el modelo", () => {
    expect(consultaLlave({ marca: "Ford", modelo: "", anio: 2012 })).toBe("llave Ford 2012 original");
  });
});

describe("filtrarLlaves", () => {
  const cruze = auto();
  const gol = auto({ nombre: "Volkswagen Gol Power 1.6", marca: "Volkswagen", modelo: "Gol Power", anio: 2012, patente: "AB123CD" });
  const ranger = auto({ nombre: "Ford Ranger 2.2 4x2", marca: "Ford", modelo: "Ranger", anio: 2016, patente: "ABC123" });
  const todos = [cruze, gol, ranger];

  it("sin texto devuelve todos", () => {
    expect(filtrarLlaves(todos, "   ")).toEqual(todos);
  });

  it("busca por marca, modelo o año sin importar mayúsculas ni tildes", () => {
    expect(filtrarLlaves(todos, "VOLKSWAGEN")).toEqual([gol]);
    expect(filtrarLlaves(todos, "ránger")).toEqual([ranger]);
    expect(filtrarLlaves(todos, "2018")).toEqual([cruze]);
  });

  it("todas las palabras tienen que coincidir", () => {
    expect(filtrarLlaves(todos, "ford 2016")).toEqual([ranger]);
    expect(filtrarLlaves(todos, "ford 2012")).toEqual([]);
  });

  it("busca por patente con o sin espacios", () => {
    expect(filtrarLlaves(todos, "ab123cd")).toEqual([gol]);
    expect(filtrarLlaves(todos, "AB 123 CD")).toEqual([gol]);
    expect(filtrarLlaves(todos, "abc 123")).toEqual([ranger]);
  });

  it("un auto sin patente no rompe la búsqueda", () => {
    expect(filtrarLlaves([cruze], "xyz")).toEqual([]);
  });
});

describe("patente", () => {
  it("normaliza a mayúsculas sin espacios ni guiones", () => {
    expect(normalizarPatente(" ab-123 cd ")).toBe("AB123CD");
    expect(normalizarPatente("abc 123")).toBe("ABC123");
  });

  it("vacío borra la patente", () => {
    expect(normalizarPatente("   ")).toBeNull();
  });

  it("rechaza lo que no parece una patente", () => {
    expect(normalizarPatente("ab")).toBeUndefined();
    expect(normalizarPatente("ab123cd456789")).toBeUndefined();
    expect(normalizarPatente("ab123!")).toBeUndefined();
  });

  it("la muestra con espacios según el formato", () => {
    expect(formatearPatente("AB123CD")).toBe("AB 123 CD");
    expect(formatearPatente("ABC123")).toBe("ABC 123");
    expect(formatearPatente("A123BCD")).toBe("A123BCD");
  });
});

describe("autosConLlave", () => {
  it("deja afuera los vendidos", () => {
    const lista = [{ estado: "disponible" as const }, { estado: "reservado" as const }, { estado: "vendido" as const }];
    expect(autosConLlave(lista)).toHaveLength(2);
  });
});
