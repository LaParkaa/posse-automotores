import { describe, expect, it } from "vitest";
import { CATALOGO } from "../__fixtures__/catalogo";
import { NEGOCIO } from "../negocio";
import { sesionNueva } from "../sesion";
import type { VehiculoCatalogo } from "../types";
import { normalizarGuion, responderWeb, sanearTexto, type DepsAsistente, type EstadoWeb, type SalidaAsistente } from "./asistente";
import { sugerenciasPara } from "./sugerencias";
import { tarjetasAWeb } from "./tarjetas";
import type { EntradaChat, MensajeWeb, TarjetaWeb } from "./tipos";

const AHORA = new Date("2026-11-09T15:00:00Z");
const DEPS: DepsAsistente = { negocio: NEGOCIO, siteUrl: "https://posse.test", ahora: () => AHORA };

// El fixture del bot no trae ningun BMW: se suma uno para los casos de "bmw" de la spec.
const BMW: VehiculoCatalogo = {
  ...CATALOGO[0],
  id: "v-bmw",
  slug: "bmw-320i-2018",
  nombre: "BMW 320i",
  marca: "BMW",
  modelo: "320i",
  anio: 2018,
  kilometraje: "90.000 km",
  tipo: "Sedán",
  precio_texto: "USD 25.000",
  cover_image_url: "https://img.example/bmw-320i-2018.jpg",
  created_at: "2026-09-01T10:00:00Z",
};
const CAT: VehiculoCatalogo[] = [...CATALOGO, BMW];
const P206 = CAT.find((v) => v.id === "v-206")!;
const VENTO = CAT.find((v) => v.id === "v-vento")!;
const PARTNER = CAT.find((v) => v.id === "v-partner")!;

type Entrada = Partial<EntradaChat> & { mid?: string };

function responder(e: Entrada, estado: EstadoWeb | null = null): SalidaAsistente {
  return responderWeb({ pagina: "catalogo", slug: null, mid: "mid.1", ...e }, estado, CAT, DEPS);
}

const textos = (s: SalidaAsistente) => s.respuesta.mensajes.flatMap((m) => (m.tipo === "texto" ? [m.texto] : []));
const tarjetasDe = (s: SalidaAsistente): TarjetaWeb[] =>
  s.respuesta.mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas : []));
const todoElTexto = (s: SalidaAsistente) =>
  s.respuesta.mensajes.map((m) => (m.tipo === "tarjetas" ? m.tarjetas.map((t) => `${t.titulo} ${t.subtitulo}`).join("\n") : m.texto)).join("\n");
const cierreDe = (s: SalidaAsistente) => s.respuesta.mensajes.find((m): m is Extract<MensajeWeb, { tipo: "cierre" }> => m.tipo === "cierre");

/** Todo lo que el visitante puede ver o tocar: textos, tarjetas, botones, el cierre y el mensaje de cada link. */
function visible(s: SalidaAsistente): string[] {
  const deUrl = (url: string) => [url, decodeURIComponent(url)];
  return s.respuesta.mensajes.flatMap((m) => {
    if (m.tipo === "texto") return [m.texto];
    if (m.tipo === "cierre") return [m.texto, ...deUrl(m.url)];
    return m.tarjetas.flatMap((t) => [t.titulo, t.subtitulo, ...t.botones.flatMap((b) => [b.titulo, ...deUrl(b.url)])]);
  });
}

