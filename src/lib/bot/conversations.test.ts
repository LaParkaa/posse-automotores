import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  esMidPropio,
  guardarSalida,
  marcarNoEntendido,
  reclamarMensaje,
} from "./conversations";

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

  it("lanza si la base falla: un error transitorio no prueba que el mensaje sea de una persona", async () => {
    await expect(esMidPropio(dbConLectura({ data: null, error: { message: "caido" } }).db, "mid.x")).rejects.toThrow(/caido/);
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
