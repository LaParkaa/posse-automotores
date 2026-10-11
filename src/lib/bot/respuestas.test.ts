import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { violacionesDeTono } from "./__fixtures__/tono";
import { NEGOCIO } from "./negocio";
import {
  alternativaTexto,
  botonNati,
  datosVehiculo,
  elegir,
  linkFicha,
  precioDe,
  primerNombre,
  tarjetaContacto,
  tarjetaDe,
  urlImagen,
} from "./respuestas";

const por = (id: string) => CATALOGO.find((v) => v.id === id)!;
const ctx = { negocio: NEGOCIO, siteUrl: "https://posse.example" };

describe("elegir", () => {
  it("es determinista y siempre devuelve una de las variantes", () => {
    const vs = ["a", "b", "c"];

    expect(elegir(vs, "mid.1")).toBe(elegir(vs, "mid.1"));
    for (const s of ["x", "mid.2", "mid.99", ""]) expect(vs).toContain(elegir(vs, s));
  });

  it("reparte entre las variantes segun la semilla", () => {
    const usadas = new Set(Array.from({ length: 30 }, (_, i) => elegir(["a", "b", "c"], `mid.${i}`)));

    expect(usadas.size).toBeGreaterThan(1);
  });

  it("lanza con una lista vacia", () => {
    expect(() => elegir([], "x")).toThrow();
  });
});

describe("precioDe", () => {
  it("devuelve el precio cargado", () => {
    expect(precioDe(por("v-206"))).toBe("$9.500.000");
    expect(precioDe(por("v-vento"))).toBe("USD 14.500");
  });

  it("devuelve null si esta vacio o dice 'Consulta...'", () => {
    expect(precioDe(por("v-208"))).toBeNull();
    expect(precioDe({ ...por("v-206"), precio_texto: "" })).toBeNull();
    expect(precioDe({ ...por("v-206"), precio_texto: "Consultar" })).toBeNull();
    expect(precioDe({ ...por("v-206"), precio_texto: "  consulta por precio " })).toBeNull();
  });
});

describe("linkFicha", () => {
  it("arma el link a la ficha sin barras dobles", () => {
    expect(linkFicha(por("v-206"), "https://posse.example")).toBe("https://posse.example/vehiculos/peugeot-206-1-6-2011");
    expect(linkFicha(por("v-206"), "https://posse.example/")).toBe("https://posse.example/vehiculos/peugeot-206-1-6-2011");
  });

  it("sin siteUrl devuelve la ruta relativa", () => {
    expect(linkFicha(por("v-206"), "")).toBe("/vehiculos/peugeot-206-1-6-2011");
  });
});

describe("urlImagen", () => {
  it("acepta https absoluta", () => {
    expect(urlImagen(por("v-206"), "https://posse.example")).toBe("https://img.example/peugeot-206-1-6-2011.jpg");
  });

  it("completa rutas del propio sitio y rechaza lo que Instagram no acepta", () => {
    expect(urlImagen({ ...por("v-206"), cover_image_url: "/img/206.jpg" }, "https://posse.example/")).toBe("https://posse.example/img/206.jpg");
    expect(urlImagen({ ...por("v-206"), cover_image_url: "/img/206.jpg" }, "")).toBeNull();
    expect(urlImagen({ ...por("v-206"), cover_image_url: "http://x/y.jpg" }, "https://posse.example")).toBeNull();
    expect(urlImagen({ ...por("v-206"), cover_image_url: null }, "https://posse.example")).toBeNull();
  });
});

describe("datosVehiculo", () => {
  it("resume año, km, combustible y transmision", () => {
    expect(datosVehiculo(por("v-206"))).toBe("2011 · 177.000 km · Nafta · Manual");
  });

  it("omite el km si no esta cargado", () => {
    expect(datosVehiculo({ ...por("v-206"), kilometraje: "Consultá km" })).toBe("2011 · Nafta · Manual");
  });
});

describe("botonNati y tarjetas", () => {
  it("el boton abre el WhatsApp de Nati con el mensaje del auto", () => {
    const b = botonNati(por("v-206"), NEGOCIO);

    expect(b.titulo).toBe("Hablar con Nati");
    expect(b.titulo.length).toBeLessThanOrEqual(20);
    expect(b.url.startsWith("https://wa.me/5493537558947?text=")).toBe(true);
    expect(decodeURIComponent(b.url)).toContain("Peugeot 206 1.6");
  });

  it("sin auto, el boton manda una consulta general", () => {
    expect(decodeURIComponent(botonNati(null, NEGOCIO).url)).toContain("Quiero consultar por un vehículo");
  });

  it("tarjetaDe lleva foto, datos, precio y los dos botones", () => {
    const t = tarjetaDe(por("v-206"), ctx);

    expect(t.titulo).toBe("Peugeot 206 1.6 2011");
    expect(t.subtitulo).toContain("177.000 km");
    expect(t.subtitulo).toContain("$9.500.000");
    expect(t.imagenUrl).toBe("https://img.example/peugeot-206-1-6-2011.jpg");
    expect(t.botones.map((b) => b.titulo)).toEqual(["Ver en la web", "Hablar con Nati"]);
    expect(t.botones[0].url).toBe("https://posse.example/vehiculos/peugeot-206-1-6-2011");
  });

  it("sin precio cargado el subtitulo manda a consultarlo con Nati", () => {
    const t = tarjetaDe(por("v-208"), ctx);

    expect(t.subtitulo).toContain("Nati");
    expect(t.subtitulo).not.toMatch(/consult[aá] precio/i);
  });

  it("tarjetaContacto es una tarjeta sin foto con solo el boton de Nati", () => {
    const t = tarjetaContacto(null, ctx);

    expect(t.imagenUrl).toBeNull();
    expect(t.botones).toHaveLength(1);
    expect(t.botones[0].titulo).toBe("Hablar con Nati");
  });
});