describe("inicio", () => {
  it("en la ficha saluda, muestra la tarjeta del auto y los chips de la ficha", () => {
    const s = responder({ pagina: "ficha", slug: P206.slug, inicio: true });
    const [m0, m1] = s.respuesta.mensajes;
    expect(m0.tipo).toBe("texto");
    expect(m0.tipo === "texto" && m0.texto).toContain("asistente de Posse Automotores");
    expect(m1.tipo).toBe("tarjetas");
    expect(m1.tipo === "tarjetas" && m1.tarjetas[0].slug).toBe(P206.slug);
    expect(s.respuesta.sugerencias).toEqual(["financiar", "usado", "disponible", "marcos"]);
    expect(s.estado.sesion.vehiculoActualId).toBe(P206.id);
  });

  it("en el catalogo saluda sin tarjetas y con los chips del catalogo", () => {
    const s = responder({ pagina: "catalogo", slug: null, inicio: true });
    expect(tarjetasDe(s)).toEqual([]);
    expect(textos(s).join(" ")).toContain("asistente de Posse Automotores");
    expect(s.respuesta.sugerencias).toEqual(["financiar", "buscar", "usado", "marcos"]);
  });

  it("en una ficha con slug inexistente se comporta como el catalogo, sin lanzar", () => {
    const s = responder({ pagina: "ficha", slug: "no-existe-2020", inicio: true });
    expect(tarjetasDe(s)).toEqual([]);
    expect(s.respuesta.sugerencias).toEqual(["financiar", "buscar", "usado", "marcos"]);
    expect(s.estado.sesion.vehiculoActualId).toBeNull();
  });

  it("en la ficha de un auto vendido dice que ya se vendio y ofrece buscar o hablar con Marcos", () => {
    const s = responder({ pagina: "ficha", slug: PARTNER.slug, inicio: true });
    expect(todoElTexto(s)).toContain("se vendió");
    expect(s.respuesta.sugerencias).toEqual(["buscar", "marcos"]);
  });
});

describe("texto libre", () => {
  it("'cuánto sale' en la ficha contesta el precio de ese auto", () => {
    const s = responder({ pagina: "ficha", slug: P206.slug, texto: "cuánto sale" });
    expect(todoElTexto(s)).toContain(P206.precio_texto);
  });

  it("'bmw' muestra la tarjeta del BMW y lo deja como auto actual", () => {
    const s = responder({ texto: "bmw" });
    const t = tarjetasDe(s)[0];
    expect(t.slug).toBe(BMW.slug);
    expect(t.estado).toBe("disponible");
    const botones = t.botones.map((b) => b.titulo);
    expect(botones).toContain("Ver en la web");
    expect(botones).toContain("Hablar con Marcos");
    expect(s.estado.sesion.vehiculoActualId).toBe(BMW.id);
  });

  it("'asdkj qwe' no se entiende; la segunda vez seguida ofrece el boton de Marcos", () => {
    const s1 = responder({ texto: "asdkj qwe" });
    expect(s1.noEntendido).toBe(true);
    const s2 = responder({ texto: "asdkj qwe", mid: "mid.2" }, s1.estado);
    expect(s2.noEntendido).toBe(true);
    expect(tarjetasDe(s2).some((t) => t.botones.some((b) => b.titulo === "Hablar con Marcos"))).toBe(true);
  });

  it("'avisame cuando entre un gol' pide el nombre (nombrando a Marcos) y despues junta el lead", () => {
    const s1 = responder({ texto: "avisame cuando entre un gol" });
    const t1 = todoElTexto(s1);
    expect(t1).toContain("Marcos");
    expect(t1).not.toMatch(/instagram/i);
    expect(t1.toLowerCase()).toContain("nombre");
    expect(s1.respuesta.sugerencias).toEqual([]);
    const s2 = responder({ texto: "Juan", mid: "mid.2" }, s1.estado);
    expect(s2.lead).toBeNull();
    const s3 = responder({ texto: "3537123456", mid: "mid.3" }, s2.estado);
    expect(s3.lead).not.toBeNull();
    expect(s3.lead!.nombre).toBe("Juan");
    expect(s3.lead!.telefono.replace(/\D/g, "")).toContain("3537123456");
  });
});

