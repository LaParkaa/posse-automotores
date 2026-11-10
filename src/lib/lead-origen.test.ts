import { describe, expect, it } from "vitest";
import { origenDeLead } from "./lead-origen";

describe("origenDeLead", () => {
  it("rotula cada canal", () => {
    expect(origenDeLead("instagram")).toBe("Instagram");
    expect(origenDeLead("web")).toBe("Página web");
    expect(origenDeLead("whatsapp")).toBe("WhatsApp");
  });

  it("lo que no tiene origen (leads viejos) sigue siendo WhatsApp", () => {
    expect(origenDeLead(null)).toBe("WhatsApp");
    expect(origenDeLead(undefined)).toBe("WhatsApp");
  });
});
