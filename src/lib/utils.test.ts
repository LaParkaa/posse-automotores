import { describe, expect, it } from "vitest";
import {
  buildWhatsAppUrl,
  buildWhatsAppUrlInstagram,
  buildWhatsAppUrlPostulacion,
  WHATSAPP_LOCAL,
  WHATSAPP_RECLUTADOR,
} from "./utils";

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
      "Hola, te escribo desde Instagram. Me interesa el Peugeot 206 1.6. ¿Sigue disponible?",
    );
  });

  it("usa 'la' para las motos", () => {
    const url = buildWhatsAppUrlInstagram({ nombre: "Honda XR 150", tipo: "Moto" });

    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram. Me interesa la Honda XR 150. ¿Sigue disponible?",
    );
  });

  it("sin auto manda una consulta general", () => {
    const url = buildWhatsAppUrlInstagram(null);

    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram. Quiero consultar por un vehículo.",
    );
  });

  it("el mensaje no lleva emojis (Instagram los rompe en el link)", () => {
    const vehiculos = [{ nombre: "Peugeot 206", tipo: "Hatchback" }, { nombre: "Honda XR 150", tipo: "Moto" }, null] as const;

    for (const v of vehiculos) {
      const texto = decodeURIComponent(buildWhatsAppUrlInstagram(v).split("?text=")[1]);
      expect(texto).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("el numero compartido es el de Nati", () => {
    expect(WHATSAPP_LOCAL).toBe("5493537558947");
  });
});

describe("buildWhatsAppUrlPostulacion", () => {
  const MARCOS = { nombre: "Marcos", whatsappNumero: WHATSAPP_RECLUTADOR };
  const textoDe = (url: string) => decodeURIComponent(url.split("?text=")[1]);
  const COMPLETO = {
    nombre: "Juan Pérez",
    edad: 28,
    localidad: "Justiniano Posse",
    telefono: "3537 123456",
    experiencia_ventas: "3 años en una agencia",
    experiencia_rubro: "gestoría del automotor",
    financiaciones: "prendarios y créditos",
    disponibilidad: "jornada completa",
  };

  it("arma el mensaje completo para Marcos, con un dato por linea y emojis", () => {
    const url = buildWhatsAppUrlPostulacion(COMPLETO, MARCOS);

    expect(url.startsWith(`https://wa.me/${WHATSAPP_RECLUTADOR}?text=`)).toBe(true);
    expect(textoDe(url)).toBe(
      [
        "Hola Marcos ✌️, te escribo desde Instagram por el puesto de vendedor.",
        "✍️ Nombre: Juan Pérez",
        "☺️ Edad: 28 años",
        "⛳ Localidad: Justiniano Posse",
        "☎️ Teléfono: 3537 123456",
        "⭐ Experiencia en ventas: 3 años en una agencia",
        "⚙️ Experiencia en el rubro automotor: gestoría del automotor",
        "✅ Financiaciones: prendarios y créditos",
        "⏰ Disponibilidad: jornada completa",
        "Te mando mi CV ✉️",
      ].join("\n"),
    );
  });

  it("omite lo que el candidato no contesto", () => {
    const texto = textoDe(buildWhatsAppUrlPostulacion({ nombre: "Ana", edad: null, localidad: "Posse" }, MARCOS));

    expect(texto).toBe(
      [
        "Hola Marcos ✌️, te escribo desde Instagram por el puesto de vendedor.",
        "✍️ Nombre: Ana",
        "⛳ Localidad: Posse",
        "Te mando mi CV ✉️",
      ].join("\n"),
    );
    expect(textoDe(buildWhatsAppUrlPostulacion({}, MARCOS))).toBe(
      "Hola Marcos ✌️, te escribo desde Instagram por el puesto de vendedor.\nTe mando mi CV ✉️",
    );
  });

  it("solo usa simbolos del plano basico: el navegador de Instagram rompe los emojis de 4 bytes", () => {
    const texto = textoDe(buildWhatsAppUrlPostulacion({ ...COMPLETO, localidad: "Posse 🚗📍" }, MARCOS));

    for (const caracter of texto) expect(caracter.codePointAt(0)!, caracter).toBeLessThanOrEqual(0xffff);
    expect(texto).toContain("⛳ Localidad: Posse\n");
  });

  it("recorta las respuestas largas para que el link no pase del limite de Instagram", () => {
    const larga = "é".repeat(400);
    const url = buildWhatsAppUrlPostulacion(
      { ...COMPLETO, experiencia_ventas: larga, experiencia_rubro: larga, financiaciones: larga, disponibilidad: larga },
      MARCOS,
    );

    expect(url.length).toBeLessThanOrEqual(1700);
    expect(textoDe(url)).toContain("Nombre: Juan Pérez");
    expect(textoDe(url)).toContain("Te mando mi CV");
  });

  it("no usa el WhatsApp de Nati", () => {
    expect(buildWhatsAppUrlPostulacion(COMPLETO, MARCOS)).not.toContain(WHATSAPP_LOCAL);
  });
});
