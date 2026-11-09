import { describe, expect, it } from "vitest";
import {
  cargarChatDeSesion,
  estadoInicial,
  globoYaMostrado,
  guardarChatEnSesion,
  leerChatGuardado,
  marcarGloboMostrado,
  reducirChat,
  serializarChat,
  type EstadoChat,
} from "./estado";

const WA = "https://wa.me/5491100000000?text=Hola";

const storageFalso = () => {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    datos,
  };
};

const storageRoto = {
  getItem: (): string | null => {
    throw new Error("bloqueado");
  },
  setItem: (): void => {
    throw new Error("bloqueado");
  },
};

describe("reducirChat", () => {
  it("el estado inicial arranca cerrado, vacío y sin saludar", () => {
    expect(estadoInicial).toEqual({ abierto: false, burbujas: [], sugerencias: [], pendiente: false, saludado: false });
  });

  it("abrir y cerrar solo cambian abierto", () => {
    const abierto = reducirChat(estadoInicial, { tipo: "abrir" });
    expect(abierto).toEqual({ ...estadoInicial, abierto: true });
    expect(reducirChat(abierto, { tipo: "cerrar" })).toEqual(estadoInicial);
  });

  it("enviar agrega la burbuja del cliente y pone pendiente", () => {
    const e = reducirChat(estadoInicial, { tipo: "enviar", texto: "hola" });
    expect(e.pendiente).toBe(true);
    expect(e.burbujas).toHaveLength(1);
    expect(e.burbujas[0]).toMatchObject({ de: "cliente", mensaje: { tipo: "texto", texto: "hola" } });
  });

  it("un segundo enviar con pendiente se ignora", () => {
    const e1 = reducirChat(estadoInicial, { tipo: "enviar", texto: "hola" });
    const e2 = reducirChat(e1, { tipo: "enviar", texto: "otra vez" });
    expect(e2).toEqual(e1);
  });

  it("recibir agrega burbujas del asistente, reemplaza sugerencias y apaga pendiente", () => {
    const base: EstadoChat = { ...estadoInicial, sugerencias: ["marcos"] };
    const e1 = reducirChat(base, { tipo: "enviar", texto: "hola" });
    const e2 = reducirChat(e1, {
      tipo: "recibir",
      respuesta: {
        mensajes: [
          { tipo: "texto", texto: "Hola!" },
          { tipo: "texto", texto: "¿En qué te ayudo?" },
        ],
        sugerencias: ["financiar", "disponible"],
      },
    });
    expect(e2.pendiente).toBe(false);
    expect(e2.sugerencias).toEqual(["financiar", "disponible"]);
    expect(e2.burbujas).toHaveLength(3);
    expect(e2.burbujas.slice(1).every((b) => b.de === "asistente")).toBe(true);
    expect(new Set(e2.burbujas.map((b) => b.id)).size).toBe(3);
  });

  it("fallo agrega el aviso con el link a Marcos y apaga pendiente", () => {
    const e1 = reducirChat(estadoInicial, { tipo: "enviar", texto: "hola" });
    const e2 = reducirChat(e1, { tipo: "fallo", negocio: { whatsappUrl: WA } });
    expect(e2.pendiente).toBe(false);
    const nuevas = e2.burbujas.slice(1);
    expect(nuevas.every((b) => b.de === "asistente")).toBe(true);
    expect(nuevas.some((b) => b.mensaje.tipo === "texto")).toBe(true);
    const cierre = nuevas.find((b) => b.mensaje.tipo === "cierre");
    expect(cierre?.mensaje).toMatchObject({ tipo: "cierre", url: WA, vehiculoSlug: null });
  });
});

