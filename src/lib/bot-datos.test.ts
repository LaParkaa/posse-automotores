import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cargarDatosWeb, dejoDatosWeb, traerChatWeb } from "./bot-datos";

type Llamada = { metodo: string; args: unknown[] };
type Resultado = { data?: unknown; count?: number | null; error: { message: string } | null };

/**
 * Base de mentira: cada `from(tabla)` arma una consulta encadenable que registra lo que se le pide y, al esperarla
 * (o al llamar `range` / `limit`), contesta lo que decida `responder(tabla, llamadas)`.
 */
function dbFalsa(responder: (tabla: string, llamadas: Llamada[]) => Resultado) {
  const consultas: Array<{ tabla: string; llamadas: Llamada[] }> = [];
  const db = {
    from: (tabla: string) => {
      const llamadas: Llamada[] = [];
      consultas.push({ tabla, llamadas });
      const consulta: Record<string, unknown> = {};
      for (const metodo of ["select", "eq", "in", "gte", "order"]) {
        consulta[metodo] = (...args: unknown[]) => {
          llamadas.push({ metodo, args });
          return consulta;
        };
      }
      for (const metodo of ["range", "limit"]) {
        consulta[metodo] = async (...args: unknown[]) => {
          llamadas.push({ metodo, args });
          return responder(tabla, llamadas);
        };
      }
      consulta.then = (ok: (v: Resultado) => unknown, mal: (e: unknown) => unknown) =>
        Promise.resolve(responder(tabla, llamadas)).then(ok, mal);
      return consulta;
    },
  } as unknown as SupabaseClient;
  return { db, consultas };
}

const filas = (n: number, tabla: "web_mensajes" | "eventos") =>
  Array.from({ length: n }, (_, i) =>
    tabla === "web_mensajes"
      ? { visitante: `v${i}`, role: "user", content: "x", tipo: "texto", vehiculo_slug: null, nota: null, created_at: "2026-11-10T10:00:00Z" }
      : { tipo: "visita", ruta: "/", vehiculo_slug: null, visitante: `v${i}`, creado: "2026-11-10T10:00:00Z" },
  );

const desde = (llamadas: Llamada[], metodo: string) => llamadas.filter((l) => l.metodo === metodo).map((l) => l.args);

