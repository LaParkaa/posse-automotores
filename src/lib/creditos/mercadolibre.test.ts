import { describe, expect, it } from "vitest";
import { urlBusquedaMercadoLibre } from "./mercadolibre";

describe("urlBusquedaMercadoLibre", () => {
  it("arma el slug con marca, modelo y año", () => {
    expect(urlBusquedaMercadoLibre("Peugeot", "208", "2014")).toBe("https://listado.mercadolibre.com.ar/peugeot-208-2014");
  });

  it("funciona sin año", () => {
    expect(urlBusquedaMercadoLibre("Chevrolet", "Corsa")).toBe("https://listado.mercadolibre.com.ar/chevrolet-corsa");
  });

  it("saca acentos y caracteres raros", () => {
    expect(urlBusquedaMercadoLibre("Citroën", "C4 Cactus")).toBe("https://listado.mercadolibre.com.ar/citroen-c4-cactus");
  });

  it("ignora marca/modelo vacíos", () => {
    expect(urlBusquedaMercadoLibre("", "")).toBe("https://listado.mercadolibre.com.ar/");
  });
});
