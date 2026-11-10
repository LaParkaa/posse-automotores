import { describe, expect, it } from "vitest";
import {
  armarConversacionesWeb,
  resumirBotWeb,
  type EventoChat,
  type MensajeWebFila,
} from "./estadisticas";

// Mediodía argentino del 10 de noviembre de 2026 (15:00 UTC).
const AHORA = "2026-11-10T15:00:00.000Z";

const msg = (visitante: string, extra: Partial<MensajeWebFila> = {}): MensajeWebFila => ({
  visitante,
  role: "user",
  content: "hola",
  tipo: "texto",
  vehiculo_slug: null,
  nota: null,
  created_at: "2026-11-10T14:00:00.000Z",
  ...extra,
});

const ev = (tipo: EventoChat["tipo"], visitante: string | null, extra: Partial<EventoChat> = {}): EventoChat => ({
  tipo,
  ruta: "/vehiculos/x",
  vehiculo_slug: null,
  visitante,
  creado: "2026-11-10T14:00:00.000Z",
  ...extra,
});

const resumir = (mensajes: MensajeWebFila[], eventos: EventoChat[], dias = 7, leadsWeb = 0) =>
  resumirBotWeb({ mensajes, eventos, leadsWeb, dias, ahora: AHORA });

describe("resumirBotWeb: embudo", () => {
  it("cuenta personas distintas en cada paso, no eventos", () => {
    const eventos = [
      ev("visita", "a"),
      ev("visita", "a", { ruta: "/vehiculos/y" }),
      ev("visita", "b", { ruta: "/catalogo" }),
      ev("visita", "c"),
      ev("chat_abrio", "a"),
      ev("chat_abrio", "a"),
      ev("chat_abrio", "b"),
      ev("chat_whatsapp", "a"),
      ev("chat_whatsapp", "a"),
    ];
    const mensajes = [msg("a"), msg("a", { content: "otra" }), msg("a", { role: "assistant", tipo: "cierre" })];

    expect(resumir(mensajes, eventos).embudo).toEqual({
      vieronPagina: 3,
      abrieron: 2,
      interactuaron: 1,
      armaronMensaje: 1,
      tocaronWhatsapp: 1,
    });
  });

  it("una visita a / o a /financiacion no cuenta como ver un auto", () => {
    const eventos = [
      ev("visita", "a", { ruta: "/" }),
      ev("visita", "b", { ruta: "/financiacion" }),
      ev("visita", "c", { ruta: "/catalogo?marca=ford" }),
    ];
    expect(resumir([], eventos).embudo.vieronPagina).toBe(1);
  });

  it("ignora los eventos sin visitante en los conteos de personas", () => {
    const eventos = [ev("visita", null), ev("chat_abrio", null), ev("chat_whatsapp", null)];
    expect(resumir([], eventos).embudo).toEqual({
      vieronPagina: 0,
      abrieron: 0,
      interactuaron: 0,
      armaronMensaje: 0,
      tocaronWhatsapp: 0,
    });
  });
});

describe("resumirBotWeb: conversaciones", () => {
  it("una conversación es un visitante con algún mensaje suyo", () => {
    const mensajes = [msg("a"), msg("b"), msg("c", { role: "assistant" })];
    const r = resumir(mensajes, []);
    expect(r.conversaciones).toBe(2);
  });

  it("mensajesPorConversacion es el promedio de mensajes del cliente", () => {
    const mensajes = [msg("a"), msg("a"), msg("a"), msg("b"), msg("b", { role: "assistant" })];
    expect(resumir(mensajes, []).mensajesPorConversacion).toBe(2);
  });

  it("sin conversaciones el promedio es null", () => {
    expect(resumir([], []).mensajesPorConversacion).toBeNull();
  });

  it("dejaronDatos son los leads web que llegan de afuera", () => {
    expect(resumir([], [], 7, 4).dejaronDatos).toBe(4);
  });
});

describe("resumirBotWeb: autos más consultados", () => {
  it("cuenta conversaciones distintas por auto, de mayor a menor", () => {
    const mensajes = [
      msg("a", { vehiculo_slug: "gol" }),
      msg("a", { vehiculo_slug: "gol", content: "otra" }),
      msg("b", { vehiculo_slug: "gol" }),
      msg("b", { vehiculo_slug: "corsa" }),
      msg("c", { vehiculo_slug: "corsa" }),
      msg("c", { vehiculo_slug: "corsa", role: "assistant" }),
      msg("d", { vehiculo_slug: "polo" }),
    ];
    expect(resumir(mensajes, []).autosMasConsultados).toEqual([
      { slug: "corsa", conversaciones: 2 },
      { slug: "gol", conversaciones: 2 },
      { slug: "polo", conversaciones: 1 },
    ]);
  });
});

describe("resumirBotWeb: no entendidos", () => {
  it("agrupa textos iguales sin mayúsculas ni espacios de más y ordena por veces", () => {
    const mensajes = [
      msg("a", { content: "Tienen  motos?", nota: "no_entendido" }),
      msg("b", { content: " tienen motos? ", nota: "no_entendido" }),
      msg("c", { content: "algo raro", nota: "no_entendido" }),
      msg("d", { content: "algo que sí entendió" }),
      msg("e", { role: "assistant", content: "no entendí", nota: "no_entendido" }),
    ];
    expect(resumir(mensajes, []).noEntendidos).toEqual([
      { texto: "tienen motos?", veces: 2 },
      { texto: "algo raro", veces: 1 },
    ]);
  });

  it("devuelve como mucho los 10 más repetidos", () => {
    const mensajes = Array.from({ length: 15 }, (_, i) => msg("a", { content: `pregunta ${i}`, nota: "no_entendido" }));
    expect(resumir(mensajes, []).noEntendidos).toHaveLength(10);
  });
});