describe("leerChatGuardado / serializarChat", () => {
  const conversacion = (): EstadoChat => {
    let e = reducirChat(estadoInicial, { tipo: "abrir" });
    e = reducirChat(e, { tipo: "enviar", texto: "hola" });
    e = reducirChat(e, {
      tipo: "recibir",
      respuesta: {
        mensajes: [
          { tipo: "texto", texto: "Hola" },
          {
            tipo: "tarjetas",
            tarjetas: [
              {
                slug: "vento-2014",
                titulo: "Vento 2.5",
                subtitulo: "2014",
                imagenUrl: null,
                estado: "disponible",
                botones: [{ titulo: "Ver", url: "/vehiculo/vento-2014" }],
              },
            ],
          },
          { tipo: "cierre", texto: "Listo", url: WA, vehiculoSlug: "vento-2014" },
        ],
        sugerencias: ["marcos"],
      },
    });
    return { ...e, saludado: true };
  };

  it("basura y null devuelven null", () => {
    expect(leerChatGuardado("basura")).toBeNull();
    expect(leerChatGuardado(null)).toBeNull();
    expect(leerChatGuardado("")).toBeNull();
    expect(leerChatGuardado("null")).toBeNull();
    expect(leerChatGuardado("[]")).toBeNull();
  });

  it("ida y vuelta conserva todo salvo abierto y pendiente", () => {
    const e = conversacion();
    expect(e.abierto).toBe(true);
    expect(leerChatGuardado(serializarChat(e))).toEqual({ ...e, abierto: false, pendiente: false });
  });

  it("siempre restaura con pendiente false", () => {
    const e = { ...conversacion(), pendiente: true };
    expect(leerChatGuardado(serializarChat(e))?.pendiente).toBe(false);
  });

  it("rechaza formas inválidas", () => {
    const ok = JSON.parse(serializarChat(conversacion()));
    const casos: unknown[] = [
      { ...ok, burbujas: "x" },
      { ...ok, sugerencias: "x" },
      { ...ok, sugerencias: ["inventada"] },
      { ...ok, saludado: "si" },
      { ...ok, burbujas: [{ id: 1, de: "cliente", mensaje: { tipo: "texto", texto: "a" } }] },
      { ...ok, burbujas: [{ id: "a", de: "otro", mensaje: { tipo: "texto", texto: "a" } }] },
      { ...ok, burbujas: [{ id: "a", de: "cliente", mensaje: { tipo: "html", texto: "a" } }] },
      { ...ok, burbujas: [{ id: "a", de: "cliente", mensaje: { tipo: "texto", texto: 5 } }] },
      { ...ok, burbujas: [{ id: "a", de: "asistente", mensaje: { tipo: "cierre", texto: "a", url: 5, vehiculoSlug: null } }] },
      { ...ok, burbujas: [{ id: "a", de: "asistente", mensaje: { tipo: "tarjetas", tarjetas: [{ titulo: 1 }] } }] },
      { ...ok, burbujas: [{ id: "a", de: "asistente", mensaje: { tipo: "tarjetas", tarjetas: "x" } }] },
    ];
    for (const caso of casos) expect(leerChatGuardado(JSON.stringify(caso))).toBeNull();
  });

  it("rechaza una conversación de más de 100 burbujas", () => {
    const e = conversacion();
    const burbujas = Array.from({ length: 101 }, (_, i) => ({
      id: `b${i}`,
      de: "cliente" as const,
      mensaje: { tipo: "texto" as const, texto: "x" },
    }));
    expect(leerChatGuardado(JSON.stringify({ ...e, burbujas }))).toBeNull();
  });

  it("rechaza un valor guardado demasiado grande", () => {
    const e = conversacion();
    const burbujas = [{ id: "b0", de: "cliente", mensaje: { tipo: "texto", texto: "x".repeat(200_000) } }];
    expect(leerChatGuardado(JSON.stringify({ ...e, burbujas }))).toBeNull();
  });

  it("serializar se queda con las últimas 100 burbujas", () => {
    let e = estadoInicial;
    for (let i = 0; i < 120; i++) {
      e = reducirChat({ ...e, pendiente: false }, { tipo: "enviar", texto: `m${i}` });
    }
    expect(e.burbujas).toHaveLength(120);
    const vuelta = leerChatGuardado(serializarChat(e));
    expect(vuelta).not.toBeNull();
    expect(vuelta!.burbujas).toHaveLength(100);
    expect(vuelta!.burbujas[99]).toEqual(e.burbujas[119]);
    expect(vuelta!.burbujas[0]).toEqual(e.burbujas[20]);
  });

  it("los ids nuevos no chocan con los restaurados", () => {
    let e = estadoInicial;
    for (let i = 0; i < 120; i++) {
      e = reducirChat({ ...e, pendiente: false }, { tipo: "enviar", texto: `m${i}` });
    }
    const vuelta = leerChatGuardado(serializarChat(e))!;
    const siguiente = reducirChat(vuelta, { tipo: "enviar", texto: "nuevo" });
    expect(new Set(siguiente.burbujas.map((b) => b.id)).size).toBe(siguiente.burbujas.length);
  });
});

describe("sessionStorage", () => {
  it("guarda y carga la conversación", () => {
    const s = storageFalso();
    const e = reducirChat(reducirChat(estadoInicial, { tipo: "enviar", texto: "hola" }), {
      tipo: "recibir",
      respuesta: { mensajes: [{ tipo: "texto", texto: "Hola" }], sugerencias: [] },
    });
    guardarChatEnSesion(s, e);
    expect(s.datos.has("posse_chat")).toBe(true);
    expect(cargarChatDeSesion(s)).toEqual(e);
  });

  it("cargar sin nada guardado devuelve null", () => {
    expect(cargarChatDeSesion(storageFalso())).toBeNull();
  });

  it("no lanza con un storage roto", () => {
    expect(() => guardarChatEnSesion(storageRoto, estadoInicial)).not.toThrow();
    expect(cargarChatDeSesion(storageRoto)).toBeNull();
  });

  it("el globo no se mostró hasta marcarlo", () => {
    const s = storageFalso();
    expect(globoYaMostrado(s)).toBe(false);
    marcarGloboMostrado(s);
    expect(s.datos.has("posse_chat_globo")).toBe(true);
    expect(globoYaMostrado(s)).toBe(true);
  });

  it("con storage roto el globo cuenta como mostrado y marcar no lanza", () => {
    expect(globoYaMostrado(storageRoto)).toBe(true);
    expect(() => marcarGloboMostrado(storageRoto)).not.toThrow();
  });
});
