import { describe, expect, it } from "vitest";
import { buildWhatsAppUrlWeb, limpioParaLink, WHATSAPP_LOCAL } from "../utils";
import { CATALOGO } from "./__fixtures__/catalogo";
import { conversar, type EntradaMotor, type ResultadoMotor } from "./motor";
import { NEGOCIO } from "./negocio";
import { tarjetaDe } from "./respuestas";
import { sesionNueva } from "./sesion";

const AHORA = new Date("2026-10-11T15:00:00Z");

const entradaBase: EntradaMotor = {
  texto: null,
  adjuntos: [],
  historiaId: null,
  vehiculoDeHistoria: null,
  mid: "mid.0",
  sesion: sesionNueva(AHORA),
  catalogo: CATALOGO,
  perfil: null,
  ahora: AHORA,
  siteUrl: "https://posse.test",
  negocio: NEGOCIO,
};

const decodificada = (url: string) => decodeURIComponent(url.split("?text=")[1]);

/** Todo lo que el usuario puede ver o tocar: textos, tarjetas, botones y el mensaje de cada link. */
function visible(r: ResultadoMotor): string[] {
  return r.mensajes.flatMap((m) =>
    m.tipo === "texto"
      ? [m.texto]
      : [
          m.alternativaTexto,
          ...m.tarjetas.flatMap((t) => [t.titulo, t.subtitulo, ...t.botones.flatMap((b) => [b.titulo, b.url, decodeURIComponent(b.url)])]),
        ],
  );
}

describe("buildWhatsAppUrlWeb", () => {
  it("sin auto manda una consulta general", () => {
    const url = buildWhatsAppUrlWeb(null);
    expect(url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`)).toBe(true);
    expect(decodificada(url)).toBe("Hola, te escribo desde la web. Quiero consultar por un vehículo.");
  });

  it("con un auto lo nombra", () => {
    const url = buildWhatsAppUrlWeb({ nombre: "Volkswagen Taos", tipo: "Auto" });
    expect(url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`)).toBe(true);
    expect(decodificada(url)).toBe("Hola, te escribo desde la web. Me interesa el Volkswagen Taos. ¿Sigue disponible?");
  });

  it("usa 'la' para las motos", () => {
    const url = buildWhatsAppUrlWeb({ nombre: "Honda XR 150", tipo: "Moto" });
    expect(decodificada(url)).toBe("Hola, te escribo desde la web. Me interesa la Honda XR 150. ¿Sigue disponible?");
  });

  it("no lleva emojis", () => {
    for (const v of [null, { nombre: "Peugeot 206", tipo: "Hatchback" }, { nombre: "Honda XR 150", tipo: "Moto" }]) {
      expect(decodificada(buildWhatsAppUrlWeb(v))).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("limpioParaLink", () => {
  it("esta exportada: saca emojis y recorta", () => {
    expect(limpioParaLink("Hola 🚗 mundo", 50)).toBe("Hola mundo");
    expect(limpioParaLink("abcdef", 3)).toBe("abc");
  });
});

describe("canal en las tarjetas", () => {
  const v = CATALOGO[0];
  const botonMarcos = (canal?: "web" | "instagram") =>
    tarjetaDe(v, { negocio: NEGOCIO, siteUrl: "https://posse.test", ...(canal ? { canal } : {}) }).botones.find((b) =>
      b.titulo.startsWith("Hablar con"),
    )!;

  it("en la web el mensaje a Marcos dice 'desde la web'", () => {
    expect(decodificada(botonMarcos("web").url)).toContain("desde la web");
  });

  it("sin canal sigue diciendo 'desde Instagram'", () => {
    expect(decodificada(botonMarcos().url)).toContain("desde Instagram");
    expect(decodificada(botonMarcos("instagram").url)).toContain("desde Instagram");
  });
});

describe("motor con canal web: nada menciona Instagram", () => {
  const textos = [
    "hola",
    "cuánto sale",
    "tienen una pick-up",
    "busco trabajo",
    "sos un bot?",
    "quiero financiar",
    "aceptan permuta",
    "dónde están",
    "avisame cuando entre un gol",
    "mi cel es 3537 123456",
    "asdkj qwe",
  ];

  for (const texto of textos) {
    it(`"${texto}"`, () => {
      const r = conversar({ ...entradaBase, canal: "web", texto });
      for (const pieza of visible(r)) expect(pieza).not.toMatch(/instagram/i);
    });
  }

  it("tambien al recorrer una charla entera (audio, foto, historia no conocida)", () => {
    for (const e of [
      { texto: null, adjuntos: ["audio"] },
      { texto: null, adjuntos: ["image"] },
      { texto: "hola", historiaId: "st-1" },
      { texto: "tienen el 206?" },
      { texto: "el vento no", historiaId: "st-2" },
    ]) {
      const r = conversar({ ...entradaBase, canal: "web", ...e });
      for (const pieza of visible(r)) expect(pieza).not.toMatch(/instagram/i);
    }
  });

  it("los botones de contacto dicen 'desde la web'", () => {
    const r = conversar({ ...entradaBase, canal: "web", texto: "tienen el 206?" });
    const urls = r.mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas.flatMap((t) => t.botones.map((b) => b.url)) : []));
    const wa = urls.filter((u) => u.startsWith("https://wa.me/"));
    expect(wa.length).toBeGreaterThan(0);
    for (const u of wa) expect(decodificada(u)).toContain("desde la web");
  });

  it("'busco trabajo' no inicia la postulacion: responde con el contacto de Marcos", () => {
    const r = conversar({ ...entradaBase, canal: "web", texto: "busco trabajo" });
    expect(r.sesion.paso).toBe("libre");
    const botones = r.mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas.flatMap((t) => t.botones) : []));
    expect(botones.some((b) => b.titulo.includes("Marcos") && b.url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`))).toBe(true);
    expect(visible(r).join("\n")).toContain("Marcos");
  });

  it("por Instagram (sin canal) 'busco trabajo' sigue iniciando la postulacion", () => {
    const r = conversar({ ...entradaBase, texto: "busco trabajo" });
    expect(r.sesion.paso).toBe("postulando");
  });
});
