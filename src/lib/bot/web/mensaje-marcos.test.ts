import { describe, expect, it } from "vitest";
import { WHATSAPP_LOCAL } from "../../utils";
import { armarMensajeMarcos } from "./mensaje-marcos";

const taos = { nombre: "Volkswagen Taos", anio: 2022, tipo: "Auto", slug: "vw-taos-2022" };
const textoDe = (url: string) => decodeURIComponent(url.split("text=")[1]);

describe("armarMensajeMarcos", () => {
  it("arma el mensaje con auto y detalle, y el link lo repite tal cual", () => {
    const r = armarMensajeMarcos({
      vehiculo: taos,
      detalle: ["Quiero financiarlo.", "Anticipo: hasta 3 millones.", "Cuotas: 24."],
    });
    expect(r.texto).toBe(
      "Hola Marcos, te escribo desde la web. Me interesa el Volkswagen Taos 2022. Quiero financiarlo. Anticipo: hasta 3 millones. Cuotas: 24. ¿Sigue disponible?",
    );
    expect(r.url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`)).toBe(true);
    expect(textoDe(r.url)).toBe(r.texto);
  });

  it("sin auto consulta por un vehículo y no pregunta si sigue disponible", () => {
    const r = armarMensajeMarcos({ vehiculo: null, detalle: ["Quiero hablar con alguien del equipo."] });
    expect(r.texto).toBe(
      "Hola Marcos, te escribo desde la web. Quiero consultar por un vehículo. Quiero hablar con alguien del equipo.",
    );
    expect(r.texto).not.toContain("¿Sigue disponible?");
  });

  it("si el auto no está disponible no pregunta si sigue disponible", () => {
    for (const estado of ["vendido", "reservado"] as const) {
      const r = armarMensajeMarcos({ vehiculo: taos, detalle: ["Quiero financiarlo."], estado });
      expect(r.texto).toBe("Hola Marcos, te escribo desde la web. Me interesa el Volkswagen Taos 2022. Quiero financiarlo.");
      expect(textoDe(r.url)).toBe(r.texto);
    }
    expect(armarMensajeMarcos({ vehiculo: taos, detalle: [], estado: "disponible" }).texto).toContain("¿Sigue disponible?");
  });

  it("usa 'la' para las motos", () => {
    const r = armarMensajeMarcos({ vehiculo: { nombre: "Honda XR 150", anio: 2022, tipo: "Moto", slug: "x" }, detalle: [] });
    expect(r.texto).toContain("Me interesa la Honda XR 150 2022.");
  });

  it("saca emojis, saltos de línea e invisibles del texto y del link", () => {
    const r = armarMensajeMarcos({
      vehiculo: taos,
      detalle: ["Tengo un 🚗 BMW\n2016\u200D 😀 para entregar."],
    });
    expect(r.texto).toContain("Tengo un BMW 2016 para entregar.");
    expect(r.texto).not.toMatch(/[\p{Extended_Pictographic}\n\u200D\uFE0F]/u);
    expect(r.url).not.toMatch(/%F0%9F|%0A|%E2%80%8D|%EF%B8%8F/i);
    expect(textoDe(r.url)).toBe(r.texto);
  });

  it("saca banderas, keycaps y caracteres de etiqueta del texto y del link", () => {
    const r = armarMensajeMarcos({ vehiculo: taos, detalle: ["vivo en \u{1F1E6}\u{1F1F7} ok 1️⃣ y \u{1F3F4}\u{E0067}\u{E007F} listo."] });
    expect(r.texto).toContain("vivo en ok 1 y listo.");
    expect(r.url).not.toMatch(/%F0%9F%87|%E2%83%A3|%F3%A0|%EF%B8%8F/i);
    expect(textoDe(r.url)).toBe(r.texto);
  });

  it("con pares suplentes sueltos no tira error y el link sigue siendo válido", () => {
    for (const [sucio, esperado] of [["\ud800 hola", "hola"], ["hola \udc00", "hola"], ["x\ud83dy", "xy"]]) {
      const r = armarMensajeMarcos({ vehiculo: taos, detalle: [sucio] });
      expect(r.url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`)).toBe(true);
      expect(textoDe(r.url)).toBe(r.texto);
      expect(r.texto).toContain(`Me interesa el Volkswagen Taos 2022. ${esperado} ¿Sigue disponible?`);
    }
  });

  it("si el detalle es larguísimo el link queda en 1700 o menos y no corta un %XX", () => {
    const r = armarMensajeMarcos({ vehiculo: taos, detalle: ["Tengo para entregar: " + "a".repeat(500)] });
    expect(r.url.length).toBeLessThanOrEqual(1700);
    expect(r.texto.endsWith("?")).toBe(true);
    const codificado = r.url.split("text=")[1];
    expect(codificado).not.toMatch(/%[0-9A-Fa-f]?$/);
    expect(() => decodeURIComponent(codificado)).not.toThrow();
    expect(textoDe(r.url)).toBe(r.texto);
  });

  it("con texto acentuado muy largo (6 bytes por letra) también entra y se decodifica bien", () => {
    const r = armarMensajeMarcos({ vehiculo: taos, detalle: ["Tengo para entregar: " + "ñ".repeat(900), "Cuotas: 24."] });
    expect(r.url.length).toBeLessThanOrEqual(1700);
    expect(() => decodeURIComponent(r.url.split("text=")[1])).not.toThrow();
    expect(textoDe(r.url)).toBe(r.texto);
  });

  it("codifica bien & # % y comillas", () => {
    const r = armarMensajeMarcos({ vehiculo: taos, detalle: ['Anticipo: 50% & más #1 "ya".'] });
    expect(r.texto).toContain('Anticipo: 50% & más #1 "ya".');
    expect(r.url.split("text=")[1]).not.toMatch(/[&#"]|%(?![0-9A-F]{2})/);
    expect(textoDe(r.url)).toBe(r.texto);
  });
});
