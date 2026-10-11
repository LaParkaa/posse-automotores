import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, buildWhatsAppUrlInstagram, WHATSAPP_LOCAL } from "./utils";

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
      "Hola, vi el Reel del Chevrolet Agile 1.4 LS 🚗🎥 y entré a la web. ¡Quiero más info!"
    );
  });

  it("apunta siempre al mismo numero de WhatsApp", () => {
    const url = buildWhatsAppUrl({ nombre: "X", tipo: null, promocionado_reel: false });
    expect(url.startsWith("https://wa.me/5493537558947?text=")).toBe(true);
  });
});

describe("buildWhatsAppUrlInstagram", () => {
  it("arma el link al WhatsApp del local con el mensaje de un auto desde Instagram", () => {
    const url = buildWhatsAppUrlInstagram({ nombre: "Peugeot 206 1.6", tipo: "Hatchback" });

    expect(url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram 📲. Me interesa el Peugeot 206 1.6 🚗. ¿Sigue disponible?",
    );
  });

  it("usa 'la' y la moto para las motos", () => {
    const url = buildWhatsAppUrlInstagram({ nombre: "Honda XR 150", tipo: "Moto" });

    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram 📲. Me interesa la Honda XR 150 🏍️. ¿Sigue disponible?",
    );
  });

  it("sin auto manda una consulta general", () => {
    const url = buildWhatsAppUrlInstagram(null);

    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram 📲. Quiero consultar por un vehículo.",
    );
  });

  it("el numero compartido es el de Nati", () => {
    expect(WHATSAPP_LOCAL).toBe("5493537558947");
  });
});
