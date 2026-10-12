import { describe, expect, it } from "vitest";
import { detectarIntenciones } from "./intenciones";

describe("detectarIntenciones — la intencion principal (primera)", () => {
  it.each([
    ["hola", "saludo"],
    ["holaaa", "saludo"],
    ["Holaa", "saludo"],
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

describe("detectarIntenciones — humano no se lleva las preguntas por el vehiculo", () => {
  it.each([
    "numero de patente",
    "numero de motor",
    "numero de chasis",
    "me das el numero de la hilux",
    "es primer dueño?",
    "tuvo un solo dueño?",
    "el dueño anterior",
  ])("%j no es humano", (texto) => {
    expect(detectarIntenciones(texto)).not.toContain("humano");
  });

  it.each([
    "me pasas un numero?",
    "me das el numero?",
    "me das el numero de telefono",
    "pasame el numero de whatsapp",
    "me das un numero de contacto",
    "quiero hablar con el dueño",
    "pasame con el dueño",
    "el dueño?",
  ])("%j es humano", (texto) => {
    expect(detectarIntenciones(texto)[0]).toBe("humano");
  });
});

describe("detectarIntenciones — la negacion por primer token no se come las preguntas", () => {
  it("no tienen financiacion? es financiacion y no negacion", () => {
    const intenciones = detectarIntenciones("no tienen financiacion?");
    expect(intenciones[0]).toBe("financiacion");
    expect(intenciones).not.toContain("negacion");
  });

  it("\"no hay mas fotos?\" no se confunde con una pregunta de disponibilidad", () => {
    expect(detectarIntenciones("no hay mas fotos?")).not.toContain("disponibilidad");
  });

  it.each([
    ["no se vendio?", "disponibilidad"],
    ["no me pasas el precio?", "precio"],
  ])("%j → %s", (texto, esperada) => {
    const intenciones = detectarIntenciones(texto);
    expect(intenciones[0]).toBe(esperada);
    expect(intenciones).not.toContain("negacion");
  });

  it("las negativas sueltas siguen siendo negacion", () => {
    expect(detectarIntenciones("no")[0]).toBe("negacion");
    expect(detectarIntenciones("nop")[0]).toBe("negacion");
    expect(detectarIntenciones("no, ese no es")[0]).toBe("negacion");
    expect(detectarIntenciones("no gracias")[0]).toBe("negacion");
  });
});

describe("detectarIntenciones — las palabras exactas no se aproximan", () => {
  it("'atiende' no es 'atienden' (horarios)", () => {
    expect(detectarIntenciones("es una persona la que me atiende?")).not.toContain("horarios");
  });

  it("'bueno' no es 'buenas' (saludo)", () => {
    expect(detectarIntenciones("bueno dale")).not.toContain("saludo");
  });

  it("'saludo' no es 'saludos' (despedida)", () => {
    expect(detectarIntenciones("saludo")).not.toContain("despedida");
  });

  it("valores y costos siguen siendo precio, cheques sigue siendo pagos", () => {
    expect(detectarIntenciones("valores")).toContain("precio");
    expect(detectarIntenciones("costos")).toContain("precio");
    expect(detectarIntenciones("cheques")).toContain("pagos");
  });
});

describe("detectarIntenciones — palabras sueltas que daban falsos positivos", () => {
  it("'lista' como adjetivo no es catalogo", () => {
    expect(detectarIntenciones("esta lista para transferir?")).not.toContain("catalogo");
  });

  it("'la lista' si es catalogo", () => {
    expect(detectarIntenciones("pasame la lista")).toContain("catalogo");
  });

  it("'mis datos' no es info", () => {
    expect(detectarIntenciones("te paso mis datos")).not.toContain("info");
  });

  it("'datos' a secas sigue siendo info", () => {
    expect(detectarIntenciones("me pasas los datos?")).toContain("info");
  });
});

describe("detectarIntenciones — permuta y cuota", () => {
  it.each([
    "cuanto me das por mi auto",
    "me toman mi auto?",
    "me tomas mi usado?",
  ])("%j → permuta", (texto) => {
    expect(detectarIntenciones(texto)[0]).toBe("permuta");
  });

  it("'cuota' en singular es financiacion", () => {
    expect(detectarIntenciones("tienen una cuota?")).toContain("financiacion");
  });
});