describe("guiones", () => {
  const enAnticipo = (): EstadoWeb => ({
    sesion: { ...sesionNueva(AHORA), vehiculoActualId: P206.id },
    guion: { flujo: "financiar", paso: "anticipo", datos: {} },
  });

  it("una pregunta suelta en medio del guion se contesta y se vuelve a hacer la pregunta pendiente", () => {
    const s = responder({ pagina: "ficha", slug: P206.slug, texto: "cuánto sale" }, enAnticipo());
    expect(todoElTexto(s)).toContain(P206.precio_texto);
    const ultimo = s.respuesta.mensajes[s.respuesta.mensajes.length - 1];
    expect(ultimo).toEqual({ tipo: "texto", texto: "Dale. ¿Con cuánto pensás entregar?" });
    expect(s.estado.guion.paso).toBe("anticipo");
    expect(s.respuesta.sugerencias).toEqual(["anticipo_sin", "anticipo_hasta_3", "anticipo_mas_3"]);
    expect(s.respuesta.mensajes.length).toBeLessThanOrEqual(3);
  });

  it("un texto que no es una pregunta conocida es la respuesta del paso", () => {
    const s = responder({ pagina: "ficha", slug: P206.slug, texto: "tengo 2 palos" }, enAnticipo());
    expect(s.estado.guion.paso).toBe("cuotas");
    expect(s.estado.guion.datos.anticipo).toBe("tengo 2 palos");
    expect(s.noEntendido).toBe(false);
  });

  it("'en 24 cuotas' en el paso de cuotas es la respuesta, no una pregunta sobre financiacion", () => {
    const estado: EstadoWeb = { ...enAnticipo(), guion: { flujo: "financiar", paso: "cuotas", datos: { anticipo: "sin anticipo" } } };
    const s = responder({ pagina: "ficha", slug: P206.slug, texto: "en 24 cuotas" }, estado);
    expect(cierreDe(s)?.texto).toContain("Cuotas: en 24 cuotas.");
  });

  it("financiar con un usado en la frase arranca el guion y el usado llega al mensaje para Marcos", () => {
    const s1 = responder({ pagina: "ficha", slug: P206.slug, texto: "quiero financiarlo, tengo un bmw 2016 para entregar" });
    expect(s1.estado.guion.flujo).toBe("financiar");
    expect(s1.respuesta.mensajes.length).toBeLessThanOrEqual(3);
    const s2 = responder({ pagina: "ficha", slug: P206.slug, opcion: "anticipo_sin", mid: "mid.2" }, s1.estado);
    const s3 = responder({ pagina: "ficha", slug: P206.slug, opcion: "cuotas_12", mid: "mid.3" }, s2.estado);
    const cierre = cierreDe(s3);
    expect(cierre).toBeDefined();
    expect(cierre!.texto).toContain("Tengo para entregar:");
    expect(cierre!.texto).toContain("2016");
    expect(cierre!.vehiculoSlug).toBe(P206.slug);
  });

  it("'seguir' vuelve a los chips iniciales de la pagina", () => {
    const s = responder({ opcion: "seguir" });
    expect(textos(s)).toEqual(["Dale, ¿qué más querés saber?"]);
    expect(s.respuesta.sugerencias).toEqual(["financiar", "buscar", "usado", "marcos"]);
    const f = responder({ pagina: "ficha", slug: P206.slug, opcion: "seguir" });
    expect(f.respuesta.sugerencias).toEqual(["financiar", "usado", "disponible", "marcos"]);
  });

  it("'buscar' pide marca, tipo o combustible sin chips y despues 'pick-up' muestra las pick-ups", () => {
    const s1 = responder({ opcion: "buscar" });
    expect(textos(s1)).toEqual(["Contame qué buscás: marca, tipo o combustible, y te muestro lo que tenemos."]);
    expect(s1.respuesta.sugerencias).toEqual([]);
    const s2 = responder({ texto: "pick-up", mid: "mid.2" }, s1.estado);
    const pickups = CAT.filter((v) => v.tipo === "Pick-up").map((v) => v.slug);
    const mostradas = tarjetasDe(s2).map((t) => t.slug);
    expect(mostradas.length).toBeGreaterThan(0);
    for (const slug of mostradas) expect(pickups).toContain(slug);
  });

  it("'confirmar_si' sobre una oferta de aviso del motor pide los datos (no arma un cierre)", () => {
    const estado: EstadoWeb = { sesion: { ...sesionNueva(AHORA), ofrecio: "aviso" }, guion: { flujo: null, paso: null, datos: {} } };
    const s = responder({ opcion: "confirmar_si" }, estado);
    expect(cierreDe(s)).toBeUndefined();
    expect(s.estado.sesion.paso).toBe("pidiendo_nombre");
  });
});

