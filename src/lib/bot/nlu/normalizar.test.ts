import { describe, expect, it } from "vitest";
import { coincideAprox, distancia, esSoloEmojis, normalizar, tokenizar } from "./normalizar";

describe("normalizar", () => {
  it.each([
    ["¡Hola! ¿Cómo estás?", "hola como estas"],
    ["AÑO 2015", "ano 2015"],
    ["holaaaa", "hola"],
    ["sii", "sii"],
    ["Peugeot 206 1.6", "peugeot 206 1.6"],
    ["$9.500.000", "9.500.000"],
    ["177.000 km", "177.000 km"],
    ["Hola.", "hola"],
    ["  mucho   espacio ", "mucho espacio"],
    ["pick-up", "pick up"],
    ["👍 dale", "dale"],
    ["", ""],
  ])("normaliza %j → %j", (entrada, esperado) => {
    expect(normalizar(entrada)).toBe(esperado);
  });
});

describe("tokenizar", () => {
  it("separa en palabras ya normalizadas", () => {
    expect(tokenizar("me pasas más info del 206?")).toEqual(["me", "pasas", "mas", "info", "del", "206"]);
  });

  it("devuelve lista vacia para texto vacio o solo signos", () => {
    expect(tokenizar("")).toEqual([]);
    expect(tokenizar("?!...")).toEqual([]);
  });
});

describe("esSoloEmojis", () => {
  it("es true si hay emojis y ninguna letra ni numero", () => {
    expect(esSoloEmojis("👍")).toBe(true);
    expect(esSoloEmojis("👍👍 ❤️")).toBe(true);
  });

  it("es false si hay texto, esta vacio o no hay emojis", () => {
    expect(esSoloEmojis("🚗 hola")).toBe(false);
    expect(esSoloEmojis("")).toBe(false);
    expect(esSoloEmojis("...")).toBe(false);
    expect(esSoloEmojis("hola")).toBe(false);
  });
});

describe("distancia", () => {
  it("cuenta ediciones de a un caracter", () => {
    expect(distancia("amarok", "amarok")).toBe(0);
    expect(distancia("amarok", "amarrok")).toBe(1);
    expect(distancia("kitten", "sitting")).toBe(3);
    expect(distancia("", "abc")).toBe(3);
  });
});

describe("coincideAprox", () => {
  it("exige igualdad en palabras de hasta 4 letras y numeros", () => {
    expect(coincideAprox("hola", "hola")).toBe(true);
    expect(coincideAprox("hola", "ola")).toBe(false);
    expect(coincideAprox("206", "208")).toBe(false);
  });

  it("tolera 1 error en palabras de 5 a 7 letras", () => {
    expect(coincideAprox("amarrok", "amarok")).toBe(true);
    expect(coincideAprox("corola", "corolla")).toBe(true);
    expect(coincideAprox("vento", "venta")).toBe(true);
    expect(coincideAprox("vento", "viaje")).toBe(false);
  });

  it("tolera 2 errores en palabras de 8 o mas letras", () => {
    expect(coincideAprox("financiacon", "financiacion")).toBe(true);
    expect(coincideAprox("financiasion", "financiacion")).toBe(true);
    expect(coincideAprox("documentos", "documentacion")).toBe(false);
  });
});
