import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGO } from "../__fixtures__/catalogo";
import { NEGOCIO } from "../negocio";
import type { LeadInput } from "../types";
import { buildWhatsAppUrlWeb } from "../../utils";
import { responderWeb, type EstadoWeb } from "./asistente";
import type { FilaMensajeWeb } from "./almacen";
import { procesarChat, RESPUESTA_FALLA, type DepsChat } from "./chat";
import { LIMITES } from "./limites";
import type { MensajeWeb, RespuestaChat } from "./tipos";

vi.mock("./asistente", async (original) => {
  const real = await original<typeof import("./asistente")>();
  return { ...real, responderWeb: vi.fn(real.responderWeb) };
});

const AHORA = new Date("2026-11-09T15:00:00Z");
const V = "visitante-12345678";
const P206 = CATALOGO.find((v) => v.id === "v-206")!;

type Fakes = {
  deps: DepsChat;
  estados: Map<string, EstadoWeb>;
  filas: FilaMensajeWeb[];
  leads: LeadInput[];
  mocks: {
    catalogo: ReturnType<typeof vi.fn>;
    cargarEstado: ReturnType<typeof vi.fn>;
    guardarEstado: ReturnType<typeof vi.fn>;
    guardarMensajes: ReturnType<typeof vi.fn>;
    contar: ReturnType<typeof vi.fn>;
    guardarLead: ReturnType<typeof vi.fn>;
  };
};

function crear(over: Partial<DepsChat> = {}): Fakes {
  const estados = new Map<string, EstadoWeb>();
  const filas: FilaMensajeWeb[] = [];
  const leads: LeadInput[] = [];
  const mocks = {
    catalogo: vi.fn(async () => CATALOGO),
    cargarEstado: vi.fn(async (v: string) => estados.get(v) ?? null),
    guardarEstado: vi.fn(async (v: string, e: EstadoWeb) => {
      estados.set(v, e);
    }),
    guardarMensajes: vi.fn(async (_v: string, f: FilaMensajeWeb[]) => {
      filas.push(...f);
    }),
    contar: vi.fn(async () => 0),
    guardarLead: vi.fn(async (_v: string, l: LeadInput) => {
      leads.push(l);
    }),
  };
  let n = 0;
  const deps: DepsChat = {
    ...mocks,
    ahora: () => AHORA,
    mid: () => `mid.${++n}`,
    siteUrl: "https://posse.test",
    negocio: NEGOCIO,
    ...over,
  };
  return { deps, estados, filas, leads, mocks };
}

const URL_MARCOS = buildWhatsAppUrlWeb(null);
const cierres = (r: RespuestaChat) => r.mensajes.filter((m): m is Extract<MensajeWeb, { tipo: "cierre" }> => m.tipo === "cierre");
const conBotonMarcos = (r: RespuestaChat) =>
  r.mensajes.some((m) =>
    m.tipo === "cierre" ? m.url.startsWith("https://wa.me/") : m.tipo === "tarjetas" && m.tarjetas.some((t) => t.botones.some((b) => b.url.startsWith("https://wa.me/"))),
  );
const textoDe = (r: RespuestaChat) => r.mensajes.flatMap((m) => (m.tipo === "texto" ? [m.texto] : [])).join(" ");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("RESPUESTA_FALLA", () => {
  it("es un texto fijo mas un cierre con el link generico a Marcos", () => {
    const r = RESPUESTA_FALLA(NEGOCIO);
    expect(textoDe(r)).toContain("Marcos");
    expect(cierres(r)).toHaveLength(1);
    expect(cierres(r)[0].url).toBe(URL_MARCOS);
    expect(cierres(r)[0].vehiculoSlug).toBeNull();
    expect(r.sugerencias).toEqual([]);
  });
});

