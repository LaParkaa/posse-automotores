import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { guardarLeadInstagram } from "./leads";

function dbFalso(opciones: {
  existentes?: unknown[];
  errorBusqueda?: { message: string };
  errorInsert?: { message: string };
}) {
  const insertados: unknown[] = [];
  const busqueda: Record<string, (...args: unknown[]) => unknown> = {
    select: () => busqueda,
    eq: () => busqueda,
    limit: async () => ({ data: opciones.existentes ?? [], error: opciones.errorBusqueda ?? null }),
  };
  const db = {
    from: () => ({
      ...busqueda,
      insert: async (fila: unknown) => {
        insertados.push(fila);
        return { error: opciones.errorInsert ?? null };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, insertados };
}

describe("guardarLeadInstagram", () => {
  const lead = {
    nombre: "Juan Pérez",
    telefono: "3537 123456",
    vehiculo_interes: "Corolla 2011",
    mensaje: "Quiere verlo el sábado",
  };

  it("inserta el lead con origen instagram y el id del usuario", async () => {
    const { db, insertados } = dbFalso({});

    await guardarLeadInstagram(db, "1234567890", lead);

    expect(insertados).toEqual([
      {
        nombre: "Juan Pérez",
        telefono: "3537 123456",
        vehiculo_interes: "Corolla 2011",
        mensaje: "Quiere verlo el sábado",
        origen: "instagram",
        instagram_id: "1234567890",
      },
    ]);
  });

  it("guarda null en los campos opcionales que no vinieron", async () => {
    const { db, insertados } = dbFalso({});

    await guardarLeadInstagram(db, "1", { nombre: "Ana", telefono: "351 555" });

    expect(insertados[0]).toMatchObject({ vehiculo_interes: null, mensaje: null });
  });

  it("no duplica un lead que ya existe con el mismo usuario y telefono", async () => {
    const { db, insertados } = dbFalso({ existentes: [{ id: "abc" }] });

    await guardarLeadInstagram(db, "1234567890", lead);

    expect(insertados).toEqual([]);
  });

  it("lanza si falla la busqueda o el insert", async () => {
    await expect(
      guardarLeadInstagram(dbFalso({ errorBusqueda: { message: "caido" } }).db, "1", lead),
    ).rejects.toThrow(/caido/);
    await expect(
      guardarLeadInstagram(dbFalso({ errorInsert: { message: "rechazado" } }).db, "1", lead),
    ).rejects.toThrow(/rechazado/);
  });
});
