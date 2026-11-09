import { describe, expect, it } from "vitest";
import { validarPedidoChat } from "./pedido";

const VISITANTE = "3f2b8c1e-9a4d-4e57-b0aa-0d6f5c1e7a21";
const ficha = { visitante: VISITANTE, pagina: "ficha", slug: "vw-taos-2022" };
const catalogo = { visitante: VISITANTE, pagina: "catalogo" };

describe("validarPedidoChat: lo que acepta", () => {
  it("una opción desde la ficha", () => {
    expect(validarPedidoChat({ ...ficha, opcion: "financiar" })).toEqual({
      visitante: VISITANTE,
      pagina: "ficha",
      slug: "vw-taos-2022",
      opcion: "financiar",
    });
  });

  it("un texto, recortado", () => {
    expect(validarPedidoChat({ ...ficha, texto: "  hola  " })).toEqual({
      visitante: VISITANTE,
      pagina: "ficha",
      slug: "vw-taos-2022",
      texto: "hola",
    });
  });

  it("el inicio de la charla", () => {
    expect(validarPedidoChat({ ...ficha, inicio: true })).toEqual({
      visitante: VISITANTE,
      pagina: "ficha",
      slug: "vw-taos-2022",
      inicio: true,
    });
  });

  it("en el catálogo el slug es null o no viene", () => {
    expect(validarPedidoChat({ ...catalogo, texto: "bmw" })?.slug).toBeNull();
    expect(validarPedidoChat({ ...catalogo, slug: null, texto: "bmw" })?.slug).toBeNull();
  });

  it("acepta 500 caracteres justos (cuenta caracteres, no unidades UTF-16)", () => {
    expect(validarPedidoChat({ ...catalogo, texto: "a".repeat(500) })).not.toBeNull();
    expect(validarPedidoChat({ ...catalogo, texto: "😀".repeat(500) })).not.toBeNull();
  });

  it("ignora campos de más", () => {
    expect(validarPedidoChat({ ...ficha, opcion: "financiar", extra: 1 })).toEqual({
      visitante: VISITANTE,
      pagina: "ficha",
      slug: "vw-taos-2022",
      opcion: "financiar",
    });
  });
});

describe("validarPedidoChat: lo que rechaza (devuelve null, nunca lanza)", () => {
  it.each([null, "hola", [], 7, undefined, true])("cuerpo que no es un objeto: %j", (cuerpo) => {
    expect(validarPedidoChat(cuerpo)).toBeNull();
  });

  it.each([undefined, null, "x", "corto", "a".repeat(65), "con espacio 123456", "../../etc/passwd", 12345678, {}])(
    "visitante inválido: %j",
    (visitante) => {
      expect(validarPedidoChat({ ...ficha, visitante, opcion: "financiar" })).toBeNull();
    },
  );

  it.each(["inicio", "otra", "", null, undefined, 1])("página inválida: %j", (pagina) => {
    expect(validarPedidoChat({ ...ficha, pagina, opcion: "financiar" })).toBeNull();
  });

  it.each(["../etc/passwd", "VW-Taos", "vw taos", "vw--taos", "-vw", "vw-", "a/b", "", 5, {}, "a".repeat(121)])(
    "slug inválido en ficha: %j",
    (slug) => {
      expect(validarPedidoChat({ ...ficha, slug, opcion: "financiar" })).toBeNull();
    },
  );

  it("en la ficha el slug es obligatorio", () => {
    expect(validarPedidoChat({ visitante: VISITANTE, pagina: "ficha", opcion: "financiar" })).toBeNull();
    expect(validarPedidoChat({ visitante: VISITANTE, pagina: "ficha", slug: null, opcion: "financiar" })).toBeNull();
  });

  it("en el catálogo un slug (aunque sea válido) se rechaza", () => {
    expect(validarPedidoChat({ ...catalogo, slug: "vw-taos-2022", texto: "hola" })).toBeNull();
    expect(validarPedidoChat({ ...catalogo, slug: "../x", texto: "hola" })).toBeNull();
  });

  it.each(["hack", "", "FINANCIAR", "__proto__", "toString", "constructor", 1, {}, ["financiar"]])(
    "opción inventada: %j",
    (opcion) => {
      expect(validarPedidoChat({ ...ficha, opcion })).toBeNull();
    },
  );

  it("texto de 501 caracteres", () => {
    expect(validarPedidoChat({ ...ficha, texto: "a".repeat(501) })).toBeNull();
    expect(validarPedidoChat({ ...ficha, texto: "😀".repeat(501) })).toBeNull();
  });

  it("texto de 5000 caracteres", () => {
    expect(validarPedidoChat({ ...ficha, texto: "a".repeat(5000) })).toBeNull();
  });

  it.each(["", "   ", "\n\t \r", "\u0000", "\u0000\u0007", "\ud800"])("texto vacío tras limpiarlo: %j", (texto) => {
    expect(validarPedidoChat({ ...ficha, texto })).toBeNull();
  });

  it.each([1, true, {}, ["hola"]])("texto que no es string: %j", (texto) => {
    expect(validarPedidoChat({ ...ficha, texto })).toBeNull();
  });

  it("texto y opción juntos", () => {
    expect(validarPedidoChat({ ...ficha, texto: "hola", opcion: "financiar" })).toBeNull();
  });

  it("texto con inicio, opción con inicio", () => {
    expect(validarPedidoChat({ ...ficha, texto: "hola", inicio: true })).toBeNull();
    expect(validarPedidoChat({ ...ficha, opcion: "financiar", inicio: true })).toBeNull();
  });

  it("ninguno de texto, opción o inicio", () => {
    expect(validarPedidoChat(ficha)).toBeNull();
    expect(validarPedidoChat(catalogo)).toBeNull();
  });

  it.each([false, 1, "true", {}])("inicio que no es true: %j", (inicio) => {
    expect(validarPedidoChat({ ...ficha, inicio })).toBeNull();
  });
});

describe("validarPedidoChat: el texto aceptado entra en Postgres", () => {
  it("saca caracteres de control y los saltos pasan a espacios", () => {
    expect(validarPedidoChat({ ...ficha, texto: "ho\u0007la\nque\ttal\u0000" })?.texto).toBe("hola que tal");
  });

  it("un surrogate suelto se descarta: '\\ud800 hola'", () => {
    expect(validarPedidoChat({ ...ficha, texto: "\ud800 hola" })?.texto).toBe("hola");
  });

  it("un NUL al final se descarta: 'hola\\u0000'", () => {
    expect(validarPedidoChat({ ...ficha, texto: "hola\u0000" })?.texto).toBe("hola");
  });

  it("emojis y tildes quedan", () => {
    expect(validarPedidoChat({ ...ficha, texto: "¿Cuánto sale? 🚗" })?.texto).toBe("¿Cuánto sale? 🚗");
  });

  it("el tope se mide sobre el texto ya limpio", () => {
    expect(validarPedidoChat({ ...ficha, texto: `${"a".repeat(500)}\u0000\u0000\u0000` })?.texto).toBe("a".repeat(500));
  });
});