describe("camino feliz", () => {
  it("opcion: guarda la fila del cliente (con la etiqueta), las del asistente con su tipo y el estado", async () => {
    const f = crear();
    const r = await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, opcion: "financiar" }, f.deps);

    expect(r.mensajes.length).toBeGreaterThan(0);
    expect(f.filas[0]).toEqual({
      role: "user",
      content: "Quiero financiarlo",
      tipo: "texto",
      via: "opcion",
      vehiculo_slug: P206.slug,
      nota: null,
    });
    const asistente = f.filas.slice(1);
    expect(asistente).toHaveLength(r.mensajes.length);
    asistente.forEach((fila, i) => {
      expect(fila.role).toBe("assistant");
      expect(fila.tipo).toBe(r.mensajes[i].tipo);
      expect(fila.via).toBeNull();
      expect(fila.content.trim()).not.toBe("");
    });
    expect(f.mocks.guardarEstado).toHaveBeenCalledTimes(1);
    expect(f.mocks.guardarEstado.mock.calls[0][0]).toBe(V);
    expect(f.estados.get(V)?.ficha).toBe(P206.slug);
    expect(f.estados.get(V)?.guion.flujo).toBe("financiar");
  });

  it("guarda mensajes en una sola llamada y le pasa el visitante", async () => {
    const f = crear();
    await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, opcion: "financiar" }, f.deps);
    expect(f.mocks.guardarMensajes).toHaveBeenCalledTimes(1);
    expect(f.mocks.guardarMensajes.mock.calls[0][0]).toBe(V);
  });

  it("texto libre no entendido: fila del cliente via texto con nota no_entendido", async () => {
    const f = crear();
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "asdkj qwe" }, f.deps);
    expect(f.filas[0]).toEqual({
      role: "user",
      content: "asdkj qwe",
      tipo: "texto",
      via: "texto",
      vehiculo_slug: null,
      nota: "no_entendido",
    });
  });

  it("desde el catálogo, el auto del que se habló queda en la fila del cliente", async () => {
    const bmw = { ...CATALOGO[0], id: "v-bmw", slug: "bmw-320i-2018", nombre: "BMW 320i", marca: "BMW", modelo: "320i", anio: 2018 };
    const f = crear({ catalogo: async () => [...CATALOGO, bmw] });
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "bmw" }, f.deps);
    expect(f.filas[0].vehiculo_slug).toBe("bmw-320i-2018");
  });

  it("desde el catálogo y sin hablar de ningún auto, la fila del cliente no lleva auto", async () => {
    const f = crear();
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(f.filas[0].vehiculo_slug).toBeNull();
  });

  it("texto libre entendido: sin nota", async () => {
    const f = crear();
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(f.filas[0].role).toBe("user");
    expect(f.filas[0].nota).toBeNull();
  });

  it("inicio es solo lectura: contesta pero no guarda mensajes, estado ni lead, ni repitiendo el pedido", async () => {
    const f = crear();
    const r = await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, inicio: true }, f.deps);
    expect(r.mensajes.length).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, inicio: true }, f.deps);
    expect(f.mocks.guardarMensajes).not.toHaveBeenCalled();
    expect(f.mocks.guardarEstado).not.toHaveBeenCalled();
    expect(f.mocks.guardarLead).not.toHaveBeenCalled();
    expect(f.filas).toEqual([]);
    expect(f.estados.size).toBe(0);
  });

  it("inicio igual pasa por los topes (con el visitante en el tope, deriva a Marcos)", async () => {
    const f = crear();
    f.mocks.contar.mockImplementation(async (_d: Date, v?: string) => (v ? LIMITES.porVisitante : 0));
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, inicio: true }, f.deps);
    expect(cierres(r)[0].url).toBe(URL_MARCOS);
    expect(f.mocks.catalogo).not.toHaveBeenCalled();
  });

  it("las tarjetas se guardan como 'Mostró: <titulos>' y los titulos", async () => {
    const f = crear();
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "amarok" }, f.deps);
    const tarjetas = r.mensajes.find((m): m is Extract<MensajeWeb, { tipo: "tarjetas" }> => m.tipo === "tarjetas")!;
    const filaTarjetas = f.filas.find((x) => x.tipo === "tarjetas")!;
    expect(filaTarjetas.content).toBe(`Mostró: ${tarjetas.tarjetas.map((t) => t.titulo).join(", ")}`);
  });

  it("el cierre se guarda con su texto tal cual (puede llevar saltos de linea) y el slug del auto", async () => {
    const f = crear();
    const r = await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, opcion: "marcos" }, f.deps);
    const cierre = cierres(r)[0];
    expect(cierre).toBeDefined();
    const fila = f.filas.find((x) => x.tipo === "cierre")!;
    expect(fila.role).toBe("assistant");
    expect(fila.content).toBe(cierre.texto);
    expect(fila.vehiculo_slug).toBe(cierre.vehiculoSlug);
  });

  it("dos llamadas seguidas usan el estado guardado por la primera (anticipo -> cuotas)", async () => {
    const f = crear();
    await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, opcion: "financiar" }, f.deps);
    expect(f.estados.get(V)?.guion.paso).toBe("anticipo");
    await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, opcion: "anticipo_sin" }, f.deps);
    expect(f.mocks.cargarEstado).toHaveBeenCalledTimes(2);
    expect(f.estados.get(V)?.guion.paso).toBe("cuotas");
  });

  it("usa un mid distinto por llamada", async () => {
    const f = crear();
    const mid = vi.fn(() => "mid.fijo");
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, { ...f.deps, mid });
    expect(mid).toHaveBeenCalled();
  });
});

