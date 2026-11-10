import { describe, expect, it } from "vitest";
import { enlaceBoton, etiquetaBoton, urlSegura } from "./urls";

const WA = "https://wa.me/5493537662444?text=Hola%20Marcos";

describe("urlSegura: whatsapp", () => {
  it("acepta solo https://wa.me/", () => {
    expect(urlSegura(WA, "whatsapp")).toBe(WA);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//evil.com",
    "http://wa.me/5493537662444",
    "https://wa.me.evil.com/x",
    "https://evil.com/?https://wa.me/",
    "wa.me/5493537662444",
    "hola",
    "",
    " https://wa.me/5493537662444",
    "https://wa.me/\\evil.com",
    "/vehiculos/gol",
  ])("rechaza %j", (url) => {
    expect(urlSegura(url, "whatsapp")).toBeNull();
  });

  it("rechaza lo que no es texto", () => {
    expect(urlSegura(null, "whatsapp")).toBeNull();
    expect(urlSegura(undefined, "whatsapp")).toBeNull();
    expect(urlSegura(42, "whatsapp")).toBeNull();
    expect(urlSegura({ toString: () => WA }, "whatsapp")).toBeNull();
  });
});

describe("urlSegura: boton", () => {
  it.each(["/vehiculos/vw-gol-2010", "/financiacion?auto=vw-gol-2010", "https://posse.com.ar/vehiculos/x", WA])(
    "acepta %j",
    (url) => {
      expect(urlSegura(url, "boton")).toBe(url);
    },
  );

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,hola",
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "http://evil.com",
    "http://localhost:3000/financiacion",
    "vehiculos/gol",
    "hola",
    "",
    "https://",
    "https://evil.com/a b",
    "/a\nb",
  ])("rechaza %j", (url) => {
    expect(urlSegura(url, "boton")).toBeNull();
  });
});

describe("urlSegura: imagen", () => {
  it("null queda null (sin foto)", () => {
    expect(urlSegura(null, "imagen")).toBeNull();
  });

  it.each(["/img/gol.jpg", "https://abc.supabase.co/storage/v1/object/public/autos/1.jpg"])("acepta %j", (url) => {
    expect(urlSegura(url, "imagen")).toBe(url);
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.com/x.jpg", "http://evil.com/x.jpg", "x.jpg"])(
    "rechaza %j",
    (url) => {
      expect(urlSegura(url, "imagen")).toBeNull();
    },
  );
});

describe("enlaceBoton", () => {
  const ORIGEN = "https://posse.com.ar";

  it("WhatsApp va aparte (abre en otra pestaña y se mide)", () => {
    expect(enlaceBoton(WA, ORIGEN)).toEqual({ href: WA, tipo: "whatsapp" });
  });

  it("ruta relativa es interna", () => {
    expect(enlaceBoton("/financiacion?auto=x", ORIGEN)).toEqual({ href: "/financiacion?auto=x", tipo: "interno" });
  });

  it("https del mismo sitio pasa a ruta relativa", () => {
    expect(enlaceBoton("https://posse.com.ar/vehiculos/x?a=1#f", ORIGEN)).toEqual({
      href: "/vehiculos/x?a=1#f",
      tipo: "interno",
    });
  });

  it("https de otro sitio es externo", () => {
    expect(enlaceBoton("https://otro.com/x", ORIGEN)).toEqual({ href: "https://otro.com/x", tipo: "externo" });
    expect(enlaceBoton("https://posse.com.ar.evil.com/x", ORIGEN)).toEqual({
      href: "https://posse.com.ar.evil.com/x",
      tipo: "externo",
    });
  });

  it("sin origen conocido, https queda externo", () => {
    expect(enlaceBoton("https://posse.com.ar/vehiculos/x", null)?.tipo).toBe("externo");
  });

  it("lo inseguro no es enlace", () => {
    expect(enlaceBoton("javascript:alert(1)", ORIGEN)).toBeNull();
    expect(enlaceBoton("//evil.com", ORIGEN)).toBeNull();
  });
});

describe("etiquetaBoton", () => {
  it("'Ver en la web' a una ficha del sitio se muestra como 'Ver ficha'", () => {
    expect(etiquetaBoton("Ver en la web", { href: "/vehiculos/x", tipo: "interno" })).toBe("Ver ficha");
  });

  it("el resto queda como lo manda el servidor", () => {
    expect(etiquetaBoton("Simular mi plan", { href: "/financiacion", tipo: "interno" })).toBe("Simular mi plan");
    expect(etiquetaBoton("Hablar con Marcos", { href: WA, tipo: "whatsapp" })).toBe("Hablar con Marcos");
    expect(etiquetaBoton("Ver en la web", { href: "https://otro.com/vehiculos/x", tipo: "externo" })).toBe(
      "Ver en la web",
    );
  });
});