describe("cambio de ficha", () => {
  it("si la ficha es de otro auto lo avisa, muestra su tarjeta y lo toma como auto actual", () => {
    const estado: EstadoWeb = { sesion: { ...sesionNueva(AHORA), vehiculoActualId: P206.id }, guion: { flujo: null, paso: null, datos: {} } };
    const s = responder({ pagina: "ficha", slug: VENTO.slug, texto: "hola" }, estado);
    const [m0, m1] = s.respuesta.mensajes;
    expect(m0.tipo === "texto" && m0.texto).toContain("Ahora estás mirando");
    expect(m1.tipo === "tarjetas" && m1.tarjetas[0].slug).toBe(VENTO.slug);
    expect(s.estado.sesion.vehiculoActualId).toBe(VENTO.id);
    expect(s.respuesta.mensajes.length).toBeLessThanOrEqual(3);

    const otra = responder({ pagina: "ficha", slug: VENTO.slug, texto: "hola", mid: "mid.2" }, s.estado);
    expect(todoElTexto(otra)).not.toContain("Ahora estás mirando");
  });

  it("preguntar por otro auto desde la misma ficha no dispara el aviso en el mensaje siguiente", () => {
    const s1 = responder({ pagina: "ficha", slug: P206.slug, inicio: true });
    const s2 = responder({ pagina: "ficha", slug: P206.slug, texto: "bmw", mid: "mid.2" }, s1.estado);
    expect(s2.estado.sesion.vehiculoActualId).toBe(BMW.id);
    const s3 = responder({ pagina: "ficha", slug: P206.slug, texto: "cuánto sale", mid: "mid.3" }, s2.estado);
    expect(todoElTexto(s3)).not.toContain("Ahora estás mirando");
    expect(todoElTexto(s3)).toContain(BMW.precio_texto);
  });
});

describe("autos vendidos o reservados: no se arma financiacion ni permuta por ellos", () => {
  const XR150 = CAT.find((v) => v.id === "v-xr150")!;
  const sinGuion = (s: SalidaAsistente) => {
    expect(s.estado.guion.flujo).not.toBe("financiar");
    expect(s.estado.guion.flujo).not.toBe("usado");
    expect(cierreDe(s)).toBeUndefined();
  };

  it("vendido + 'quiero financiarlo' dice que se vendio y ofrece buscar", () => {
    const s = responder({ pagina: "ficha", slug: PARTNER.slug, texto: "quiero financiarlo" });
    sinGuion(s);
    expect(todoElTexto(s)).toContain("ya se vendió");
    expect(s.respuesta.sugerencias).toEqual(["buscar", "marcos"]);
    expect(tarjetasDe(s).some((t) => t.botones.some((b) => b.titulo === "Simular mi plan"))).toBe(false);
  });

  it("vendido + opcion 'financiar'", () => {
    const s = responder({ pagina: "ficha", slug: PARTNER.slug, opcion: "financiar" });
    sinGuion(s);
    expect(todoElTexto(s)).toContain("ya se vendió");
    expect(s.respuesta.sugerencias).toEqual(["buscar", "marcos"]);
  });

  it("reservado + opcion 'financiar'", () => {
    const s = responder({ pagina: "ficha", slug: XR150.slug, opcion: "financiar" });
    sinGuion(s);
    expect(todoElTexto(s)).toContain("reservad");
    expect(s.respuesta.sugerencias).toEqual(["buscar", "marcos"]);
  });

  it("chips viejos (usado, ver_financiacion, anticipo, cuotas) sobre un vendido tampoco siguen el guion", () => {
    const estado: EstadoWeb = {
      sesion: { ...sesionNueva(AHORA), vehiculoActualId: PARTNER.id },
      guion: { flujo: "financiar", paso: "cuotas", datos: { anticipo: "sin anticipo" } },
      ficha: PARTNER.slug,
    };
    for (const opcion of ["usado", "ver_financiacion", "anticipo_hasta_3", "cuotas_24"] as const) {
      const s = responder({ pagina: "ficha", slug: PARTNER.slug, opcion }, estado);
      sinGuion(s);
      expect(s.respuesta.sugerencias).toEqual(["buscar", "marcos"]);
    }
  });

  it("si cambia a la ficha de un vendido en medio del guion de financiar, el guion no sigue", () => {
    const estado: EstadoWeb = {
      sesion: { ...sesionNueva(AHORA), vehiculoActualId: P206.id },
      guion: { flujo: "financiar", paso: "anticipo", datos: {} },
      ficha: P206.slug,
    };
    const s = responder({ pagina: "ficha", slug: PARTNER.slug, texto: "tengo 2 palos" }, estado);
    sinGuion(s);
    expect(todoElTexto(s)).toContain("ya se vendió");
  });
});

