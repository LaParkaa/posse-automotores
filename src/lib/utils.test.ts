import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "./utils";

describe("buildWhatsAppUrl", () => {
  it("arma el mensaje de catalogo web para un auto (no reel, no moto)", () => {
    const url = buildWhatsAppUrl({
      nombre: "Ford Mondeo Titanium 2.0",
      tipo: "Sedán",
      promocionado_reel: false,
    });
    const texto = decodeURIComponent(url.split("text=")[1]);
    expect(texto).toBe(
      "Hola, vengo desde el catálogo web 💻. Me interesa el Ford Mondeo Titanium 2.0 🚗. ¿Sigue disponible?"
    );
  });

  it("arma el mensaje de reel para una moto", () => {
    const url = buildWhatsAppUrl({
      nombre: "Honda XR 250",
      tipo: "Moto",
      promocionado_reel: true,
    });
    const texto = decodeURIComponent(url.split("text=")[1]);
    expect(texto).toBe(
      "Hola, vi el Reel de la Honda XR 250 🏍️🎥 y entré a la web. ¡Quiero más info!"
    );
  });

  it("usa articulo y emoji de auto cuando el tipo no es Moto (incluido null)", () => {
    const url = buildWhatsAppUrl({
      nombre: "Chevrolet Agile 1.4 LS",
      tipo: null,
      promocionado_reel: true,
    });
    const texto = decodeURIComponent(url.split("text=")[1]);
    expect(texto).toBe(
      "Hola, vi el Reel de el Chevrolet Agile 1.4 LS 🚗🎥 y entré a la web. ¡Quiero más info!"
    );
  });

  it("apunta siempre al mismo numero de WhatsApp", () => {
    const url = buildWhatsAppUrl({ nombre: "X", tipo: null, promocionado_reel: false });
    expect(url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
  });
});