describe("cargarDatosWeb", () => {
  it("lee mensajes, eventos y leads web con sus filtros", async () => {
    const { db, consultas } = dbFalsa((tabla) => {
      if (tabla === "web_mensajes") return { data: filas(2, "web_mensajes"), error: null };
      if (tabla === "eventos") return { data: filas(3, "eventos"), error: null };
      return { data: [{ web_visitante: "v1" }, { web_visitante: "v1" }, { web_visitante: null }, { web_visitante: "v2" }, { web_visitante: "v3" }], error: null };
    });

    const datos = await cargarDatosWeb(db, 7);

    expect(datos.mensajes).toHaveLength(2);
    expect(datos.eventos).toHaveLength(3);
    expect(datos.leadsWeb).toBe(5);
    expect(datos.visitantesConDatos).toEqual(["v1", "v2", "v3"]);
    expect(datos.truncado).toBe(false);

    const de = (t: string) => consultas.find((c) => c.tabla === t)!.llamadas;
    expect(desde(de("eventos"), "in")).toEqual([["tipo", ["visita", "chat_abrio", "chat_whatsapp", "simulacion"]]]);
    expect(desde(de("eventos"), "gte")[0][0]).toBe("creado");
    expect(desde(de("web_mensajes"), "gte")[0][0]).toBe("created_at");
    expect(desde(de("leads"), "eq")).toEqual([["origen", "web"]]);
    expect(desde(de("leads"), "select")).toEqual([["web_visitante"]]);
  });

  it("pagina de a 1000 hasta que una página viene incompleta", async () => {
    let pagina = 0;
    const { db, consultas } = dbFalsa((tabla, llamadas) => {
      if (tabla === "web_mensajes") {
        const [desdeFila] = desde(llamadas, "range")[0] as number[];
        pagina = desdeFila / 1000;
        return { data: filas(pagina === 0 ? 1000 : 10, "web_mensajes"), error: null };
      }
      if (tabla === "eventos") return { data: [], error: null };
      return { data: [], error: null };
    });

    const datos = await cargarDatosWeb(db, 7);

    expect(datos.mensajes).toHaveLength(1010);
    expect(datos.truncado).toBe(false);
    const rangos = consultas.filter((c) => c.tabla === "web_mensajes").map((c) => desde(c.llamadas, "range")[0]);
    expect(rangos).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("marca truncado al llegar al tope de 30 páginas", async () => {
    const { db } = dbFalsa((tabla) => {
      if (tabla === "web_mensajes") return { data: filas(1000, "web_mensajes"), error: null };
      if (tabla === "eventos") return { data: [], error: null };
      return { data: [], error: null };
    });

    const datos = await cargarDatosWeb(db, 7);

    expect(datos.mensajes).toHaveLength(30_000);
    expect(datos.truncado).toBe(true);
  });

  it("marca truncado también si se llenan los eventos", async () => {
    const { db } = dbFalsa((tabla) => {
      if (tabla === "eventos") return { data: filas(1000, "eventos"), error: null };
      if (tabla === "web_mensajes") return { data: [], error: null };
      return { data: [], error: null };
    });

    expect((await cargarDatosWeb(db, 7)).truncado).toBe(true);
  });

  it("lanza con el mensaje de Supabase si falla una lectura", async () => {
    for (const rota of ["web_mensajes", "eventos", "leads"]) {
      const { db } = dbFalsa((tabla) =>
        tabla === rota ? { data: null, error: { message: "caido" } } : { data: [], error: null },
      );
      await expect(cargarDatosWeb(db, 7)).rejects.toThrow(/caido/);
    }
  });

  it("sin leads, cero y ningún visitante con datos", async () => {
    const { db } = dbFalsa(() => ({ data: [], error: null }));
    const datos = await cargarDatosWeb(db, 7);
    expect(datos.leadsWeb).toBe(0);
    expect(datos.visitantesConDatos).toEqual([]);
  });

  it("si falla la lectura de leads, falla todo (no se muestra a medias)", async () => {
    const { db } = dbFalsa((tabla) => (tabla === "leads" ? { data: null, error: { message: "sin columna" } } : { data: [], error: null }));
    await expect(cargarDatosWeb(db, 7)).rejects.toThrow(/sin columna/);
  });
});

describe("cargarDatosWeb: corte de los leads", () => {
  afterEach(() => vi.useRealTimers());

  const gteDeLeads = async (dias: number) => {
    const { db, consultas } = dbFalsa((tabla) => (tabla === "leads" ? { data: [{ web_visitante: "v1" }], error: null } : { data: [], error: null }));
    await cargarDatosWeb(db, dias);
    return desde(consultas.find((c) => c.tabla === "leads")!.llamadas, "gte");
  };

  it("cuenta los leads desde la medianoche argentina del primer día, igual que el resto del resumen", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T15:00:00.000Z")); // 12:00 en Argentina
    expect(await gteDeLeads(1)).toEqual([["created_at", "2026-11-10T03:00:00.000Z"]]);
    expect(await gteDeLeads(3)).toEqual([["created_at", "2026-11-08T03:00:00.000Z"]]);
  });

  it("justo después de la medianoche argentina el día de hoy recién empieza", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T03:05:00.000Z")); // 00:05 en Argentina
    expect(await gteDeLeads(1)).toEqual([["created_at", "2026-11-10T03:00:00.000Z"]]);
  });
});

describe("dejoDatosWeb", () => {
  it("cuenta los leads web de ese visitante", async () => {
    const { db, consultas } = dbFalsa(() => ({ count: 1, error: null }));
    expect(await dejoDatosWeb(db, "abc12345")).toBe(true);
    const { tabla, llamadas } = consultas[0];
    expect(tabla).toBe("leads");
    expect(desde(llamadas, "eq")).toEqual([
      ["origen", "web"],
      ["web_visitante", "abc12345"],
    ]);
  });

  it("sin leads (o conteo nulo) es false", async () => {
    expect(await dejoDatosWeb(dbFalsa(() => ({ count: 0, error: null })).db, "abc12345")).toBe(false);
    expect(await dejoDatosWeb(dbFalsa(() => ({ count: null, error: null })).db, "abc12345")).toBe(false);
  });

  it("lanza con el mensaje de Supabase si falla", async () => {
    const { db } = dbFalsa(() => ({ count: null, error: { message: "caido" } }));
    await expect(dejoDatosWeb(db, "abc12345")).rejects.toThrow(/caido/);
  });
});

describe("traerChatWeb", () => {
  it("trae el chat del visitante del primer mensaje al último", async () => {
    const { db, consultas } = dbFalsa(() => ({ data: filas(2, "web_mensajes"), error: null }));

    const chat = await traerChatWeb(db, "abc12345");

    expect(chat).toHaveLength(2);
    const { tabla, llamadas } = consultas[0];
    expect(tabla).toBe("web_mensajes");
    expect(desde(llamadas, "eq")).toEqual([["visitante", "abc12345"]]);
    expect(desde(llamadas, "order")).toEqual([["created_at", { ascending: true }]]);
    expect(desde(llamadas, "limit")).toEqual([[2000]]);
  });

  it("lanza con el mensaje de Supabase si falla", async () => {
    const { db } = dbFalsa(() => ({ data: null, error: { message: "caido" } }));
    await expect(traerChatWeb(db, "abc12345")).rejects.toThrow(/caido/);
  });
});