describe("el estado de entrada no se modifica", () => {
  it("inicio, paso de captacion, texto no entendido y pregunta suelta en el anticipo", () => {
    const casos: [Entrada, EstadoWeb][] = [
      [
        { pagina: "ficha", slug: VENTO.slug, inicio: true },
        { sesion: { ...sesionNueva(AHORA), vehiculoActualId: P206.id, paso: "pidiendo_telefono", lead: { nombre: "Ana" } }, guion: { flujo: null, paso: null, datos: {} }, ficha: P206.slug },
      ],
      [
        { pagina: "catalogo", slug: null, texto: "Juan" },
        { sesion: { ...sesionNueva(AHORA), paso: "pidiendo_nombre", lead: { motivo: "avisame cuando entre un gol" } }, guion: { flujo: null, paso: null, datos: {} } },
      ],
      [
        { pagina: "catalogo", slug: null, texto: "asdkj qwe" },
        { sesion: { ...sesionNueva(AHORA), fallos: 1, mostradosIds: ["v-206"] }, guion: { flujo: null, paso: null, datos: {} }, ficha: null },
      ],
      [
        { pagina: "ficha", slug: P206.slug, texto: "cuánto sale" },
        { sesion: { ...sesionNueva(AHORA), vehiculoActualId: P206.id }, guion: { flujo: "financiar", paso: "anticipo", datos: { usado: "Bmw 2016" } }, ficha: P206.slug },
      ],
    ];
    for (const [entrada, estado] of casos) {
      const antes = JSON.stringify(estado);
      const s = responder(entrada, estado);
      expect(JSON.stringify(estado)).toBe(antes);
      expect(s.estado).not.toBe(estado);
    }
  });
});

describe("canal web: nada menciona Instagram en una charla entera", () => {
  it("captacion, financiacion, disponible y Marcos encadenando el estado", () => {
    const pasos: Entrada[] = [
      { pagina: "ficha", slug: P206.slug, inicio: true },
      { pagina: "ficha", slug: P206.slug, texto: "avisame cuando entre un gol" },
      { pagina: "ficha", slug: P206.slug, texto: "Juan" },
      { pagina: "ficha", slug: P206.slug, texto: "3537123456" },
      { pagina: "ficha", slug: P206.slug, texto: "quiero financiarlo, tengo un bmw 2016 para entregar" },
      { pagina: "ficha", slug: P206.slug, texto: "dónde están" },
      { pagina: "ficha", slug: P206.slug, opcion: "anticipo_solo_usado" },
      { pagina: "ficha", slug: P206.slug, texto: "sos un bot?" },
      { pagina: "ficha", slug: P206.slug, opcion: "cuotas_24" },
      { pagina: "ficha", slug: VENTO.slug, opcion: "disponible" },
      { pagina: "ficha", slug: VENTO.slug, opcion: "confirmar_si" },
      { pagina: "catalogo", slug: null, texto: "busco trabajo" },
      { pagina: "catalogo", slug: null, texto: "asdkj qwe" },
      { pagina: "catalogo", slug: null, texto: "asdkj qwe" },
      { pagina: "catalogo", slug: null, opcion: "marcos" },
    ];
    let estado: EstadoWeb | null = null;
    let leads = 0;
    let cierres = 0;
    pasos.forEach((p, i) => {
      const s = responder({ ...p, mid: `mid.${i}` }, estado);
      for (const pieza of visible(s)) expect(pieza).not.toMatch(/instagram/i);
      if (s.lead) leads += 1;
      if (cierreDe(s)) cierres += 1;
      estado = s.estado;
    });
    expect(leads).toBe(1);
    expect(cierres).toBe(3);
  });
});

