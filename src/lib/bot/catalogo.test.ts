import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { obtenerCatalogo } from "./catalogo";

function dbCon(resultado: { data: unknown; error: { message: string } | null }) {
  const llamadas: Record<string, unknown[]> = {};
  const registrar = (nombre: string) => (...args: unknown[]) => {
    (llamadas[nombre] ??= []).push(args);
    return consulta;
  };
  const consulta: Record<string, (...args: unknown[]) => unknown> = {
    select: registrar("select"),
    in: registrar("in"),
    is: registrar("is"),
    order: registrar("order"),
    limit: async (...args: unknown[]) => {
      (llamadas["limit"] ??= []).push(args);
      return resultado;
    },
  };
  let tabla = "";
  const db = { from: (t: string) => ((tabla = t), consulta) } as unknown as SupabaseClient;
  return { db, llamadas, tabla: () => tabla };
}

describe("obtenerCatalogo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lee vehiculos_posse con estados visibles, sin borrados, y sin columnas de venta", async () => {
    const { db, llamadas, tabla } = dbCon({ data: CATALOGO, error: null });

    const r = await obtenerCatalogo(db);

    expect(r).toEqual(CATALOGO);
    expect(tabla()).toBe("vehiculos_posse");
    const columnas = String((llamadas["select"][0] as unknown[])[0]);
    for (const c of ["id", "slug", "precio_texto", "cover_image_url", "estado", "created_at"]) expect(columnas).toContain(c);
    for (const privada of ["sale_price", "sale_notes", "sold_at"]) expect(columnas).not.toContain(privada);
    expect(llamadas["in"][0]).toEqual(["estado", ["disponible", "reservado", "vendido"]]);
    expect(llamadas["is"][0]).toEqual(["deleted_at", null]);
    expect(llamadas["order"][0]).toEqual(["created_at", { ascending: false }]);
    expect(llamadas["limit"][0]).toEqual([120]);
  });

  it("devuelve null (sin lanzar) si Supabase falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await obtenerCatalogo(dbCon({ data: null, error: { message: "caido" } }).db)).toBeNull();
  });

  it("devuelve null (sin lanzar) si la consulta revienta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      from: () => {
        throw new Error("sin red");
      },
    } as unknown as SupabaseClient;

    expect(await obtenerCatalogo(db)).toBeNull();
  });
});
