import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sesionNueva } from "./sesion";
import {
  aprenderHistoria,
  cargarChat,
  guardarPerfil,
  guardarSesion,
  olvidarHistoria,
  pausarChat,
  vehiculoDeHistoria,
} from "./sesiones";

const AHORA = new Date("2026-10-11T15:00:00Z");
type Resultado = { data?: unknown; error: { message: string } | null };

/**
 * Fake encadenable: registra cada llamada (tabla, upsert, update, delete, eq...) y
 * contesta `escritura` al escribir. Las lecturas se sirven en orden desde `lecturas`
 * para poder probar el "leer y luego escribir" de aprenderHistoria.
 */
function dbFake(opciones: { lecturas?: Resultado[]; escritura?: Resultado } = {}) {
  const lecturas = [...(opciones.lecturas ?? [])];
  const escritura = opciones.escritura ?? { error: null };
  const registro = {
    tablas: [] as string[],
    selects: [] as unknown[][],
    eqs: [] as unknown[][],
    upserts: [] as unknown[][],
    updates: [] as unknown[],
    deletes: 0,
  };
  const leer = async () => lecturas.shift() ?? { data: null, error: null };
  const filtro = (...args: unknown[]) => {
    registro.eqs.push(args);
    return Object.assign(Promise.resolve(escritura), { maybeSingle: leer });
  };
  const tabla = {
    select: (...args: unknown[]) => {
      registro.selects.push(args);
      return { eq: filtro };
    },
    upsert: async (...args: unknown[]) => {
      registro.upserts.push(args);
      return escritura;
    },
    update: (valores: unknown) => {
      registro.updates.push(valores);
      return { eq: filtro };
    },
    delete: () => {
      registro.deletes++;
      return { eq: filtro };
    },
  };
  const db = {
    from: (t: string) => {
      registro.tablas.push(t);
      return tabla;
    },
  } as unknown as SupabaseClient;
  return { db, registro };
}

afterEach(() => vi.restoreAllMocks());

describe("cargarChat", () => {
  const TODO_NULO = { sesion: null, pausaHasta: null, perfil: null };

  it("sin fila devuelve todo null", async () => {
    const { db, registro } = dbFake({ lecturas: [{ data: null, error: null }] });

    expect(await cargarChat(db, "123", AHORA)).toEqual(TODO_NULO);
    expect(registro.tablas).toEqual(["ig_sesiones"]);
    expect(registro.eqs).toEqual([["ig_user_id", "123"]]);
  });

  it("con fila devuelve la sesion normalizada, la pausa como Date y el perfil", async () => {
    const { db } = dbFake({
      lecturas: [
        {
          data: {
            estado: { paso: "pidiendo_nombre", saludado: true, ultimaActividad: AHORA.toISOString() },
            pausa_hasta: "2026-10-11T18:00:00Z",
            perfil: { nombre: "Juan", usuario: "juan_g" },
          },
          error: null,
        },
      ],
    });

    const r = await cargarChat(db, "123", AHORA);

    expect(r.sesion).toEqual({ ...sesionNueva(AHORA), paso: "pidiendo_nombre", saludado: true });
    expect(r.pausaHasta).toEqual(new Date("2026-10-11T18:00:00Z"));
    expect(r.perfil).toEqual({ nombre: "Juan", usuario: "juan_g" });
  });

  it("tolera pausa y perfil ausentes o invalidos", async () => {
    const { db } = dbFake({
      lecturas: [{ data: { estado: {}, pausa_hasta: "no es fecha", perfil: "x" }, error: null }],
    });

    const r = await cargarChat(db, "123", AHORA);

    expect(r.sesion).toEqual(sesionNueva(AHORA));
    expect(r.pausaHasta).toBeNull();
    expect(r.perfil).toBeNull();
  });

  it("descarta del perfil lo que no es texto", async () => {
    const { db } = dbFake({
      lecturas: [{ data: { estado: {}, pausa_hasta: null, perfil: { nombre: 5, usuario: "juan_g" } }, error: null }],
    });

    expect((await cargarChat(db, "123", AHORA)).perfil).toEqual({ usuario: "juan_g" });
  });

  it("ante un error de la base devuelve todo null y lo registra", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dbFake({ lecturas: [{ data: null, error: { message: "caido" } }] });

    expect(await cargarChat(db, "123", AHORA)).toEqual(TODO_NULO);
    expect(log).toHaveBeenCalled();
  });
});