describe("limites", () => {
  const catalogoLlamado = (f: Fakes) => f.mocks.catalogo.mock.calls.length;

  function comprobarBloqueo(f: Fakes, r: RespuestaChat) {
    expect(textoDe(r).trim()).not.toBe("");
    expect(cierres(r)).toHaveLength(1);
    expect(cierres(r)[0].url).toBe(URL_MARCOS);
    expect(catalogoLlamado(f)).toBe(0);
    expect(f.mocks.cargarEstado).not.toHaveBeenCalled();
    expect(f.mocks.guardarMensajes).not.toHaveBeenCalled();
    expect(f.mocks.guardarEstado).not.toHaveBeenCalled();
    expect(f.mocks.guardarLead).not.toHaveBeenCalled();
  }

  it("visitante en el tope: no corre el asistente, deriva a Marcos y no guarda nada", async () => {
    const f = crear();
    f.mocks.contar.mockImplementation(async (_d: Date, v?: string) => (v ? LIMITES.porVisitante : 0));
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    comprobarBloqueo(f, r);
  });

  it("tope global: igual", async () => {
    const f = crear();
    f.mocks.contar.mockImplementation(async (_d: Date, v?: string) => (v ? 1 : LIMITES.global));
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    comprobarBloqueo(f, r);
  });

  it("con 29 mensajes del visitante todavia entra", async () => {
    const f = crear();
    f.mocks.contar.mockImplementation(async (_d: Date, v?: string) => (v ? LIMITES.porVisitante - 1 : 0));
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(f.mocks.guardarMensajes).toHaveBeenCalledTimes(1);
  });

  it("cuenta dentro de la ventana de 10 minutos", async () => {
    const f = crear();
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    const desde = f.mocks.contar.mock.calls[0][0] as Date;
    expect(AHORA.getTime() - desde.getTime()).toBe(LIMITES.ventanaMinutos * 60_000);
    expect(f.mocks.contar.mock.calls.some((c) => c[1] === V)).toBe(true);
    expect(f.mocks.contar.mock.calls.some((c) => c[1] === undefined)).toBe(true);
  });

  it("si contar falla, no corta el servicio: contesta normal (falla abierto) y lo registra", async () => {
    const f = crear();
    f.mocks.contar.mockRejectedValue(new Error("tabla web_mensajes no existe"));
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r.mensajes.length).toBeGreaterThan(0);
    expect(f.mocks.catalogo).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("fallas", () => {
  it.each([
    ["devuelve null", async () => null],
    [
      "lanza",
      async () => {
        throw new Error("supabase caido");
      },
    ],
  ])("si el catalogo %s: RESPUESTA_FALLA, sin lanzar ni guardar", async (_n, catalogo) => {
    const f = crear({ catalogo: catalogo as DepsChat["catalogo"] });
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r).toEqual(RESPUESTA_FALLA(NEGOCIO));
    expect(f.mocks.guardarMensajes).not.toHaveBeenCalled();
    expect(f.mocks.guardarEstado).not.toHaveBeenCalled();
  });

  it("si guardarEstado lanza, la respuesta igual se devuelve y se registra el error", async () => {
    const f = crear();
    f.mocks.guardarEstado.mockRejectedValue(new Error("columna ficha no existe"));
    const r = await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, opcion: "financiar" }, f.deps);
    expect(r.mensajes.length).toBeGreaterThan(0);
    expect(r).not.toEqual(RESPUESTA_FALLA(NEGOCIO));
    expect(console.error).toHaveBeenCalled();
    expect(f.mocks.guardarMensajes).toHaveBeenCalledTimes(1);
  });

  it("si guardarMensajes lanza, la respuesta igual se devuelve y el estado se guarda igual", async () => {
    const f = crear();
    f.mocks.guardarMensajes.mockRejectedValue(new Error("tabla web_mensajes no existe"));
    const r = await procesarChat({ visitante: V, pagina: "ficha", slug: P206.slug, opcion: "financiar" }, f.deps);
    expect(r.mensajes.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
    expect(f.mocks.guardarEstado).toHaveBeenCalledTimes(1);
  });

  it("si cargarEstado lanza, contesta como charla nueva pero NO pisa el estado guardado (sí guarda los mensajes)", async () => {
    const f = crear();
    f.mocks.cargarEstado.mockRejectedValue(new Error("boom"));
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r.mensajes.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
    expect(f.mocks.guardarEstado).not.toHaveBeenCalled();
    expect(f.mocks.guardarMensajes).toHaveBeenCalledTimes(1);
  });

  it("si cargarEstado devuelve null (no hay fila) el estado se guarda", async () => {
    const f = crear();
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(f.mocks.guardarEstado).toHaveBeenCalledTimes(1);
  });

  it("si lo inesperado revienta (mid lanza), devuelve RESPUESTA_FALLA y no lanza", async () => {
    const f = crear({
      mid: () => {
        throw new Error("sin crypto");
      },
    });
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r).toEqual(RESPUESTA_FALLA(NEGOCIO));
  });

  it("no filtra el texto del error al visitante", async () => {
    const f = crear({
      catalogo: async () => {
        throw new Error("SECRETO-interno");
      },
    });
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(JSON.stringify(r)).not.toContain("SECRETO");
  });
});

