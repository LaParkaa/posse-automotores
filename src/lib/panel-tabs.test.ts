import { describe, expect, it } from "vitest";
import { tabDeHash, urlDeTab } from "./panel-tabs";

describe("tabDeHash", () => {
  it("sin hash abre el menú de inicio", () => {
    expect(tabDeHash("")).toBe("inicio");
    expect(tabDeHash("#")).toBe("inicio");
  });

  it("reconoce cada sección, con o sin #, sin importar mayúsculas", () => {
    expect(tabDeHash("#stock")).toBe("stock");
    expect(tabDeHash("llaves")).toBe("llaves");
    expect(tabDeHash("#Metricas")).toBe("metricas");
  });

  it("un hash desconocido cae en el inicio", () => {
    expect(tabDeHash("#cualquier-cosa")).toBe("inicio");
    expect(tabDeHash("#inicio")).toBe("inicio");
    expect(tabDeHash("#__proto__")).toBe("inicio");
  });
});

describe("urlDeTab", () => {
  it("el inicio es /panel y las secciones llevan su hash", () => {
    expect(urlDeTab("inicio")).toBe("/panel");
    expect(urlDeTab("llaves")).toBe("/panel#llaves");
  });

  it("ida y vuelta con tabDeHash", () => {
    for (const tab of ["inicio", "stock", "llaves", "metricas"] as const) {
      expect(tabDeHash(urlDeTab(tab).split("#")[1] ?? "")).toBe(tab);
    }
  });
});
