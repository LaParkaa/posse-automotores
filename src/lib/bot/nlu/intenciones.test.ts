import { describe, expect, it } from "vitest";
import { detectarIntenciones } from "./intenciones";

describe("detectarIntenciones — la intencion principal (primera)", () => {
  it.each([
    ["hola", "saludo"],
    ["holaaa", "saludo"],
    ["ola buenas tardes", "saludo"],
    ["Hola !como estas??", "cortesia"],
    ["como andas", "cortesia"],
    ["gracias", "gracias"],
    ["chau, nos vemos", "despedida"],
    ["me decis el precio?", "precio"],
    ["hola. me decis el precio?", "precio"],
    ["que valor tiene?", "precio"],
    ["cuanto sale el vento?", "precio"],
    ["cuánto cuesta", "precio"],
    ["a cuanto la tienen", "precio"],
    ["me pasas mas info del 206", "info"],
    ["cuantos km tiene", "info"],
    ["que autos tienen?", "catalogo"],
    ["tienen alguna pickup?", "catalogo"],
    ["algun utilitario asi?", "catalogo"],
    ["estoy buscando un auto chico", "catalogo"],
    ["sigue disponible?", "disponibilidad"],
    ["esa se vendio?", "disponibilidad"],
    ["hacen financiacion?", "financiacion"],
    ["financiasion en cuotas", "financiacion"],
    ["toman usados?", "permuta"],
    ["tengo un usado para entregar", "permuta"],
    ["formas de pago", "pagos"],
    ["a que hora abren?", "horarios"],
    ["donde estan?", "ubicacion"],
    ["tienen garantia?", "garantia"],
    ["que papeles necesito", "documentacion"],
    ["hablo con el dueño?", "humano"],
    ["quiero hablar con un vendedor", "humano"],
    ["pasame con nati", "humano"],
    ["me pasas un numero?", "humano"],
    ["sos un bot?", "identidad"],
    ["es una persona la que me atiende?", "identidad"],
    ["avisame cuando entre una hilux", "avisame"],
    ["mostrame mas", "ver_mas"],
    ["tenes otro?", "ver_mas"],
    ["si", "afirmacion"],
    ["sii dale", "afirmacion"],
    ["dale", "afirmacion"],
    ["👍", "afirmacion"],
    ["no", "negacion"],
    ["no, ese no es", "negacion"],
    ["no gracias", "negacion"],
  ])("%j → %s", (texto, esperada) => {
    expect(detectarIntenciones(texto)[0]).toBe(esperada);
  });
});

describe("detectarIntenciones — varias a la vez y orden de prioridad", () => {
  it("devuelve todas en orden de prioridad", () => {
    expect(detectarIntenciones("hola, tienen alguna pickup?")).toEqual(["catalogo", "saludo"]);
    expect(detectarIntenciones("hola buenas, cuanto sale?")).toEqual(["precio", "saludo"]);
    expect(detectarIntenciones("chau gracias")).toEqual(["gracias", "despedida"]);
    expect(detectarIntenciones("no gracias")).toEqual(["negacion", "gracias"]);
  });

  it("humano gana sobre el resto", () => {
    expect(detectarIntenciones("quiero el precio hablando con el dueño")[0]).toBe("humano");
  });
});

describe("detectarIntenciones — falsos positivos que hay que evitar", () => {
  it("'si' dentro de una frase larga no es una afirmacion", () => {
    expect(detectarIntenciones("si tienen financiacion me interesa")).not.toContain("afirmacion");
    expect(detectarIntenciones("si tienen financiacion me interesa")[0]).toBe("financiacion");
  });

  it("'no' dentro de una frase larga no es una negacion", () => {
    expect(detectarIntenciones("no se si tienen alguna pickup nafta")).not.toContain("negacion");
  });

  it("'automatico' como transmision no es identidad", () => {
    expect(detectarIntenciones("busco uno automatico")).not.toContain("identidad");
  });

  it("'cuando' no dispara 'avisame' por si solo", () => {
    expect(detectarIntenciones("cuando puedo ir a verlo")).not.toContain("avisame");
  });
});

describe("detectarIntenciones — sin coincidencias", () => {
  it("devuelve desconocida", () => {
    expect(detectarIntenciones("asdfgh")).toEqual(["desconocida"]);
    expect(detectarIntenciones("")).toEqual(["desconocida"]);
    expect(detectarIntenciones("???")).toEqual(["desconocida"]);
  });
});
