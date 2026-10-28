import { describe, expect, it } from "vitest";
import { resumir, type EventoGuardado } from "./estadisticas";

// 27/10/2026 15:00 en Argentina (UTC-3) = 18:00 UTC.
const AHORA = "2026-10-27T18:00:00Z";
const AUTOS = [
  { slug: "gol-2010", nombre: "Volkswagen Gol Power 1.6" },
  { slug: "vento-2017", nombre: "Volkswagen Vento 1.4 DSG" },
];

const ev = (tipo: string, extra: Partial<EventoGuardado> = {}): EventoGuardado => ({
  tipo, vehiculo_slug: null, visitante: null, origen: null, dispositivo: null, creado: "2026-10-27T15:00:00Z", ...extra,
});

describe("resumir", () => {
  it("sin eventos devuelve ceros y un lugar por cada dia", () => {
    const r = resumir([], AUTOS, 7, AHORA);

    expect([r.visitas, r.visitantes, r.consultas, r.simulaciones]).toEqual([0, 0, 0, 0]);
    expect(r.porDia).toHaveLength(7);
    expect(r.porDia[6]).toMatchObject({ dia: "2026-10-27", etiqueta: "27 oct" });
    expect(r.porDia[0].dia).toBe("2026-10-21");
    expect(r.autos).toEqual([]);
  });

  it("cuenta visitas y visitantes unicos (la misma persona dos veces es un visitante)", () => {
    const r = resumir(
      [ev("visita", { visitante: "a" }), ev("visita", { visitante: "a" }), ev("visita", { visitante: "b" }), ev("visita")],
      AUTOS, 7, AHORA,
    );

    expect(r.visitas).toBe(4);
    expect(r.visitantes).toBe(2);
  });

  it("las consultas por WhatsApp se asignan a cada auto, y las que no son de un auto se cuentan aparte", () => {
    const r = resumir(
      [
        ev("whatsapp", { vehiculo_slug: "gol-2010" }), ev("whatsapp", { vehiculo_slug: "gol-2010" }),
        ev("whatsapp", { vehiculo_slug: "vento-2017" }), ev("whatsapp"),
      ],
      AUTOS, 7, AHORA,
    );

    expect(r.consultas).toBe(4);
    expect(r.consultasSinAuto).toBe(1);
    expect(r.autos.map((a) => [a.nombre, a.consultas])).toEqual([["Volkswagen Gol Power 1.6", 2], ["Volkswagen Vento 1.4 DSG", 1]]);
  });

  it("simular y simulacion suman como simulaciones del auto", () => {
    const r = resumir([ev("simular", { vehiculo_slug: "vento-2017" }), ev("simulacion", { vehiculo_slug: "vento-2017" }), ev("simular")], AUTOS, 7, AHORA);

    expect(r.simulaciones).toBe(3);
    expect(r.autos[0]).toMatchObject({ slug: "vento-2017", simulaciones: 2 });
  });

  it("las visitas a la ficha cuentan para el auto", () => {
    const r = resumir([ev("visita", { vehiculo_slug: "gol-2010" }), ev("visita", { vehiculo_slug: "gol-2010" }), ev("visita")], AUTOS, 7, AHORA);

    expect(r.autos).toEqual([{ slug: "gol-2010", nombre: "Volkswagen Gol Power 1.6", visitas: 2, consultas: 0, simulaciones: 0 }]);
  });

  it("ordena los autos por consultas, despues simulaciones y despues visitas", () => {
    const r = resumir(
      [
        ev("visita", { vehiculo_slug: "gol-2010" }), ev("visita", { vehiculo_slug: "gol-2010" }), ev("visita", { vehiculo_slug: "gol-2010" }),
        ev("whatsapp", { vehiculo_slug: "vento-2017" }),
      ],
      AUTOS, 7, AHORA,
    );

    expect(r.autos.map((a) => a.slug)).toEqual(["vento-2017", "gol-2010"]);
  });

  it("un auto que ya no esta en el catalogo se muestra por su slug", () => {
    const r = resumir([ev("whatsapp", { vehiculo_slug: "ranger-2012" })], AUTOS, 7, AHORA);

    expect(r.autos[0].nombre).toBe("ranger-2012");
  });

  it("agrupa por dia argentino: las 02:00 UTC del 28 son todavia el 27 a la noche", () => {
    const r = resumir([ev("visita", { creado: "2026-10-28T02:00:00Z" }), ev("whatsapp", { creado: "2026-10-26T12:00:00Z" })], AUTOS, 7, AHORA);

    expect(r.porDia.find((d) => d.dia === "2026-10-27")?.visitas).toBe(1);
    expect(r.porDia.find((d) => d.dia === "2026-10-26")?.consultas).toBe(1);
  });

  it("ignora lo que cae fuera de los dias pedidos", () => {
    const r = resumir([ev("visita", { creado: "2026-10-01T12:00:00Z" }), ev("whatsapp", { creado: "2026-10-01T12:00:00Z" })], AUTOS, 7, AHORA);

    expect(r.visitas + r.consultas).toBe(0);
  });

  it("cuenta origenes y dispositivos de las visitas", () => {
    const r = resumir(
      [
        ev("visita", { origen: "instagram", dispositivo: "celular" }), ev("visita", { origen: "instagram", dispositivo: "celular" }),
        ev("visita", { origen: "google", dispositivo: "compu" }), ev("visita", { origen: null, dispositivo: "compu" }),
      ],
      AUTOS, 7, AHORA,
    );

    expect(r.origenes).toEqual([{ origen: "instagram", cantidad: 2 }, { origen: "google", cantidad: 1 }]);
    expect(r.dispositivos).toEqual({ celular: 2, compu: 2 });
  });
});
