import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { sesionNueva } from "../sesion";
import type { LeadInput } from "../types";
import {
  cargarEstadoWeb,
  contarMensajesWeb,
  guardarEstadoWeb,
  guardarLeadWeb,
  guardarMensajesWeb,
  type FilaMensajeWeb,
} from "./almacen";
import type { EstadoWeb } from "./asistente";
import { guionNuevo } from "./guiones";

const VISITANTE = "3f2b8c1e-9a4d-4e57-b0aa-0d6f5c1e7a21";
const AHORA = new Date("2026-11-09T15:00:00.000Z");

type Llamada = { metodo: string; args: unknown[] };

/**
 * Fake de Supabase: registra cada eslabón de la cadena (from, select, eq, ...) y, al esperarla (await), devuelve
 * el próximo resultado de la cola. Una cadena que termina en `maybeSingle()` o `limit()` también se espera.
 */
function fakeDb(...resultados: { data?: unknown; count?: number | null; error?: { message: string } | null }[]) {
  const tablas: string[] = [];
  const cadenas: Llamada[][] = [];
  const cola = [...resultados];
  const db = {
    from: (tabla: string) => {
      tablas.push(tabla);
      const cadena: Llamada[] = [];
      cadenas.push(cadena);
      const siguiente = () => {
        const r = cola.shift() ?? {};
        return { data: r.data ?? null, count: r.count ?? null, error: r.error ?? null };
      };
      const consulta: Record<string, unknown> = {};
      for (const metodo of ["select", "insert", "upsert", "update", "delete", "eq", "gte", "limit", "maybeSingle"]) {
        consulta[metodo] = (...args: unknown[]) => {
          cadena.push({ metodo, args });
          return consulta;
        };
      }
      consulta.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(siguiente()).then(ok, ko);
      return consulta;
    },
  } as unknown as SupabaseClient;
  return { db, tablas, cadenas };
}

const estado = (extra: Partial<EstadoWeb> = {}): EstadoWeb => ({
  sesion: { ...sesionNueva(AHORA), vehiculoActualId: "v1" },
  guion: guionNuevo(),
  ...extra,
});

describe("guardarMensajesWeb", () => {
  const filas: FilaMensajeWeb[] = [
    { role: "user", content: "hola", tipo: "texto", via: "texto", vehiculo_slug: "vw-taos-2022", nota: null },
    { role: "assistant", content: "Hola!", tipo: "texto", via: null, vehiculo_slug: "vw-taos-2022", nota: "no_entendido" },
    { role: "assistant", content: "Mensaje para Marcos", tipo: "cierre", via: null, vehiculo_slug: null, nota: null },
  ];

  it("inserta una fila por mensaje, con el visitante, en web_mensajes", async () => {
    const { db, tablas, cadenas } = fakeDb({});

    await guardarMensajesWeb(db, VISITANTE, filas);

    expect(tablas).toEqual(["web_mensajes"]);
    expect(cadenas[0]).toEqual([{ metodo: "insert", args: [filas.map((f) => ({ visitante: VISITANTE, ...f }))] }]);
  });

  it("no toca la base si no hay mensajes", async () => {
    const { db, tablas } = fakeDb({});
    await guardarMensajesWeb(db, VISITANTE, []);
    expect(tablas).toEqual([]);
  });

  it("lanza con el mensaje de Supabase si falla", async () => {
    const { db } = fakeDb({ error: { message: "caido" } });
    await expect(guardarMensajesWeb(db, VISITANTE, filas)).rejects.toThrow(/caido/);
  });
});

