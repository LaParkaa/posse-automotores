import { describe, expect, it } from "vitest";
import { dispositivoDe, esRobot, origenDe, rutaSeSigue, slugDeHrefSimulador, slugDeRuta, validarEvento } from "./eventos";

const VID = "3f2b1c9e-7a44-4d0e-9b1a-0c5d6e7f8a9b";

describe("rutaSeSigue", () => {
  it("mide las paginas del publico y no el admin, el panel ni la API", () => {
    expect(rutaSeSigue("/")).toBe(true);
    expect(rutaSeSigue("/catalogo")).toBe(true);
    expect(rutaSeSigue("/vehiculos/gol")).toBe(true);
    expect(rutaSeSigue("/admin")).toBe(false);
    expect(rutaSeSigue("/admin/estadisticas")).toBe(false);
    expect(rutaSeSigue("/panel")).toBe(false);
    expect(rutaSeSigue("/api/eventos")).toBe(false);
  });

  it("no confunde un prefijo parecido ni acepta rutas raras", () => {
    expect(rutaSeSigue("/administracion")).toBe(true);
    expect(rutaSeSigue("catalogo")).toBe(false);
    expect(rutaSeSigue("/" + "a".repeat(300))).toBe(false);
  });
});

describe("slugs", () => {
  it("saca el auto de la ruta de una ficha", () => {
    expect(slugDeRuta("/vehiculos/volkswagen-gol-power-1-6-2010")).toBe("volkswagen-gol-power-1-6-2010");
    expect(slugDeRuta("/catalogo")).toBeNull();
    expect(slugDeRuta("/vehiculos/Bad Slug")).toBeNull();
  });

  it("saca el auto de un link al simulador", () => {
    expect(slugDeHrefSimulador("/financiacion?auto=ford-ranger-2-2-4x2-2012")).toBe("ford-ranger-2-2-4x2-2012");
    expect(slugDeHrefSimulador("/financiacion")).toBeNull();
    expect(slugDeHrefSimulador("/financiacion?auto=%E0%A4%A")).toBeNull();
  });
});

describe("validarEvento", () => {
  it("acepta un evento completo", () => {
    expect(validarEvento({ tipo: "whatsapp", ruta: "/vehiculos/gol-2010", vehiculo_slug: "gol-2010", visitante: VID, origen: "instagram" })).toEqual({
      tipo: "whatsapp", ruta: "/vehiculos/gol-2010", vehiculo_slug: "gol-2010", visitante: VID, origen: "instagram",
    });
  });

  it("una visita a la ficha cuenta para ese auto aunque no lo diga", () => {
    expect(validarEvento({ tipo: "visita", ruta: "/vehiculos/gol-2010" })?.vehiculo_slug).toBe("gol-2010");
  });

  it("descarta lo invalido en vez de guardarlo", () => {
    const e = validarEvento({ tipo: "visita", ruta: "/", vehiculo_slug: "NO VALIDO!", visitante: "x", origen: "tiktok" });
    expect(e).toEqual({ tipo: "visita", ruta: "/", vehiculo_slug: null, visitante: null, origen: null });
  });

  it.each([
    [null], ["texto"], [42], [{}],
    [{ tipo: "borrar", ruta: "/" }],
    [{ tipo: "visita" }],
    [{ tipo: "visita", ruta: "/admin" }],
    [{ tipo: "visita", ruta: 5 }],
  ])("rechaza %j", (entrada) => {
    expect(validarEvento(entrada)).toBeNull();
  });
});

describe("robots y dispositivo", () => {
  it("no cuenta robots ni pedidos sin user-agent", () => {
    expect(esRobot(null)).toBe(true);
    expect(esRobot("Googlebot/2.1")).toBe(true);
    expect(esRobot("WhatsApp/2.23")).toBe(true);
    expect(esRobot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(false);
  });

  it("distingue celular de compu", () => {
    expect(dispositivoDe("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("celular");
    expect(dispositivoDe("Mozilla/5.0 (Linux; Android 14) Mobile Safari")).toBe("celular");
    expect(dispositivoDe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe("compu");
    expect(dispositivoDe(null)).toBe("compu");
  });
});

describe("origenDe", () => {
  it.each([
    ["", "directo"],
    ["https://l.instagram.com/?u=x", "instagram"],
    ["https://www.instagram.com/", "instagram"],
    ["https://m.facebook.com/", "facebook"],
    ["https://www.google.com.ar/", "google"],
    ["https://wa.me/549", "whatsapp"],
    ["https://otrositio.com/nota", "otro"],
    ["no es una url", "otro"],
  ])("%j → %s", (referrer, esperado) => {
    expect(origenDe(referrer, "posse-automotores.vercel.app")).toBe(esperado);
  });

  it("si venia del propio sitio no es un origen", () => {
    expect(origenDe("https://posse-automotores.vercel.app/catalogo", "posse-automotores.vercel.app")).toBeNull();
    expect(origenDe("http://localhost:3000/", "localhost:3000")).toBeNull();
  });
});
