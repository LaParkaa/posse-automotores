import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { violacionesDeTono } from "./__fixtures__/tono";
import { NEGOCIO } from "./negocio";
import {
  alternativaTexto,
  botonContacto,
  datosVehiculo,
  elegir,
  linkFicha,
  listaNumerada,
  precioDe,
  primerNombre,
  tarjetaContacto,
  tarjetaDe,
  tarjetaEleccion,
  tarjetaPostulacion,
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

describe("botonContacto y tarjetas", () => {
  it("el boton abre el WhatsApp de Marcos con el mensaje del auto", () => {
    const b = botonContacto(por("v-206"), NEGOCIO);

    expect(b.titulo).toBe("Hablar con Marcos");
    expect(b.titulo.length).toBeLessThanOrEqual(20);
    expect(b.url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
    expect(decodeURIComponent(b.url)).toContain("Peugeot 206 1.6");
  });

  it("sin auto, el boton manda una consulta general", () => {
    expect(decodeURIComponent(botonContacto(null, NEGOCIO).url)).toContain("Quiero consultar por un vehículo");
  });

  it("tarjetaDe lleva foto, datos, precio y los dos botones", () => {
    const t = tarjetaDe(por("v-206"), ctx);

    expect(t.titulo).toBe("Peugeot 206 1.6 2011");
    expect(t.subtitulo).toContain("177.000 km");
    expect(t.subtitulo).toContain("$9.500.000");
    expect(t.imagenUrl).toBe("https://img.example/peugeot-206-1-6-2011.jpg");
    expect(t.botones.map((b) => b.titulo)).toEqual(["Ver en la web", "Hablar con Marcos"]);
    expect(t.botones[0].url).toBe("https://posse.example/vehiculos/peugeot-206-1-6-2011");
  });

  it("sin precio cargado el subtitulo manda a consultarlo con Marcos", () => {
    const t = tarjetaDe(por("v-208"), ctx);

    expect(t.subtitulo).toContain("Marcos");
    expect(t.subtitulo).not.toMatch(/consult[aá] precio/i);
  });

  it("tarjetaContacto es una tarjeta sin foto con solo el boton de Marcos", () => {
    const t = tarjetaContacto(null, ctx);

    expect(t.imagenUrl).toBeNull();
    expect(t.botones).toHaveLength(1);
    expect(t.botones[0].titulo).toBe("Hablar con Marcos");
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
    const b = botonContacto(null, { ...NEGOCIO, secretaria: "Maria de los Angeles" });

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

  it("una linea por auto, sin encabezado, y 'precio con Marcos' si no hay precio", () => {
    const lineas = alternativaTexto([por("v-206"), por("v-208")], ctx).split("\n");

    expect(lineas).toEqual([
      "• Peugeot 206 1.6 2011 · $9.500.000 · https://posse.example/vehiculos/peugeot-206-1-6-2011",
      "• Peugeot 208 Style 2023 · precio con Marcos · https://posse.example/vehiculos/peugeot-208-style-2023",
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

describe("URLs validas para Instagram (boton y link en texto)", () => {
  const sinHttps = [
    ["siteUrl vacio", ""],
    ["siteUrl http de desarrollo", "http://localhost:3000"],
  ] as const;

  for (const [caso, siteUrl] of sinHttps) {
    it(`tarjetaDe con ${caso} deja solo el boton de Marcos`, () => {
      const t = tarjetaDe(por("v-206"), { negocio: NEGOCIO, siteUrl });

      expect(t.botones).toHaveLength(1);
      expect(t.botones[0].titulo).toBe("Hablar con Marcos");
      expect(t.botones[0].url.startsWith("https://")).toBe(true);
    });

    it(`alternativaTexto con ${caso} no incluye link a la ficha`, () => {
      const t = alternativaTexto([por("v-206"), por("v-208")], { negocio: NEGOCIO, siteUrl });

      expect(t).not.toContain("/vehiculos/");
      expect(t.split("\n")).toEqual(["• Peugeot 206 1.6 2011 · $9.500.000", "• Peugeot 208 Style 2023 · precio con Marcos"]);
    });
  }

  it("con https la tarjeta sigue llevando 'Ver en la web'", () => {
    expect(tarjetaDe(por("v-206"), ctx).botones).toHaveLength(2);
  });
});

describe("urlImagen: URL absoluta https valida y codificada", () => {
  const img = (cover: string | null, siteUrl = "https://posse.example/") => urlImagen({ ...por("v-206"), cover_image_url: cover }, siteUrl);

  it("codifica espacios en rutas del sitio y en URLs absolutas", () => {
    expect(img("/img/frente local.jpg")).toBe("https://posse.example/img/frente%20local.jpg");
    expect(img("https://xyz.supabase.co/storage/a b.webp")).toBe("https://xyz.supabase.co/storage/a%20b.webp");
  });

  it("normaliza el esquema y el host a minusculas", () => {
    expect(img("HTTPS://X/y.jpg")).toBe("https://x/y.jpg");
  });

  it("resuelve rutas relativas sin barra inicial contra siteUrl https", () => {
    expect(img("img/a.jpg")).toBe("https://posse.example/img/a.jpg");
    expect(img("img/a.jpg", "")).toBeNull();
    expect(img("img/a.jpg", "http://localhost:3000")).toBeNull();
  });

  it("rechaza protocolo relativo, otros protocolos y valores vacios", () => {
    expect(img("//cdn/x.jpg")).toBeNull();
    // Una barra invertida no puede sacar la URL del sitio hacia otro host.
    expect(img("/\evil.example/x.jpg")?.startsWith("https://posse.example/") ?? true).toBe(true);
    expect(img("javascript:alert(1)")).toBeNull();
    expect(img("ftp://x/y.jpg")).toBeNull();
    expect(img("   ")).toBeNull();
    expect(img("")).toBeNull();
  });
});

describe("precioDe y km: 'sin datos' no es un dato", () => {
  const conPrecio = (precio_texto: string) => precioDe({ ...por("v-206"), precio_texto });
  const conKm = (kilometraje: string) => datosVehiculo({ ...por("v-206"), kilometraje });

  it("precioDe devuelve null para placeholders sin cifra", () => {
    for (const p of ["Consultá precio", "Consulte", "A convenir", "Sin datos", "   "]) expect(conPrecio(p)).toBeNull();
  });

  it("precioDe conserva el precio cuando el texto trae una cifra", () => {
    expect(conPrecio("$9.500.000 (consultar financiación)")).toBe("$9.500.000 (consultar financiación)");
    expect(conPrecio("USD 9500 negociable")).toBe("USD 9500 negociable");
  });

  it("el km 'Sin datos' o 'Consultá km' no se muestra, pero '0 km' y '177.000 km' si", () => {
    expect(conKm("Sin datos")).toBe("2011 · Nafta · Manual");
    expect(conKm("Consultá km")).toBe("2011 · Nafta · Manual");
    expect(conKm("0 km")).toBe("2011 · 0 km · Nafta · Manual");
    expect(conKm("177.000 km")).toBe("2011 · 177.000 km · Nafta · Manual");
  });

  it("la tarjeta tampoco muestra un km sin datos", () => {
    const t = tarjetaDe({ ...por("v-206"), kilometraje: "Sin datos" }, ctx);

    expect(t.subtitulo).toBe("Nafta · $9.500.000");
  });
});

describe("subtitulo de la tarjeta: nunca se corta el precio", () => {
  const cp = (s: string) => Array.from(s).length;

  it("recorta km y combustible primero y deja el precio entero", () => {
    const t = tarjetaDe({ ...por("v-vento"), kilometraje: "9".repeat(60) + " km", combustible: "C".repeat(60) }, ctx);

    expect(cp(t.subtitulo)).toBeLessThanOrEqual(80);
    expect(t.subtitulo).toContain("USD 14.500");
    expect(t.subtitulo).toContain("…");
  });

  it("si el precio solo supera 80 caracteres, recien ahi se recorta", () => {
    const t = tarjetaDe({ ...por("v-206"), precio_texto: "$" + "9".repeat(100) }, ctx);

    expect(cp(t.subtitulo)).toBe(80);
    expect(t.subtitulo.endsWith("…")).toBe(true);
  });
});

describe("alternativaTexto: tope de 1000 bytes", () => {
  const bytes = (s: string) => new TextEncoder().encode(s).length;

  it("sin autos devuelve cadena vacia", () => {
    expect(alternativaTexto([], ctx)).toBe("");
  });

  it("descarta autos del final hasta entrar en 1000 bytes", () => {
    const largos = CATALOGO.slice(0, 5).map((v, i) => ({ ...v, nombre: `Modelo ${i} ` + "ñ".repeat(60), slug: "s".repeat(80) + i }));
    const t = alternativaTexto(largos, ctx);

    expect(bytes(t)).toBeLessThanOrEqual(1000);
    expect(t).not.toBe("");
    expect(t.split("\n").length).toBeLessThan(5);
    expect(t).toContain("Modelo 0");
    expect(violacionesDeTono(t)).toEqual([]);
  });
});

describe("primerNombre: solo nombres que parezcan un nombre", () => {
  it("devuelve null si la primera palabra no tiene letras o trae digitos", () => {
    for (const n of ["juan94", "🚗", "1234", "🚗 Juan"]) expect(primerNombre({ nombre: n })).toBeNull();
  });

  it("pasa a minuscula con inicial mayuscula un nombre todo en mayusculas", () => {
    expect(primerNombre({ nombre: "JUAN" })).toBe("Juan");
    expect(primerNombre({ nombre: "MARÍA JOSÉ" })).toBe("María");
  });

  it("no toca los nombres normales", () => {
    expect(primerNombre({ nombre: "juan perez" })).toBe("juan");
    expect(primerNombre({ nombre: "McDonald" })).toBe("McDonald");
  });
});

describe("tarjetaEleccion: lista numerada para identificar un auto (historias)", () => {
  it("un disponible es su tarjeta normal con el numero adelante del titulo", () => {
    const t = tarjetaEleccion(por("v-206"), 2, ctx);

    expect(t.titulo).toBe("2) Peugeot 206 1.6 2011");
    expect(t.subtitulo).toBe(tarjetaDe(por("v-206"), ctx).subtitulo);
    expect(t.botones).toEqual(tarjetaDe(por("v-206"), ctx).botones);
  });

  it("un vendido o reservado no se ofrece como compra: sin precio, con su estado y solo el boton de la secretaria", () => {
    const vendido = tarjetaEleccion(por("v-partner"), 1, ctx);
    const reservado = tarjetaEleccion(por("v-xr150"), 3, ctx);

    expect(vendido.titulo).toBe("1) Peugeot Partner 2014");
    expect(vendido.subtitulo).toMatch(/vendi/i);
    expect(vendido.botones).toEqual([botonContacto(por("v-partner"), NEGOCIO)]);
    expect(reservado.subtitulo).toMatch(/reservad/i);
    expect(reservado.subtitulo).not.toContain("3.200.000");
    expect(reservado.imagenUrl).toBe("https://img.example/honda-xr-150-2022.jpg");
  });

  it("respeta los limites de Instagram con nombres muy largos", () => {
    const largo = { ...por("v-partner"), nombre: "X".repeat(200), kilometraje: "9".repeat(200) };
    const t = tarjetaEleccion(largo, 5, ctx);

    expect(Array.from(t.titulo).length).toBeLessThanOrEqual(80);
    expect(Array.from(t.subtitulo).length).toBeLessThanOrEqual(80);
  });
});

describe("listaNumerada", () => {
  it("una linea por auto, numerada, con el estado si no esta disponible y sin precios", () => {
    const texto = listaNumerada([por("v-amarok"), por("v-partner"), por("v-xr150")]);

    expect(texto.split("\n")).toEqual([
      "1) Volkswagen Amarok V6 Extreme 2025",
      "2) Peugeot Partner 2014 (vendido)",
      "3) Honda XR 150 2022 (reservado)",
    ]);
  });

  it("como maximo 5 autos y cumple las reglas de tono", () => {
    const texto = listaNumerada([...CATALOGO, ...CATALOGO]);

    expect(texto.split("\n")).toHaveLength(5);
    expect(violacionesDeTono(texto)).toEqual([]);
  });

  it("sin autos devuelve vacio", () => {
    expect(listaNumerada([])).toBe("");
  });
});

describe("tarjetaPostulacion", () => {
  it("lleva al WhatsApp de Marcos con el mensaje completo y respeta los limites de Instagram", () => {
    const t = tarjetaPostulacion({ nombre: "Juan Pérez", edad: 28, localidad: "Posse", experiencia_ventas: "3 años" }, ctx);
    const mensaje = decodeURIComponent(t.botones[0].url.split("?text=")[1]);

    expect(t.titulo).toBe("Puesto de vendedor");
    expect(t.imagenUrl).toBeNull();
    expect(t.botones).toHaveLength(1);
    expect(t.botones[0].titulo).toBe("Enviar a Marcos");
    expect(Array.from(t.botones[0].titulo).length).toBeLessThanOrEqual(20);
    expect(Array.from(t.titulo).length).toBeLessThanOrEqual(80);
    expect(Array.from(t.subtitulo).length).toBeLessThanOrEqual(80);
    expect(t.botones[0].url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
    expect(mensaje).toContain("Nombre: Juan Pérez");
    expect(mensaje).toContain("Edad: 28 años");
    expect(mensaje).toContain("Experiencia en ventas: 3 años");
  });

  it("funciona sin datos", () => {
    const t = tarjetaPostulacion({}, ctx);

    expect(decodeURIComponent(t.botones[0].url.split("?text=")[1])).toContain("puesto de vendedor");
  });
});
