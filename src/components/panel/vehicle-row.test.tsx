import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Vehiculo } from "@/lib/types";
import { VehicleRow } from "./vehicle-row";

function auto(over: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: "3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab",
    slug: "fiat-cronos-2022",
    nombre: "Fiat Cronos 2022",
    marca: "Fiat",
    modelo: "Cronos",
    anio: 2022,
    kilometraje: "40.000 km",
    combustible: "Nafta",
    transmision: "Manual",
    motor: "1.3",
    tipo: "Sedán",
    descripcion: null,
    precio_texto: "USD 14.000",
    cover_image_url: null,
    imagenes: [],
    videos: [],
    estado: "disponible",
    badge: null,
    promocionado_reel: false,
    created_at: "2026-10-03T10:00:00Z",
    deleted_at: null,
    sold_at: null,
    sale_price: null,
    sale_notes: null,
    key_image_url: null,
    patente: null,
    ...over,
  };
}

const base = { onEstado: () => {}, pendiente: false };

describe("VehicleRow: botón Publicar aviso", () => {
  it("aparece en un auto disponible o reservado", () => {
    for (const estado of ["disponible", "reservado"] as const) {
      const html = renderToStaticMarkup(<VehicleRow vehiculo={auto({ estado })} onPublicar={() => {}} {...base} />);
      expect(html).toContain("Publicar aviso");
    }
  });

  it("no aparece en un auto vendido", () => {
    const html = renderToStaticMarkup(<VehicleRow vehiculo={auto({ estado: "vendido" })} onPublicar={() => {}} {...base} />);
    expect(html).not.toContain("Publicar aviso");
  });

  it("no aparece si la pantalla no lo conecta", () => {
    const html = renderToStaticMarkup(<VehicleRow vehiculo={auto()} {...base} />);
    expect(html).not.toContain("Publicar aviso");
  });
});
