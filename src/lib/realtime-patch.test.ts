import { describe, expect, it } from "vitest";
import type { Vehiculo } from "./types";
import { aplicarCambio } from "./realtime-patch";

function v(id: string, parcial: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id, slug: `slug-${id}`, nombre: `Auto ${id}`, marca: "Marca", modelo: "Modelo",
    anio: 2020, kilometraje: "0 km", combustible: "Nafta", transmision: "Manual",
    motor: null, tipo: null, descripcion: null, precio_texto: "Consultar",
    cover_image_url: null, imagenes: [], videos: [], estado: "disponible",
    badge: null, promocionado_reel: false, created_at: "2026-01-01T12:00:00Z", deleted_at: null,
    sold_at: null, sale_price: null, sale_notes: null,
    ...parcial,
  };
}

describe("aplicarCambio", () => {
  it("reemplaza en el lugar el vehiculo actualizado", () => {
    const lista = [v("a"), v("b")];
    const r = aplicarCambio(lista, {
      eventType: "UPDATE",
      new: v("a", { estado: "vendido", sold_at: "2026-08-27T15:00:00Z" }),
      old: { id: "a" },
    });
    expect(r).toHaveLength(2);
    expect(r[0].estado).toBe("vendido");
    expect(r[1].id).toBe("b");
  });

  it("no muta la lista original", () => {
    const lista = [v("a")];
    aplicarCambio(lista, { eventType: "UPDATE", new: v("a", { estado: "vendido" }), old: { id: "a" } });
    expect(lista[0].estado).toBe("disponible");
  });

  it("agrega adelante un vehiculo nuevo", () => {
    const r = aplicarCambio([v("a")], { eventType: "INSERT", new: v("b"), old: null });
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("no duplica un INSERT que ya esta en la lista", () => {
    const r = aplicarCambio([v("a")], { eventType: "INSERT", new: v("a"), old: null });
    expect(r).toHaveLength(1);
  });

  it("saca el vehiculo borrado", () => {
    const r = aplicarCambio([v("a"), v("b")], { eventType: "DELETE", new: null, old: { id: "a" } });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("trata el borrado logico como una baja", () => {
    const r = aplicarCambio([v("a"), v("b")], {
      eventType: "UPDATE",
      new: v("a", { deleted_at: "2026-08-27T15:00:00Z" }),
      old: { id: "a" },
    });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("agrega adelante un UPDATE de un vehiculo que no estaba en la lista", () => {
    const r = aplicarCambio([v("a")], { eventType: "UPDATE", new: v("b"), old: { id: "b" } });
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("devuelve la lista igual si el evento no trae datos utilizables", () => {
    const lista = [v("a")];
    expect(aplicarCambio(lista, { eventType: "UPDATE", new: null, old: null })).toBe(lista);
  });
});
