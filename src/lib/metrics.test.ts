import { describe, expect, it } from "vitest";
import type { Vehiculo } from "./types";
import { getKpis, getSerieVentas, startOfArWeek, toArDay } from "./metrics";

/** Vehículo mínimo: solo importan estado, created_at y sold_at. */
function v(parcial: Partial<Vehiculo>): Vehiculo {
  return {
    id: "id", slug: "slug", nombre: "Auto", marca: "Marca", modelo: "Modelo",
    anio: 2020, kilometraje: "0 km", combustible: "Nafta", transmision: "Manual",
    motor: null, tipo: null, descripcion: null, precio_texto: "Consultar",
    cover_image_url: null, imagenes: [], videos: [], estado: "disponible",
    badge: null, promocionado_reel: false, created_at: "2026-01-01T12:00:00Z", deleted_at: null,
    sold_at: null, sale_price: null, sale_notes: null,
    ...parcial,
  };
}

describe("toArDay", () => {
  it("mapea un instante al dia calendario argentino", () => {
    expect(toArDay("2026-08-27T15:00:00Z").toISOString()).toBe("2026-08-27T00:00:00.000Z");
  });

  it("antes de las 03:00 UTC todavia es el dia anterior en Argentina", () => {
    expect(toArDay("2026-08-27T02:30:00Z").toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });
});

describe("startOfArWeek", () => {
  it("devuelve el lunes de esa semana", () => {
    // 2026-08-27 es jueves; el lunes es el 24.
    expect(startOfArWeek("2026-08-27T15:00:00Z").toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("un lunes se devuelve a si mismo", () => {
    expect(startOfArWeek("2026-08-24T15:00:00Z").toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("el domingo cierra la semana que arranco el lunes anterior", () => {
    expect(startOfArWeek("2026-08-30T15:00:00Z").toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });
});

describe("getKpis", () => {
  const ahora = "2026-08-27T15:00:00Z"; // jueves

  it("cuenta el stock activo como disponibles mas reservados", () => {
    const k = getKpis([
      v({ estado: "disponible" }),
      v({ estado: "disponible" }),
      v({ estado: "reservado" }),
      v({ estado: "vendido", sold_at: ahora }),
    ], ahora);
    expect(k.stockActivo).toBe(3);
    expect(k.disponibles).toBe(2);
    expect(k.reservados).toBe(1);
  });

  it("compara la semana corriente contra la anterior", () => {
    const k = getKpis([
      v({ estado: "vendido", sold_at: "2026-08-25T14:00:00Z" }), // esta semana
      v({ estado: "vendido", sold_at: "2026-08-27T14:00:00Z" }), // esta semana
      v({ estado: "vendido", sold_at: "2026-08-19T14:00:00Z" }), // semana previa
    ], ahora);
    expect(k.vendidosSemana).toBe(2);
    expect(k.vendidosSemanaPrevia).toBe(1);
    expect(k.deltaSemana).toBe(1);
  });

  it("ignora los vendidos sin sold_at", () => {
    const k = getKpis([
      v({ estado: "vendido", sold_at: null }),
      v({ estado: "vendido", sold_at: "2026-08-25T14:00:00Z" }),
    ], ahora);
    expect(k.vendidosSemana).toBe(1);
  });

  it("promedia los dias en stock de las ventas de los ultimos 90 dias", () => {
    const k = getKpis([
      v({ estado: "vendido", created_at: "2026-08-05T12:00:00Z", sold_at: "2026-08-15T12:00:00Z" }), // 10 d
      v({ estado: "vendido", created_at: "2026-08-05T12:00:00Z", sold_at: "2026-08-25T12:00:00Z" }), // 20 d
    ], ahora);
    expect(k.rotacionDias).toBe(15);
  });

  it("excluye del promedio las ventas de hace mas de 90 dias", () => {
    const k = getKpis([
      v({ estado: "vendido", created_at: "2026-01-01T12:00:00Z", sold_at: "2026-02-01T12:00:00Z" }),
      v({ estado: "vendido", created_at: "2026-08-05T12:00:00Z", sold_at: "2026-08-15T12:00:00Z" }),
    ], ahora);
    expect(k.rotacionDias).toBe(10);
  });

  it("devuelve null cuando no hay ninguna venta con fecha", () => {
    const k = getKpis([v({ estado: "disponible" })], ahora);
    expect(k.rotacionDias).toBeNull();
  });
});

describe("getSerieVentas", () => {
  const ahora = "2026-08-27T15:00:00Z";

  it("devuelve 30 buckets diarios, incluidos los vacios", () => {
    const s = getSerieVentas([], "dia", ahora);
    expect(s).toHaveLength(30);
    expect(s.every((b) => b.total === 0)).toBe(true);
    expect(s[29].key).toBe("2026-08-27");
  });

  it("agrupa las ventas en el dia argentino correcto", () => {
    const s = getSerieVentas([
      v({ estado: "vendido", sold_at: "2026-08-27T15:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-08-27T16:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-08-27T02:00:00Z" }), // todavia es el 26 en Argentina
    ], "dia", ahora);
    expect(s.find((b) => b.key === "2026-08-27")?.total).toBe(2);
    expect(s.find((b) => b.key === "2026-08-26")?.total).toBe(1);
  });

  it("devuelve 12 buckets semanales indexados por lunes", () => {
    const s = getSerieVentas([
      v({ estado: "vendido", sold_at: "2026-08-25T14:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-08-27T14:00:00Z" }),
    ], "semana", ahora);
    expect(s).toHaveLength(12);
    expect(s[11].key).toBe("2026-08-24");
    expect(s[11].total).toBe(2);
  });

  it("devuelve 12 buckets mensuales con etiqueta corta", () => {
    const s = getSerieVentas([
      v({ estado: "vendido", sold_at: "2026-08-10T14:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-07-10T14:00:00Z" }),
    ], "mes", ahora);
    expect(s).toHaveLength(12);
    expect(s[11].key).toBe("2026-08");
    expect(s[11].label).toBe("ago");
    expect(s[11].total).toBe(1);
    expect(s[10].total).toBe(1);
  });

  it("ignora los vendidos sin sold_at", () => {
    const s = getSerieVentas([v({ estado: "vendido", sold_at: null })], "dia", ahora);
    expect(s.every((b) => b.total === 0)).toBe(true);
  });
});
