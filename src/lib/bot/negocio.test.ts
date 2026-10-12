import { describe, expect, it } from "vitest";
import { WHATSAPP_LOCAL } from "../utils";
import { NEGOCIO } from "./negocio";

describe("NEGOCIO", () => {
  it("usa el numero de WhatsApp compartido, solo digitos con codigo de pais", () => {
    expect(NEGOCIO.whatsappNumero).toBe(WHATSAPP_LOCAL);
    expect(NEGOCIO.whatsappNumero).toMatch(/^\d{11,15}$/);
  });

  it("tiene el nombre de la secretaria y el numero visible", () => {
    expect(NEGOCIO.secretaria).toBe("Nati");
    expect(NEGOCIO.whatsappVisible).toBe("+54 9 3537 55-8947");
  });

  it("tiene los horarios del sitio", () => {
    expect(NEGOCIO.horarios).toContain("lunes a viernes de 9 a 13 y de 16 a 20");
    expect(NEGOCIO.horarios).toContain("sábados de 9 a 13");
    expect(NEGOCIO.horarios).toContain("domingos");
  });

  it("la direccion exacta sigue sin confirmar (el bot dice que Nati la pasa)", () => {
    expect(NEGOCIO.direccion).toBeNull();
  });

  it("reconoce el texto de la respuesta automatica de Instagram para no pausar el chat", () => {
    expect(NEGOCIO.mensajesAutomaticos.length).toBeGreaterThan(0);
    for (const frase of NEGOCIO.mensajesAutomaticos) expect(frase).toBe(frase.toLowerCase());
  });

  it("la pausa cuando contesta una persona es de horas positivas", () => {
    expect(NEGOCIO.pausaHumanoHoras).toBeGreaterThan(0);
  });
});
