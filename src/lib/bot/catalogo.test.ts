import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { obtenerCatalogo } from "./catalogo";

type Resultado = { data: unknown; error: { message: string } | null };
type Llamadas = Record<string, unknown[][]>;

/** Un fake por consulta: cada `from()` abre una consulta nueva y `limit` la cierra con su resultado. */
function dbCon(resultados: { disponibles: Resultado; vendidos: Resultado }) {
  const consultas: Llamadas[] = [];
  const db = {
    from: (tabla: string) => {
      const llamadas: Llamadas = { from: [[tabla]] };
      consultas.push(llamadas);
      const registrar = (nombre: string) => (...args: unknown[]) => {
        (llamadas[nombre] ??= []).push(args);
        return consulta;
      };
      const consulta: Record<string, (...args: unknown[]) => unknown> = {
        select: registrar("select"),
        in: registrar("in"),
        eq: registrar("eq"),
        is: registrar("is"),
        order: registrar("order"),
        limit: async (...args: unknown[]) => {
          (llamadas["limit"] ??= []).push(args);
          // La consulta de vendidos es la que filtra con eq("estado", "vendido").
          return llamadas["eq"] ? resultados.vendidos : resultados.disponibles;
        },
      };
      return consulta;
    },
  } as unknown as SupabaseClient;
  return { db, consultas };
}

const ok = (data: unknown): Resultado => ({ data, error: null });
const auto = (id: string, estado: "disponible" | "reservado" | "vendido") => ({ ...CATALOGO[0], id, estado });

describe("obtenerCatalogo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hace dos consultas publicas: disponibles/reservados (tope 500) y vendidos recientes (60), sin columnas de venta", async () => {
    const { db, consultas } = dbCon({ disponibles: ok([auto("a", "disponible")]), vendidos: ok([auto("v", "vendido")]) });

    await obtenerCatalogo(db);

    expect(consultas).toHaveLength(2);
    const [disp, vend] = consultas;
    for (const c of consultas) {
      expect(c["from"][0]).toEqual(["vehiculos_posse"]);
      const columnas = String(c["select"][0][0]);
      for (const publica of ["id", "slug", "precio_texto", "cover_image_url", "estado", "created_at"]) expect(columnas).toContain(publica);
      for (const privada of ["sale_price", "sale_notes", "sold_at"]) expect(columnas).not.toContain(privada);
      expect(c["is"][0]).toEqual(["deleted_at", null]);
    }
    expect(disp["in"][0]).toEqual(["estado", ["disponible", "reservado"]]);
    expect(disp["order"][0]).toEqual(["created_at", { ascending: false }]);
    expect(disp["limit"][0]).toEqual([500]);
    expect(vend["eq"][0]).toEqual(["estado", "vendido"]);
    expect(vend["order"][0]).toEqual(["sold_at", { ascending: false, nullsFirst: false }]);
    expect(vend["limit"][0]).toEqual([60]);
  });

  it("junta ambas listas con los disponibles/reservados primero", async () => {
    const disponibles = [auto("d1", "disponible"), auto("r1", "reservado")];
    const vendidos = [auto("v1", "vendido"), auto("v2", "vendido")];
    const { db } = dbCon({ disponibles: ok(disponibles), vendidos: ok(vendidos) });

    const r = await obtenerCatalogo(db);

    expect(r?.map((v) => v.id)).toEqual(["d1", "r1", "v1", "v2"]);
  });

  it("un auto disponible viejo no se pierde aunque haya muchos vendidos mas nuevos", async () => {
    const viejo = { ...auto("viejo", "disponible"), created_at: "2020-01-01T00:00:00Z" };
    const vendidosNuevos = Array.from({ length: 60 }, (_, i) => auto(`v${i}`, "vendido"));
    const { db } = dbCon({ disponibles: ok([viejo]), vendidos: ok(vendidosNuevos) });

    const r = await obtenerCatalogo(db);

    expect(r).toHaveLength(61);
    expect(r?.[0].id).toBe("viejo");
  });

  it("sin datos en alguna lista (null) usa lista vacia", async () => {
    const { db } = dbCon({ disponibles: ok(null), vendidos: ok([auto("v", "vendido")]) });

    expect((await obtenerCatalogo(db))?.map((v) => v.id)).toEqual(["v"]);
  });

  it.each(["disponibles", "vendidos"] as const)("devuelve null (sin lanzar) si falla la consulta de %s", async (cual) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const resultados = { disponibles: ok([auto("a", "disponible")]), vendidos: ok([auto("v", "vendido")]) };
    resultados[cual] = { data: null, error: { message: "caido" } };

    expect(await obtenerCatalogo(dbCon(resultados).db)).toBeNull();
    expect(console.error).toHaveBeenCalled();
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
