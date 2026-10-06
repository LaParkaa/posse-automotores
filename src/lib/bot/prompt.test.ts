import { describe, expect, it } from "vitest";
import { buildSystemBlocks, EMPRESA } from "./prompt";

describe("buildSystemBlocks", () => {
  const stock = "- Toyota Corolla XEI | 2011 | 180.000 km | Nafta | Manual | 1.8 | Sedán | USD 9.500";

  it("devuelve instrucciones + inventario, y marca el cache solo en el ultimo bloque", () => {
    const [instrucciones, inventario] = buildSystemBlocks(stock);

    expect(buildSystemBlocks(stock)).toHaveLength(2);
    expect(instrucciones.cache_control).toBeUndefined();
    // El cache de Anthropic cubre todo el prefijo hasta el bloque marcado.
    expect(inventario.cache_control).toEqual({ type: "ephemeral" });
  });

  it("incluye el stock tal cual en el bloque de inventario", () => {
    const [, inventario] = buildSystemBlocks(stock);

    expect(inventario.text).toContain(stock);
  });

  it("las instrucciones nombran la empresa, el WhatsApp para derivar y la herramienta de leads", () => {
    const [instrucciones] = buildSystemBlocks(stock);

    expect(instrucciones.text).toContain(EMPRESA.nombre);
    expect(instrucciones.text).toContain(EMPRESA.whatsapp);
    expect(instrucciones.text).toContain("guardar_lead");
  });

  it("le prohibe al modelo ofrecer autos fuera de la lista", () => {
    const [instrucciones] = buildSystemBlocks(stock);

    expect(instrucciones.text).toContain("INVENTARIO DISPONIBLE");
    expect(instrucciones.text).toMatch(/Nunca inventes/);
  });

  it("le prohibe inventar links de vehiculos", () => {
    const [instrucciones] = buildSystemBlocks(stock);

    expect(instrucciones.text).toMatch(/Nunca inventes links/);
  });
});