describe("cargarEstadoWeb", () => {
  it("devuelve null si no hay fila", async () => {
    const { db, tablas, cadenas } = fakeDb({ data: null });

    expect(await cargarEstadoWeb(db, VISITANTE, AHORA)).toBeNull();
    expect(tablas).toEqual(["web_sesiones"]);
    expect(cadenas[0].find((l) => l.metodo === "eq")?.args).toEqual(["visitante", VISITANTE]);
  });

  it("lee el estado guardado (sesión, guion y ficha)", async () => {
    const guardado = estado({
      guion: { flujo: "financiar", paso: "cuotas", datos: { anticipo: "Sin anticipo" } },
      ficha: "vw-taos-2022",
    });
    const { db } = fakeDb({ data: { estado: guardado.sesion, guion: guardado.guion, ficha: "vw-taos-2022" } });

    expect(await cargarEstadoWeb(db, VISITANTE, AHORA)).toEqual(guardado);
  });

  it("con una fila corrupta devuelve igual un estado válido", async () => {
    const { db } = fakeDb({ data: { estado: "xx", guion: 5, ficha: 7 } });

    const e = await cargarEstadoWeb(db, VISITANTE, AHORA);

    expect(e).toEqual({ sesion: sesionNueva(AHORA), guion: guionNuevo(), ficha: null });
  });

  it("descarta lo inválido del guion jsonb", async () => {
    const { db } = fakeDb({
      data: { estado: sesionNueva(AHORA), guion: { flujo: "hackeo", paso: "cuotas", datos: { anticipo: "x" } }, ficha: null },
    });

    expect((await cargarEstadoWeb(db, VISITANTE, AHORA))?.guion).toEqual(guionNuevo());
  });

  it("una ficha que no es un slug se guarda como null", async () => {
    const { db } = fakeDb({ data: { estado: sesionNueva(AHORA), guion: {}, ficha: "../etc/passwd" } });
    expect((await cargarEstadoWeb(db, VISITANTE, AHORA))?.ficha).toBeNull();
  });

  it("una charla de más de 24 horas empieza de nuevo (null)", async () => {
    const vieja = { ...sesionNueva(AHORA), ultimaActividad: "2026-11-07T15:00:00.000Z" };
    const { db } = fakeDb({ data: { estado: vieja, guion: {}, ficha: null } });

    expect(await cargarEstadoWeb(db, VISITANTE, AHORA)).toBeNull();
  });

  it("lanza con el mensaje de Supabase si falla", async () => {
    const { db } = fakeDb({ error: { message: "caido" } });
    await expect(cargarEstadoWeb(db, VISITANTE, AHORA)).rejects.toThrow(/caido/);
  });
});

describe("guardarEstadoWeb", () => {
  it("hace upsert por visitante con sesión, guion y ficha", async () => {
    const { db, tablas, cadenas } = fakeDb({});
    const e = estado({ ficha: "vw-taos-2022" });

    await guardarEstadoWeb(db, VISITANTE, e);

    expect(tablas).toEqual(["web_sesiones"]);
    const [upsert] = cadenas[0];
    expect(upsert.metodo).toBe("upsert");
    expect(upsert.args[0]).toMatchObject({ visitante: VISITANTE, estado: e.sesion, guion: e.guion, ficha: "vw-taos-2022" });
    expect(Number.isNaN(Date.parse((upsert.args[0] as { actualizado: string }).actualizado))).toBe(false);
    expect(upsert.args[1]).toEqual({ onConflict: "visitante" });
  });

  it("sin ficha (catálogo o estado viejo) guarda null", async () => {
    const a = fakeDb({});
    await guardarEstadoWeb(a.db, VISITANTE, estado());
    expect(a.cadenas[0][0].args[0]).toMatchObject({ ficha: null });

    const b = fakeDb({});
    await guardarEstadoWeb(b.db, VISITANTE, estado({ ficha: null }));
    expect(b.cadenas[0][0].args[0]).toMatchObject({ ficha: null });
  });

  it("una ficha que no es un slug se guarda como null", async () => {
    const { db, cadenas } = fakeDb({});
    await guardarEstadoWeb(db, VISITANTE, estado({ ficha: "../x" }));
    expect(cadenas[0][0].args[0]).toMatchObject({ ficha: null });
  });

  it("lanza con el mensaje de Supabase si falla", async () => {
    const { db } = fakeDb({ error: { message: "caido" } });
    await expect(guardarEstadoWeb(db, VISITANTE, estado())).rejects.toThrow(/caido/);
  });
});