describe("lead", () => {
  async function hastaElLead(f: Fakes): Promise<RespuestaChat> {
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "avisame cuando entre un gol" }, f.deps);
    await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "Juan" }, f.deps);
    return procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "3537123456" }, f.deps);
  }

  it("un lead no nulo se guarda con guardarLead", async () => {
    const f = crear();
    await hastaElLead(f);
    expect(f.mocks.guardarLead).toHaveBeenCalledTimes(1);
    expect(f.mocks.guardarLead.mock.calls[0][0]).toBe(V);
    expect(f.leads[0].nombre).toBe("Juan");
  });

  it("si guardarLead falla, la respuesta incluye igual el boton de Marcos", async () => {
    const f = crear();
    f.mocks.guardarLead.mockRejectedValue(new Error("tabla leads caida"));
    const r = await hastaElLead(f);
    expect(conBotonMarcos(r)).toBe(true);
    expect(r.mensajes.length).toBeLessThanOrEqual(3);
    expect(console.error).toHaveBeenCalled();
  });

  it("si guardarLead falla y la respuesta no traia ningun boton de WhatsApp, se agrega el cierre generico (sin pasar de 3 mensajes)", async () => {
    const f = crear();
    f.mocks.guardarLead.mockRejectedValue(new Error("tabla leads caida"));
    const mensajes: MensajeWeb[] = [
      { tipo: "texto", texto: "uno" },
      { tipo: "texto", texto: "dos" },
      { tipo: "texto", texto: "tres" },
    ];
    vi.mocked(responderWeb).mockReturnValueOnce({
      respuesta: { mensajes, sugerencias: [] },
      estado: { sesion: {} as EstadoWeb["sesion"], guion: { flujo: null, paso: null, datos: {} }, ficha: null },
      lead: { nombre: "Juan", telefono: "3537123456" },
      noEntendido: false,
    });
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r.mensajes).toHaveLength(3);
    expect(cierres(r)[0].url).toBe(URL_MARCOS);
    expect(f.filas.filter((x) => x.role === "assistant").map((x) => x.tipo)).toEqual(["texto", "texto", "cierre"]);
  });
});

describe("presupuesto de tiempo", () => {
  const nunca = () => new Promise<never>(() => {});

  afterEach(() => {
    vi.useRealTimers();
  });

  it("si el catalogo no responde nunca, a los presupuestoMs devuelve RESPUESTA_FALLA sin guardar nada", async () => {
    const f = crear({ catalogo: nunca, presupuestoMs: 20 });
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r).toEqual(RESPUESTA_FALLA(NEGOCIO));
    expect(f.mocks.guardarMensajes).not.toHaveBeenCalled();
    expect(f.mocks.guardarEstado).not.toHaveBeenCalled();
  });

  it("si contar no responde nunca, tambien devuelve RESPUESTA_FALLA", async () => {
    const f = crear({ presupuestoMs: 20 });
    f.mocks.contar.mockImplementation(nunca);
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r).toEqual(RESPUESTA_FALLA(NEGOCIO));
    expect(f.mocks.catalogo).not.toHaveBeenCalled();
  });

  it("si el catalogo llega tarde (pasado el presupuesto) no se guarda nada despues", async () => {
    let soltar!: (v: typeof CATALOGO) => void;
    const tarde = new Promise<typeof CATALOGO>((res) => (soltar = res));
    const f = crear({ catalogo: () => tarde, presupuestoMs: 20 });
    const r = await procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    expect(r).toEqual(RESPUESTA_FALLA(NEGOCIO));
    soltar(CATALOGO);
    await new Promise((res) => setTimeout(res, 20));
    expect(f.mocks.guardarMensajes).not.toHaveBeenCalled();
    expect(f.mocks.guardarEstado).not.toHaveBeenCalled();
  });

  it("el presupuesto por defecto es 8000 ms y no queda ningun timer pendiente al terminar", async () => {
    vi.useFakeTimers();
    const f = crear();
    const pendiente = procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps);
    await vi.advanceTimersByTimeAsync(0);
    const r = await pendiente;
    expect(r.mensajes.length).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("al agotarse el tiempo tampoco queda un timer pendiente, y a los 7999 ms todavia espera", async () => {
    vi.useFakeTimers();
    const f = crear({ catalogo: nunca });
    let listo = false;
    const pendiente = procesarChat({ visitante: V, pagina: "catalogo", slug: null, texto: "hola" }, f.deps).then((r) => {
      listo = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(7999);
    expect(listo).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pendiente).toEqual(RESPUESTA_FALLA(NEGOCIO));
    expect(vi.getTimerCount()).toBe(0);
  });
});
