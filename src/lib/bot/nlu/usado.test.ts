import { describe, expect, it } from "vitest";
import { descripcionDelUsado, extraerUsado, ofreceUsado } from "./usado";
import { normalizar } from "./normalizar";

const MARCAS = ["Chevrolet", "Volkswagen", "Peugeot", "Ford", "Renault"];
const ofrece = (texto: string) => ofreceUsado(normalizar(texto).split(" "));

describe("ofreceUsado: el cliente ofrece SU auto", () => {
  it.each([
    "Tengo un chevrolt corsa 2010 para entregar",
    "tengo una hilux 2015 para dar de parte de pago",
    "Hola, tengo un gol para la entrega",
    "tengo un auto para entregar",
    "Entrego mi gol 2012",
    "entregar un usado por uno mas nuevo",
    "quiero cambiar mi corsa por un 0km",
    "cambio mi auto por otro",
  ])("%j → sí", (texto) => {
    expect(ofrece(texto)).toBe(true);
  });

  it.each([
    "Tengo 2 millones para entregar",
    "tengo 500 mil pesos para entregar",
    "tengo 3000 dolares para dar de anticipo",
    "tengo 10k para entregar",
    "cambio de aceite cada cuanto",
    "me pueden dar el precio del gol?",
    "tienen un gol 2010?",
    "tengo una duda",
    "quiero cambiar de horario",
  ])("%j → no", (texto) => {
    expect(ofrece(texto)).toBe(false);
  });
});

describe("extraerUsado", () => {
  it("el caso real: 'tengo un chevrolt corsa 2010 para entregar'", () => {
    expect(extraerUsado("Tengo un chevrolt corsa 2010 para entregar", MARCAS)).toEqual({ modelo: "Chevrolet Corsa", anio: 2010 });
  });

  it("corrige errores de tipeo de la marca solo si la marca esta en el catalogo", () => {
    expect(extraerUsado("tengo un volkswagem gol 2012 para entregar", MARCAS)?.modelo).toBe("Volkswagen Gol");
    expect(extraerUsado("tengo un chevrolt corsa para entregar", [])?.modelo).toBe("Chevrolt Corsa");
  });

  it("sin año devuelve solo el modelo", () => {
    expect(extraerUsado("tengo una hilux para dar de parte de pago", MARCAS)).toEqual({ modelo: "Hilux", anio: null });
  });

  it("con 'entrego mi X' toma el nombre hasta que cambia de tema", () => {
    expect(extraerUsado("Entrego mi gol 2012 por uno mas nuevo", MARCAS)).toEqual({ modelo: "Gol", anio: 2012 });
    expect(extraerUsado("quiero cambiar mi fiat palio 2014 por una camioneta", MARCAS)).toEqual({ modelo: "Fiat Palio", anio: 2014 });
  });

  it("si solo dice 'un usado' no hay modelo", () => {
    expect(extraerUsado("tengo un usado para entregar", MARCAS)).toEqual({ modelo: null, anio: null });
    expect(extraerUsado("tengo un auto para entregar", MARCAS)).toEqual({ modelo: null, anio: null });
  });

  it("no inventa un usado cuando es plata o cuando no ofrece nada", () => {
    expect(extraerUsado("tengo 2 millones para entregar", MARCAS)).toBeNull();
    expect(extraerUsado("tienen un corsa 2010?", MARCAS)).toBeNull();
    expect(extraerUsado("", MARCAS)).toBeNull();
  });

  it("corta los nombres demasiado largos", () => {
    const largo = `tengo un ${"modelo".repeat(5)} ${"a".repeat(80)} para entregar`;
    const u = extraerUsado(largo, MARCAS);
    expect((u?.modelo ?? "").length).toBeLessThanOrEqual(60);
  });
});

describe("descripcionDelUsado", () => {
  it("junta modelo y año", () => {
    expect(descripcionDelUsado({ modelo: "Chevrolet Corsa", anio: 2010 })).toBe("Chevrolet Corsa 2010");
    expect(descripcionDelUsado({ modelo: "Hilux", anio: null })).toBe("Hilux");
    expect(descripcionDelUsado({ modelo: null, anio: 2010 })).toBeNull();
  });
});
