import { describe, expect, it } from "vitest";
import { siguienteSlugLibre } from "./slug";

describe("siguienteSlugLibre", () => {
  it("devuelve el slug base cuando no lo usa nadie", () => {
    expect(siguienteSlugLibre("vw-beetle-2015", [])).toBe("vw-beetle-2015");
  });

  it("agrega -2 cuando el base ya esta ocupado", () => {
    expect(siguienteSlugLibre("vw-beetle-2015", ["vw-beetle-2015"])).toBe("vw-beetle-2015-2");
  });

  it("sigue contando mientras los sufijos esten ocupados", () => {
    const ocupados = ["vw-beetle-2015", "vw-beetle-2015-2", "vw-beetle-2015-3"];
    expect(siguienteSlugLibre("vw-beetle-2015", ocupados)).toBe("vw-beetle-2015-4");
  });

  it("aprovecha un hueco en el medio de la numeracion", () => {
    const ocupados = ["vw-beetle-2015", "vw-beetle-2015-3"];
    expect(siguienteSlugLibre("vw-beetle-2015", ocupados)).toBe("vw-beetle-2015-2");
  });

  it("ignora slugs de otros modelos que empiezan parecido", () => {
    // El listado llega de un LIKE 'base%', asi que puede traer vecinos.
    const ocupados = ["vw-beetle-2015-cabrio", "vw-beetle-2015-turbo"];
    expect(siguienteSlugLibre("vw-beetle-2015", ocupados)).toBe("vw-beetle-2015");
  });

  it("cuenta tambien los slugs de vehiculos borrados", () => {
    // El borrado es logico: la fila sigue reteniendo el slug aunque no se vea.
    expect(siguienteSlugLibre("peugeot-208-allure-1-6-2021", ["peugeot-208-allure-1-6-2021"]))
      .toBe("peugeot-208-allure-1-6-2021-2");
  });

  it("no se confunde con un sufijo que no es numerico", () => {
    expect(siguienteSlugLibre("toro-2017", ["toro-2017", "toro-2017-a"])).toBe("toro-2017-2");
  });
});
