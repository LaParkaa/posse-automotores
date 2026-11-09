import { describe, expect, it } from "vitest";
import { evaluarLimite, LIMITES } from "./limites";

describe("LIMITES", () => {
  it("tiene los topes de la spec", () => {
    expect(LIMITES).toEqual({ maxTexto: 500, maxBytes: 2000, porVisitante: 30, global: 300, ventanaMinutos: 10 });
  });
});

describe("evaluarLimite", () => {
  it("sin mensajes recientes está ok", () => {
    expect(evaluarLimite({ visitante: 0, global: 0 })).toBe("ok");
  });

  it("el mensaje 30 todavía entra (se cuentan los anteriores), el 31 no", () => {
    expect(evaluarLimite({ visitante: 29, global: 10 })).toBe("ok");
    expect(evaluarLimite({ visitante: 30, global: 10 })).toBe("visitante");
  });

  it("el tope global frena aunque el visitante esté en cero", () => {
    expect(evaluarLimite({ visitante: 0, global: 299 })).toBe("ok");
    expect(evaluarLimite({ visitante: 29, global: 300 })).toBe("global");
  });

  it("si se pasan los dos, manda el del visitante", () => {
    expect(evaluarLimite({ visitante: 99, global: 999 })).toBe("visitante");
  });
});
