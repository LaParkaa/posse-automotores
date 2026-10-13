import { describe, expect, it } from "vitest";
import { duracionDe, edadDe, numeroEn, sinExperiencia } from "./numeros";

describe("numeroEn", () => {
  it("lee digitos y numeros en palabras, y dice cuantas palabras ocupan", () => {
    expect(numeroEn(["28"], 0)).toEqual({ valor: 28, largo: 1 });
    expect(numeroEn(["veintiocho"], 0)).toEqual({ valor: 28, largo: 1 });
    expect(numeroEn(["treinta"], 0)).toEqual({ valor: 30, largo: 1 });
    expect(numeroEn(["treinta", "y", "cinco"], 0)).toEqual({ valor: 35, largo: 3 });
    expect(numeroEn(["a", "cinco"], 1)).toEqual({ valor: 5, largo: 1 });
  });

  it("devuelve null si no es un numero, si el indice no existe o si es una palabra del sistema", () => {
    expect(numeroEn(["hola"], 0)).toBeNull();
    expect(numeroEn(["2024x"], 0)).toBeNull();
    expect(numeroEn(["1990"], 0)).toBeNull();
    expect(numeroEn(["cinco"], -1)).toBeNull();
    expect(numeroEn(["cinco"], 4)).toBeNull();
    for (const peligrosa of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(numeroEn([peligrosa], 0)).toBeNull();
    }
  });
});

describe("duracionDe: cuanto tiempo de experiencia dijo", () => {
  it.each([
    ["5 años", "5 años"],
    ["cinco años en ventas", "5 años"],
    ["tengo 5 años de experiencia", "5 años"],
    ["hace 3 años que vendo", "3 años"],
    ["6 meses", "6 meses"],
    ["seis meses en una agencia", "6 meses"],
    ["un año", "1 año"],
    ["1 año y medio", "1 año y medio"],
    ["medio año", "medio año"],
    ["treinta y cinco años", "35 años"],
    ["2 años y 3 meses", "2 años y 3 meses"],
    ["trabajé 10 AÑOS en autos", "10 años"],
  ])("'%s' → %s", (texto, esperado) => {
    expect(duracionDe(texto)).toBe(esperado);
  });

  it.each(["trabajé en una agencia", "años", "meses de trabajo", "en ventas", "", "constructor", "mucho tiempo"])(
    "'%s' no dice cuanto tiempo",
    (texto) => {
      expect(duracionDe(texto)).toBeNull();
    },
  );
});

describe("sinExperiencia", () => {
  it.each(["no", "ninguna", "nada", "sin experiencia", "nunca vendí", "es mi primer trabajo", "No tengo"])(
    "'%s' es no tener experiencia",
    (texto) => {
      expect(sinExperiencia(texto)).toBe(true);
    },
  );

  it.each(["trabajé en una agencia", "5 años", "vendía autos", "tengo experiencia"])("'%s' no lo es", (texto) => {
    expect(sinExperiencia(texto)).toBe(false);
  });
});

describe("edadDe", () => {
  it("con la edad preguntada vale un numero de 16 a 75 en cualquier frase", () => {
    expect(edadDe("28", true)).toBe(28);
    expect(edadDe("tengo 28", true)).toBe(28);
    expect(edadDe("28 años", true)).toBe(28);
    expect(edadDe("veintiocho", true)).toBe(28);
    expect(edadDe("tengo treinta y cinco años", true)).toBe(35);
    expect(edadDe("Tengo 3 hijos y 40 años", true)).toBe(40);
  });

  it("fuera de rango o sin numero no es una edad", () => {
    for (const mala of ["15", "76", "1990", "no sé", "mm", "", "tres"]) expect(edadDe(mala, true)).toBeNull();
  });

  it("de paso solo vale 'tengo N años' y no si es de experiencia", () => {
    expect(edadDe("hola, tengo 28 años, te mando mi cv", false)).toBe(28);
    expect(edadDe("tengo veintiocho años y vivo en Posse", false)).toBe(28);
    expect(edadDe("tengo 28", false)).toBeNull(); // sin "años" no se arriesga
    expect(edadDe("28 años de experiencia", false)).toBeNull();
    expect(edadDe("tengo 20 años de experiencia vendiendo", false)).toBeNull();
    expect(edadDe("tengo 20 años en ventas", false)).toBeNull();
    expect(edadDe("tengo 28 años en Posse", false)).toBe(28);
    expect(edadDe("tengo 28 años de edad", false)).toBe(28);
    expect(edadDe("5 años en ventas", false)).toBeNull();
  });
});
