import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  esMidPropio,
  guardarRespuesta,
  guardarSalida,
  marcarNoEntendido,
  normalizarHistorial,
  obtenerHistorial,
  reclamarMensaje,
} from "./conversations";
import type { TurnoHistorial } from "./types";

describe("normalizarHistorial", () => {
  it("descarta los turnos del asistente que quedaron al principio", () => {
    const filas: TurnoHistorial[] = [
      { role: "assistant", content: "respuesta vieja" },
      { role: "user", content: "hola" },
    ];

    expect(normalizarHistorial(filas)).toEqual([{ role: "user", content: "hola" }]);
  });

  it("une los turnos consecutivos del mismo rol", () => {
    const filas: TurnoHistorial[] = [
      { role: "user", content: "hola" },
      { role: "user", content: "tienen autos?" },
      { role: "assistant", content: "si!" },
    ];

    expect(normalizarHistorial(filas)).toEqual([
      { role: "user", content: "hola\ntienen autos?" },
      { role: "assistant", content: "si!" },
    ]);
  });

  it("no muta la lista de entrada", () => {
    const filas: TurnoHistorial[] = [
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ];

    normalizarHistorial(filas);

    expect(filas).toEqual([
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ]);
  });

  it("devuelve lista vacia si no hay turnos del usuario", () => {
    expect(normalizarHistorial([])).toEqual([]);
    expect(normalizarHistorial([{ role: "assistant", content: "x" }])).toEqual([]);
  });
});

describe("reclamarMensaje", () => {
  const dbConInsert = (resultado: { error: { code?: string; message: string } | null }) => {
    const insertados: unknown[] = [];
    const db = {
      from: () => ({
        insert: async (fila: unknown) => {
          insertados.push(fila);
          return resultado;
        },
      }),
    } as unknown as SupabaseClient;
    return { db, insertados };
  };

  it("devuelve true y guarda el mensaje del usuario cuando es nuevo", async () => {
    const { db, insertados } = dbConInsert({ error: null });

    expect(await reclamarMensaje(db, "123", "mid.abc", "Hola")).toBe(true);
    expect(insertados).toEqual([
      { mid: "mid.abc", ig_user_id: "123", role: "user", content: "Hola" },
    ]);
  });

  it("devuelve false cuando el mid ya existe (reintento de Meta)", async () => {
    const { db } = dbConInsert({ error: { code: "23505", message: "duplicate key" } });

    expect(await reclamarMensaje(db, "123", "mid.abc", "Hola")).toBe(false);
  });

  it("lanza ante cualquier otro error de la base", async () => {
    const { db } = dbConInsert({ error: { code: "XX000", message: "caido" } });

    await expect(reclamarMensaje(db, "123", "mid.abc", "Hola")).rejects.toThrow(/caido/);
  });
});

describe("obtenerHistorial", () => {
  it("devuelve los turnos en orden cronologico aunque la base los traiga del mas nuevo al mas viejo", async () => {
    // Se registran las llamadas para vigilar la privacidad: sin el filtro por usuario,
    // el historial mezclaria conversaciones de otros clientes.
    let tabla = "";
    const eqs: unknown[][] = [];
    const orders: unknown[][] = [];
    const limits: unknown[] = [];
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: (...args) => {
        eqs.push(args);
        return consulta;
      },
      order: (...args) => {
        orders.push(args);
        return consulta;
      },
      limit: async (n) => {
        limits.push(n);
        return {
          data: [
            { role: "user", content: "tercero" },
            { role: "assistant", content: "segundo" },
            { role: "user", content: "primero" },
          ],
          error: null,
        };
      },
    };
    const db = {
      from: (nombre: string) => {
        tabla = nombre;
        return consulta;
      },
    } as unknown as SupabaseClient;

    expect(await obtenerHistorial(db, "123")).toEqual([
      { role: "user", content: "primero" },
      { role: "assistant", content: "segundo" },
      { role: "user", content: "tercero" },
    ]);
    expect(tabla).toBe("ig_mensajes");
    expect(eqs).toContainEqual(["ig_user_id", "123"]);
    expect(orders).toContainEqual(["created_at", { ascending: false }]);
    expect(limits).toEqual([10]);
  });

  it("lanza si la consulta falla", async () => {
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: () => consulta,
      order: () => consulta,
      limit: async () => ({ data: null, error: { message: "caido" } }),
    };
    const db = { from: () => consulta } as unknown as SupabaseClient;

    await expect(obtenerHistorial(db, "123")).rejects.toThrow(/caido/);
  });
});

