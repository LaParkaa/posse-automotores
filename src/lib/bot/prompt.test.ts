import { describe, expect, it } from "vitest";
import { buildSystemPrompt, EMPRESA } from "./prompt";

describe("buildSystemPrompt", () => {
  const stock = "- Toyota Corolla XEI | 2011 | 180.000 km | Nafta | Manual | 1.8 | Sedán | USD 9.500";

  it("incluye el stock tal cual", () => {
    expect(buildSystemPrompt(stock)).toContain(stock);
  });

  it("pone el inventario despues de las instrucciones", () => {
    const prompt = buildSystemPrompt(stock);

    expect(prompt.indexOf("INVENTARIO DISPONIBLE (formato")).toBeGreaterThan(
      prompt.indexOf("Sos el asistente"),
    );
    expect(prompt.indexOf(stock)).toBeGreaterThan(prompt.indexOf("INVENTARIO DISPONIBLE (formato"));
  });

  it("nombra la empresa, el WhatsApp para derivar y la herramienta de leads", () => {
    const prompt = buildSystemPrompt(stock);

    expect(prompt).toContain(EMPRESA.nombre);
    expect(prompt).toContain(EMPRESA.whatsapp);
    expect(prompt).toContain("guardar_lead");
  });

  it("le prohibe al modelo ofrecer autos fuera de la lista y inventar datos", () => {
    const prompt = buildSystemPrompt(stock);

    expect(prompt).toContain("INVENTARIO DISPONIBLE");
    expect(prompt).toMatch(/Nunca inventes precios/);
  });

  it("le prohibe inventar links", () => {
    expect(buildSystemPrompt(stock)).toMatch(/Nunca inventes links/);
  });
});