describe("limites de Instagram en las tarjetas", () => {
  const largo = { ...por("v-206"), nombre: "N".repeat(120), combustible: "C".repeat(120) };
  const cp = (s: string) => Array.from(s).length;

  it("trunca titulo y subtitulo a 80 caracteres con puntos suspensivos", () => {
    const t = tarjetaDe(largo, ctx);

    expect(cp(t.titulo)).toBe(80);
    expect(t.titulo.endsWith("…")).toBe(true);
    expect(cp(t.subtitulo)).toBe(80);
    expect(t.subtitulo.endsWith("…")).toBe(true);
  });

  it("cuenta por code points: un emoji nunca queda cortado a la mitad", () => {
    const t = tarjetaDe({ ...por("v-206"), nombre: "🚗".repeat(100) }, ctx);

    expect(cp(t.titulo)).toBe(80);
    expect(t.titulo).toBe("🚗".repeat(79) + "…");
  });

  it("toda tarjeta tiene al menos un boton y respeta los limites de largo", () => {
    const tarjetas = [tarjetaDe(por("v-206"), ctx), tarjetaDe(largo, ctx), tarjetaContacto(null, ctx), tarjetaContacto(por("v-208"), ctx)];

    for (const t of tarjetas) {
      expect(t.botones.length).toBeGreaterThanOrEqual(1);
      for (const b of t.botones) expect(cp(b.titulo)).toBeLessThanOrEqual(20);
      expect(cp(t.titulo)).toBeLessThanOrEqual(80);
      expect(cp(t.subtitulo)).toBeLessThanOrEqual(80);
    }
  });

  it("recorta el titulo del boton si la secretaria tiene un nombre largo", () => {
    const b = botonNati(null, { ...NEGOCIO, secretaria: "Maria de los Angeles" });

    expect(cp(b.titulo)).toBeLessThanOrEqual(20);
  });

  it("tarjetaContacto con auto lleva el auto en el boton y sin auto es general", () => {
    const con = tarjetaContacto(por("v-206"), ctx);
    const sin = tarjetaContacto(null, ctx);

    expect(decodeURIComponent(con.botones[0].url)).toContain("Peugeot 206 1.6");
    expect(decodeURIComponent(sin.botones[0].url)).toContain("Quiero consultar por un vehículo");
  });
});

describe("alternativaTexto", () => {
  it("lista los autos con su precio y su link para el caso en que falle la tarjeta", () => {
    const t = alternativaTexto([por("v-206"), por("v-208")], ctx);

    expect(t).toContain("Peugeot 206 1.6");
    expect(t).toContain("$9.500.000");
    expect(t).toContain("https://posse.example/vehiculos/peugeot-206-1-6-2011");
    expect(t).toContain("https://posse.example/vehiculos/peugeot-208-style-2023");
  });

  it("una linea por auto, sin encabezado, y 'precio con Nati' si no hay precio", () => {
    const lineas = alternativaTexto([por("v-206"), por("v-208")], ctx).split("\n");

    expect(lineas).toEqual([
      "• Peugeot 206 1.6 2011 · $9.500.000 · https://posse.example/vehiculos/peugeot-206-1-6-2011",
      "• Peugeot 208 Style 2023 · precio con Nati · https://posse.example/vehiculos/peugeot-208-style-2023",
    ]);
  });

  it("lista como maximo 5 autos y cumple las reglas de tono", () => {
    const t = alternativaTexto(CATALOGO.slice(0, 8), ctx);

    expect(violacionesDeTono(t)).toEqual([]);
    expect(t.split("\n").filter((l) => l.startsWith("•"))).toHaveLength(5);
  });
});

describe("primerNombre", () => {
  it("toma la primera palabra del nombre del perfil", () => {
    expect(primerNombre({ nombre: "Juan Perez" })).toBe("Juan");
    expect(primerNombre({ nombre: "  ana  " })).toBe("ana");
  });

  it("devuelve null si no hay nombre", () => {
    expect(primerNombre(null)).toBeNull();
    expect(primerNombre({ usuario: "juan94" })).toBeNull();
    expect(primerNombre({ nombre: "   " })).toBeNull();
  });
});
