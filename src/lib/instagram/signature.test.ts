import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verificarFirma } from "./signature";

const SECRET = "app-secret-de-prueba";

function firmar(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verificarFirma", () => {
  const body = '{"object":"instagram","entry":[]}';

  it("acepta una firma valida", () => {
    expect(verificarFirma(body, firmar(body), SECRET)).toBe(true);
  });

  it("acepta cuerpos con acentos y emojis (se firma el UTF-8 exacto)", () => {
    const conEmoji = '{"text":"¿Tienen una Amarok? 🚗"}';

    expect(verificarFirma(conEmoji, firmar(conEmoji), SECRET)).toBe(true);
  });

  it("rechaza si el cuerpo fue alterado", () => {
    expect(verificarFirma(`${body} `, firmar(body), SECRET)).toBe(false);
  });

  it("rechaza si la firma se hizo con otro secret", () => {
    expect(verificarFirma(body, firmar(body, "otro-secret"), SECRET)).toBe(false);
  });

  it("rechaza si falta el header o no tiene el prefijo sha256=", () => {
    expect(verificarFirma(body, null, SECRET)).toBe(false);
    expect(verificarFirma(body, "", SECRET)).toBe(false);
    expect(verificarFirma(body, firmar(body).replace("sha256=", ""), SECRET)).toBe(false);
  });

  it("rechaza hex invalido o de otra longitud sin lanzar", () => {
    expect(verificarFirma(body, "sha256=zz", SECRET)).toBe(false);
    expect(verificarFirma(body, "sha256=abcd", SECRET)).toBe(false);
  });
});