describe("escrituras por cliente", () => {
  it("guardarSesion hace upsert solo de estado y actualizado", async () => {
    const { db, registro } = dbFake();
    const sesion = { ...sesionNueva(AHORA), saludado: true };

    await guardarSesion(db, "123", sesion);

    expect(registro.tablas).toEqual(["ig_sesiones"]);
    const [fila, opciones] = registro.upserts[0];
    expect(Object.keys(fila as object).sort()).toEqual(["actualizado", "estado", "ig_user_id"]);
    expect(fila).toMatchObject({ ig_user_id: "123", estado: sesion });
    expect(opciones).toEqual({ onConflict: "ig_user_id" });
  });

  it("pausarChat hace upsert solo de pausa_hasta y actualizado", async () => {
    const { db, registro } = dbFake();

    await pausarChat(db, "123", new Date("2026-10-11T18:00:00Z"));

    const [fila, opciones] = registro.upserts[0];
    expect(Object.keys(fila as object).sort()).toEqual(["actualizado", "ig_user_id", "pausa_hasta"]);
    expect(fila).toMatchObject({ ig_user_id: "123", pausa_hasta: "2026-10-11T18:00:00.000Z" });
    expect(opciones).toEqual({ onConflict: "ig_user_id" });
  });

  it("guardarPerfil hace upsert solo del perfil", async () => {
    const { db, registro } = dbFake();

    await guardarPerfil(db, "123", { nombre: "Juan", usuario: "juan_g" });

    const [fila, opciones] = registro.upserts[0];
    expect(Object.keys(fila as object).sort()).toEqual(["actualizado", "ig_user_id", "perfil"]);
    expect(fila).toMatchObject({ ig_user_id: "123", perfil: { nombre: "Juan", usuario: "juan_g" } });
    expect(opciones).toEqual({ onConflict: "ig_user_id" });
  });

  it("lanzan si la base falla", async () => {
    const { db } = dbFake({ escritura: { error: { message: "caido" } } });

    await expect(guardarSesion(db, "123", sesionNueva(AHORA))).rejects.toThrow(/caido/);
    await expect(pausarChat(db, "123", AHORA)).rejects.toThrow(/caido/);
    await expect(guardarPerfil(db, "123", { nombre: "Juan" })).rejects.toThrow(/caido/);
  });
});

describe("vehiculoDeHistoria", () => {
  it("devuelve el vehiculo_id de la historia", async () => {
    const { db, registro } = dbFake({ lecturas: [{ data: { vehiculo_id: "v-1" }, error: null }] });

    expect(await vehiculoDeHistoria(db, "st-1")).toBe("v-1");
    expect(registro.tablas).toEqual(["ig_historias"]);
    expect(registro.eqs).toEqual([["story_id", "st-1"]]);
  });

  it("devuelve null si no hay fila", async () => {
    expect(await vehiculoDeHistoria(dbFake().db, "st-1")).toBeNull();
  });

  it("devuelve null y registra si la base falla", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dbFake({ lecturas: [{ data: null, error: { message: "caido" } }] });

    expect(await vehiculoDeHistoria(db, "st-1")).toBeNull();
    expect(log).toHaveBeenCalled();
  });
});

describe("aprenderHistoria", () => {
  it("si ya apunta al mismo auto suma una confirmacion", async () => {
    const { db, registro } = dbFake({ lecturas: [{ data: { vehiculo_id: "v-1", confirmaciones: 2 }, error: null }] });

    await aprenderHistoria(db, "st-1", "v-1");

    expect(registro.upserts).toEqual([]);
    expect(registro.updates).toHaveLength(1);
    expect(registro.updates[0]).toMatchObject({ confirmaciones: 3 });
    expect(Object.keys(registro.updates[0] as object).sort()).toEqual(["actualizado", "confirmaciones"]);
    expect(registro.eqs.at(-1)).toEqual(["story_id", "st-1"]);
  });

  it("si apunta a otro auto lo reemplaza con confirmaciones 1", async () => {
    const { db, registro } = dbFake({ lecturas: [{ data: { vehiculo_id: "v-9", confirmaciones: 5 }, error: null }] });

    await aprenderHistoria(db, "st-1", "v-1");

    expect(registro.updates).toEqual([]);
    const [fila, opciones] = registro.upserts[0];
    expect(fila).toMatchObject({ story_id: "st-1", vehiculo_id: "v-1", confirmaciones: 1 });
    expect(fila).toHaveProperty("actualizado");
    expect(opciones).toEqual({ onConflict: "story_id" });
  });

  it("si no hay fila la crea con confirmaciones 1", async () => {
    const { db, registro } = dbFake();

    await aprenderHistoria(db, "st-1", "v-1");

    expect(registro.upserts[0][0]).toMatchObject({ story_id: "st-1", vehiculo_id: "v-1", confirmaciones: 1 });
  });

  it("lanza si la base falla al escribir", async () => {
    const { db } = dbFake({ escritura: { error: { message: "caido" } } });

    await expect(aprenderHistoria(db, "st-1", "v-1")).rejects.toThrow(/caido/);
  });

  it("lanza si falla la lectura previa", async () => {
    const { db } = dbFake({ lecturas: [{ data: null, error: { message: "caido" } }] });

    await expect(aprenderHistoria(db, "st-1", "v-1")).rejects.toThrow(/caido/);
  });
});

describe("olvidarHistoria", () => {
  it("borra la historia por story_id", async () => {
    const { db, registro } = dbFake();

    await olvidarHistoria(db, "st-1");

    expect(registro.tablas).toEqual(["ig_historias"]);
    expect(registro.deletes).toBe(1);
    expect(registro.eqs).toEqual([["story_id", "st-1"]]);
  });

  it("lanza si la base falla", async () => {
    await expect(olvidarHistoria(dbFake({ escritura: { error: { message: "caido" } } }).db, "st-1")).rejects.toThrow(/caido/);
  });
});