describe("robustez", () => {
  it("misma entrada y mismo mid dan la misma salida", () => {
    const estado: EstadoWeb = { sesion: { ...sesionNueva(AHORA), vehiculoActualId: P206.id }, guion: { flujo: null, paso: null, datos: {} } };
    for (const e of [
      { pagina: "ficha", slug: P206.slug, texto: "hola, cuánto sale y toman usados?" },
      { pagina: "catalogo", slug: null, texto: "asdkj" },
      { pagina: "ficha", slug: VENTO.slug, opcion: "financiar" },
    ] as Entrada[]) {
      expect(responder({ ...e, mid: "m.x" }, estado)).toEqual(responder({ ...e, mid: "m.x" }, estado));
    }
  });

  it("no lanza con textos raros ni con un estado corrupto", () => {
    const raros = ["", "   ", "\u0000", "\uD800", "😀😀", "a".repeat(5000), "%E0%A4%A", "<script>", "12", "?", "\n\n\n"];
    const corrupto = { sesion: "xx", guion: { flujo: "hack", paso: 3, datos: { anticipo: 7 } } } as unknown as EstadoWeb;
    for (const texto of raros) {
      for (const estado of [null, corrupto]) {
        const s = responder({ pagina: "ficha", slug: P206.slug, texto }, estado);
        expect(s.respuesta.mensajes.length).toBeGreaterThan(0);
        expect(s.respuesta.mensajes.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("lo que escribe el visitante se guarda sin caracteres de control ni surrogates sueltos", () => {
    const estado: EstadoWeb = {
      sesion: { ...sesionNueva(AHORA), vehiculoActualId: P206.id },
      guion: { flujo: "financiar", paso: "anticipo", datos: {} },
    };
    const s = responder({ pagina: "ficha", slug: P206.slug, texto: "tengo\u0000 2\u0007 palos\uD800" }, estado);
    expect(s.estado.guion.datos.anticipo).toBe("tengo 2 palos");
    const crudo = JSON.stringify(s.estado);
    expect(crudo).not.toMatch(/\\u0000|\\u0007|\\ud800/i);
  });

  it("sanearTexto saca controles y surrogates sueltos pero deja emojis, tildes y saltos como espacio", () => {
    expect(sanearTexto("a\u0000b\u001Fc\u007F\u0085d")).toBe("abcd");
    expect(sanearTexto("x\uD800y\uDC00z")).toBe("xyz");
    expect(sanearTexto("árbol 😀\ncamión\tya")).toBe("árbol 😀 camión ya");
  });

  it("normalizarGuion descarta lo invalido", () => {
    expect(normalizarGuion("xx")).toEqual({ flujo: null, paso: null, datos: {} });
    expect(normalizarGuion({ flujo: "financiar", paso: "cuotas", datos: { anticipo: "sin\u0000 anticipo", cuotas: 3 } })).toEqual({
      flujo: "financiar",
      paso: "cuotas",
      datos: { anticipo: "sin anticipo" },
    });
    expect(normalizarGuion({ flujo: "hack", paso: "cuotas", datos: {} })).toEqual({ flujo: null, paso: null, datos: {} });
  });
});

describe("tarjetasAWeb", () => {
  it("toma el slug del boton 'Ver en la web' y el estado del catalogo", () => {
    const [t] = tarjetasAWeb(
      [
        {
          titulo: "Volkswagen Vento 2.5 Advance 2015",
          subtitulo: "x",
          imagenUrl: null,
          botones: [
            { titulo: "Ver en la web", url: `https://posse.test/vehiculos/${VENTO.slug}` },
            { titulo: "Hablar con Marcos", url: "https://wa.me/1?text=hola" },
          ],
        },
      ],
      CAT,
    );
    expect(t.slug).toBe(VENTO.slug);
    expect(t.estado).toBe("disponible");
  });

  it("sin boton de ficha (tarjeta de contacto) queda sin slug ni estado", () => {
    const [t] = tarjetasAWeb([{ titulo: "Posse Automotores", subtitulo: "x", imagenUrl: null, botones: [{ titulo: "Hablar con Marcos", url: "https://wa.me/1" }] }], CAT);
    expect(t.slug).toBeNull();
    expect(t.estado).toBeNull();
  });
});

describe("sugerenciasPara", () => {
  it("ficha con auto, catalogo sin auto y oferta de aviso", () => {
    expect(sugerenciasPara({ pagina: "ficha", tieneAuto: true, ofrecio: null })).toEqual(["financiar", "usado", "disponible", "marcos"]);
    expect(sugerenciasPara({ pagina: "catalogo", tieneAuto: false, ofrecio: null })).toEqual(["financiar", "buscar", "usado", "marcos"]);
    expect(sugerenciasPara({ pagina: "ficha", tieneAuto: false, ofrecio: null })).toEqual(["financiar", "buscar", "usado", "marcos"]);
    expect(sugerenciasPara({ pagina: "catalogo", tieneAuto: true, ofrecio: null })).toEqual(["financiar", "disponible", "buscar", "marcos"]);
    expect(sugerenciasPara({ pagina: "catalogo", tieneAuto: false, ofrecio: "aviso" })).toEqual(["confirmar_si", "buscar", "marcos"]);
  });
});