describe("guardarRespuesta", () => {
  it("guarda la respuesta del bot como turno del asistente, sin mid", async () => {
    const insertados: unknown[] = [];
    const db = {
      from: () => ({
        insert: async (fila: unknown) => {
          insertados.push(fila);
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    await guardarRespuesta(db, "123", "¡Hola!");

    expect(insertados).toEqual([{ ig_user_id: "123", role: "assistant", content: "¡Hola!" }]);
  });
});

describe("guardarSalida", () => {
  const dbConInsert = (error: { message: string } | null = null) => {
    const insertados: unknown[] = [];
    let tabla = "";
    let llamadas = 0;
    const db = {
      from: (t: string) => {
        tabla = t;
        return {
          insert: async (filas: unknown) => {
            llamadas++;
            insertados.push(filas);
            return { error };
          },
        };
      },
    } as unknown as SupabaseClient;
    return { db, insertados, tabla: () => tabla, llamadas: () => llamadas };
  };

  it("inserta una fila assistant por parte, con su mid (o null)", async () => {
    const { db, insertados, tabla } = dbConInsert();

    await guardarSalida(db, "123", [
      { texto: "Hola!", mid: "mid.1" },
      { texto: "Mira este auto", mid: null },
    ]);

    expect(tabla()).toBe("ig_mensajes");
    expect(insertados).toEqual([
      [
        { ig_user_id: "123", role: "assistant", content: "Hola!", mid: "mid.1" },
        { ig_user_id: "123", role: "assistant", content: "Mira este auto", mid: null },
      ],
    ]);
  });

  it("no toca la base si no hay partes", async () => {
    const { db, llamadas } = dbConInsert();

    await guardarSalida(db, "123", []);

    expect(llamadas()).toBe(0);
  });

  it("lanza si la base falla", async () => {
    const { db } = dbConInsert({ message: "caido" });

    await expect(guardarSalida(db, "123", [{ texto: "x", mid: null }])).rejects.toThrow(/caido/);
  });
});

describe("esMidPropio", () => {
  const dbConLectura = (resultado: { data: unknown; error: { message: string } | null }) => {
    const eqs: unknown[][] = [];
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: (...args) => {
        eqs.push(args);
        return consulta;
      },
      limit: async () => resultado,
    };
    const db = { from: () => consulta } as unknown as SupabaseClient;
    return { db, eqs };
  };

  it("es true si existe una fila con ese mid", async () => {
    const { db, eqs } = dbConLectura({ data: [{ mid: "mid.1" }], error: null });

    expect(await esMidPropio(db, "mid.1")).toBe(true);
    expect(eqs).toContainEqual(["mid", "mid.1"]);
  });

  it("es false si no existe", async () => {
    expect(await esMidPropio(dbConLectura({ data: [], error: null }).db, "mid.x")).toBe(false);
  });

  it("es false (sin lanzar) si la base falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await esMidPropio(dbConLectura({ data: null, error: { message: "caido" } }).db, "mid.x")).toBe(false);
    vi.restoreAllMocks();
  });
});

describe("marcarNoEntendido", () => {
  it("marca la nota no_entendido en el mensaje con ese mid", async () => {
    const updates: unknown[] = [];
    const eqs: unknown[][] = [];
    let tabla = "";
    const db = {
      from: (t: string) => {
        tabla = t;
        return {
          update: (valores: unknown) => {
            updates.push(valores);
            return {
              eq: async (...args: unknown[]) => {
                eqs.push(args);
                return { error: null };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    await marcarNoEntendido(db, "mid.9");

    expect(tabla).toBe("ig_mensajes");
    expect(updates).toEqual([{ nota: "no_entendido" }]);
    expect(eqs).toEqual([["mid", "mid.9"]]);
  });

  it("no lanza si la base falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      from: () => ({ update: () => ({ eq: async () => ({ error: { message: "caido" } }) }) }),
    } as unknown as SupabaseClient;

    await expect(marcarNoEntendido(db, "mid.9")).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});