describe("resumirBotWeb: comparación", () => {
  it("toma simulaciones, mensajes armados y toques de WhatsApp del chat", () => {
    const eventos = [
      ev("simulacion", "a"),
      ev("simulacion", "b"),
      ev("simular", "c"),
      ev("chat_whatsapp", "a"),
      ev("chat_whatsapp", "b"),
      ev("chat_whatsapp", "b"),
    ];
    const mensajes = [msg("a", { role: "assistant", tipo: "cierre" }), msg("b", { role: "assistant", tipo: "cierre" })];
    expect(resumir(mensajes, eventos).comparacion).toEqual({
      simulaciones: 2,
      mensajesArmados: 2,
      toquesWhatsappChat: 3,
    });
  });
});

describe("resumirBotWeb: período", () => {
  it("corta por día argentino: lo anterior al primer día no cuenta", () => {
    // Con 2 días la ventana es el 9 y el 10 de noviembre (hora argentina).
    const dentro = msg("a", { created_at: "2026-11-09T03:00:00.000Z" }); // 9/11 00:00 AR
    const fuera = msg("b", { created_at: "2026-11-09T02:59:00.000Z" }); // 8/11 23:59 AR
    const r = resumir([dentro, fuera], [ev("chat_abrio", "z", { creado: "2026-11-09T02:59:00.000Z" })], 2);
    expect(r.conversaciones).toBe(1);
    expect(r.embudo.abrieron).toBe(0);
  });

  it("el día argentino manda: a las 01:00 UTC todavía es el día anterior", () => {
    const r = resumir([msg("a", { created_at: "2026-11-10T01:00:00.000Z" })], [], 2);
    expect(r.porDia).toEqual([
      { dia: "2026-11-09", etiqueta: "9 nov", personas: 1 },
      { dia: "2026-11-10", etiqueta: "10 nov", personas: 0 },
    ]);
  });

  it("sin datos devuelve ceros, null y listas vacías, con un elemento por día", () => {
    const r = resumir([], [], 3);
    expect(r).toEqual({
      embudo: { vieronPagina: 0, abrieron: 0, interactuaron: 0, armaronMensaje: 0, tocaronWhatsapp: 0 },
      conversaciones: 0,
      mensajesPorConversacion: null,
      dejaronDatos: 0,
      autosMasConsultados: [],
      noEntendidos: [],
      comparacion: { simulaciones: 0, mensajesArmados: 0, toquesWhatsappChat: 0 },
      porDia: [
        { dia: "2026-11-08", etiqueta: "8 nov", personas: 0 },
        { dia: "2026-11-09", etiqueta: "9 nov", personas: 0 },
        { dia: "2026-11-10", etiqueta: "10 nov", personas: 0 },
      ],
    });
  });

  it("porDia cuenta personas distintas que escribieron cada día", () => {
    const mensajes = [
      msg("a", { created_at: "2026-11-10T14:00:00.000Z" }),
      msg("a", { created_at: "2026-11-10T15:00:00.000Z" }),
      msg("b", { created_at: "2026-11-10T16:00:00.000Z" }),
      msg("a", { created_at: "2026-11-09T16:00:00.000Z" }),
    ];
    const r = resumir(mensajes, [], 2);
    expect(r.porDia.map((d) => d.personas)).toEqual([1, 2]);
  });
});

describe("armarConversacionesWeb", () => {
  it("arma una por visitante, 'Visitante', con datos según el set, la más reciente primero", () => {
    const mensajes = [
      msg("a", { created_at: "2026-11-10T10:00:00.000Z", content: "primero" }),
      msg("a", { created_at: "2026-11-10T10:05:00.000Z", role: "assistant", tipo: "cierre", content: "listo" }),
      msg("b", { created_at: "2026-11-10T12:00:00.000Z", content: "no sé", nota: "no_entendido" }),
    ];
    const r = armarConversacionesWeb(mensajes, new Set(["a"]));

    expect(r.map((c) => c.id)).toEqual(["b", "a"]);
    expect(r.every((c) => c.nombre === "Visitante")).toBe(true);

    const a = r[1];
    expect(a).toMatchObject({
      mensajes: 2,
      primerMensaje: "2026-11-10T10:00:00.000Z",
      ultimoMensaje: "2026-11-10T10:05:00.000Z",
      ultimoTexto: "listo",
      ultimoEsDelCliente: false,
      noEntendidos: 0,
      postulo: true,
      dejoDatos: true,
    });
    expect(r[0]).toMatchObject({ noEntendidos: 1, dejoDatos: false, postulo: false, ultimoEsDelCliente: true });
  });

  it("autoConsultado es el último auto con slug de cada visitante, y nada si no hubo ninguno", () => {
    const mensajes = [
      msg("a", { created_at: "2026-11-10T10:00:00.000Z", vehiculo_slug: "bmw-320i-2018" }),
      msg("a", { created_at: "2026-11-10T10:01:00.000Z", role: "assistant" }),
      msg("a", { created_at: "2026-11-10T10:02:00.000Z", vehiculo_slug: "peugeot-206-1-6-2011" }),
      msg("a", { created_at: "2026-11-10T10:03:00.000Z", role: "assistant" }),
      msg("b", { created_at: "2026-11-10T11:00:00.000Z" }),
    ];
    const r = armarConversacionesWeb(mensajes, new Set());
    expect(r.find((c) => c.id === "a")?.autoConsultado).toBe("peugeot-206-1-6-2011");
    expect(r.find((c) => c.id === "b")?.autoConsultado).toBeNull();
  });

  it("sin mensajes devuelve una lista vacía", () => {
    expect(armarConversacionesWeb([], new Set())).toEqual([]);
  });
});