describe("contarMensajesWeb", () => {
  const desde = new Date("2026-11-09T14:50:00.000Z");

  it("cuenta solo los del cliente desde la fecha, de todos los visitantes", async () => {
    const { db, tablas, cadenas } = fakeDb({ count: 42 });

    expect(await contarMensajesWeb(db, desde)).toBe(42);
    expect(tablas).toEqual(["web_mensajes"]);
    const cadena = cadenas[0];
    expect(cadena.find((l) => l.metodo === "select")?.args).toEqual(["id", { count: "exact", head: true }]);
    expect(cadena.filter((l) => l.metodo === "eq").map((l) => l.args)).toEqual([["role", "user"]]);
    expect(cadena.find((l) => l.metodo === "gte")?.args).toEqual(["created_at", desde.toISOString()]);
  });

  it("con visitante filtra también por él", async () => {
    const { db, cadenas } = fakeDb({ count: 3 });

    expect(await contarMensajesWeb(db, desde, VISITANTE)).toBe(3);
    expect(cadenas[0].filter((l) => l.metodo === "eq").map((l) => l.args)).toEqual([
      ["role", "user"],
      ["visitante", VISITANTE],
    ]);
  });

  it("sin conteo devuelve 0", async () => {
    expect(await contarMensajesWeb(fakeDb({ count: null }).db, desde)).toBe(0);
  });

  it("lanza con el mensaje de Supabase si falla", async () => {
    const { db } = fakeDb({ error: { message: "caido" } });
    await expect(contarMensajesWeb(db, desde)).rejects.toThrow(/caido/);
  });
});

describe("guardarLeadWeb", () => {
  const lead: LeadInput = { nombre: "Ana", telefono: "1155551234", vehiculo_interes: "VW Taos 2022", mensaje: "Quiere financiar" };

  it("inserta con origen web, el teléfono en telefono y whatsapp, y sin instagram_id", async () => {
    const { db, tablas, cadenas } = fakeDb({ data: [] }, {});

    await guardarLeadWeb(db, VISITANTE, lead);

    expect(tablas).toEqual(["leads", "leads"]);
    const busqueda = cadenas[0];
    expect(busqueda.filter((l) => l.metodo === "eq").map((l) => l.args)).toEqual([
      ["origen", "web"],
      ["telefono", "1155551234"],
    ]);
    expect(cadenas[1]).toEqual([
      {
        metodo: "insert",
        args: [
          {
            nombre: "Ana",
            telefono: "1155551234",
            whatsapp: "1155551234",
            vehiculo_interes: "VW Taos 2022",
            mensaje: "Quiere financiar",
            origen: "web",
          },
        ],
      },
    ]);
  });

  it("los campos opcionales que faltan van null", async () => {
    const { db, cadenas } = fakeDb({ data: [] }, {});
    await guardarLeadWeb(db, VISITANTE, { nombre: "Ana", telefono: "1155551234" });
    expect(cadenas[1][0].args[0]).toMatchObject({ vehiculo_interes: null, mensaje: null });
  });

  it("no inserta dos veces el mismo teléfono", async () => {
    const { db, tablas } = fakeDb({ data: [{ id: "l1" }] });

    await guardarLeadWeb(db, VISITANTE, lead);

    expect(tablas).toEqual(["leads"]);
  });

  it("lanza con el mensaje de Supabase si falla la búsqueda", async () => {
    const { db } = fakeDb({ error: { message: "caido" } });
    await expect(guardarLeadWeb(db, VISITANTE, lead)).rejects.toThrow(/caido/);
  });

  it("lanza con el mensaje de Supabase si falla el insert", async () => {
    const { db } = fakeDb({ data: [] }, { error: { message: "caido" } });
    await expect(guardarLeadWeb(db, VISITANTE, lead)).rejects.toThrow(/caido/);
  });
});
