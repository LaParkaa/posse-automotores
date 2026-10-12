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

  it("los datos no confirmados son null (el bot dice que Nati los confirma)", () => {
    expect(NEGOCIO.horarios).toBeNull();
    expect(NEGOCIO.direccion).toBeNull();
  });

  it("la pausa cuando contesta una persona es de horas positivas", () => {
    expect(NEGOCIO.pausaHumanoHoras).toBeGreaterThan(0);
  });
});
