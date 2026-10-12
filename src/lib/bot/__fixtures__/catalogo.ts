import type { VehiculoCatalogo } from "../types";

type Parcial = Partial<VehiculoCatalogo> &
  Pick<VehiculoCatalogo, "id" | "slug" | "nombre" | "marca" | "modelo" | "anio" | "created_at">;

function auto(p: Parcial): VehiculoCatalogo {
  return {
    kilometraje: "Consultá km",
    combustible: "Nafta",
    transmision: "Manual",
    motor: null,
    tipo: "Hatchback",
    descripcion: null,
    precio_texto: "Consultá precio",
    cover_image_url: `https://img.example/${p.slug}.jpg`,
    estado: "disponible",
    ...p,
  };
}

/**
 * Catalogo de ejemplo para los tests. Orden de created_at (mas nuevo primero):
 * amarok, 206, 208, vento, kangoo, xr150 (reservada), partner (vendida), corolla.
 */
export const CATALOGO: VehiculoCatalogo[] = [
  auto({
    id: "v-206", slug: "peugeot-206-1-6-2011", nombre: "Peugeot 206 1.6", marca: "Peugeot", modelo: "206 1.6",
    anio: 2011, kilometraje: "177.000 km", motor: "1.6", precio_texto: "$9.500.000", created_at: "2026-10-05T10:00:00Z",
  }),
  auto({
    id: "v-208", slug: "peugeot-208-style-2023", nombre: "Peugeot 208 Style", marca: "Peugeot", modelo: "208 Style",
    anio: 2023, kilometraje: "48.000 km", motor: "1.6", precio_texto: "Consultá precio", created_at: "2026-10-04T10:00:00Z",
  }),
  auto({
    id: "v-vento", slug: "vw-vento-2-5-advance-2015", nombre: "Volkswagen Vento 2.5 Advance", marca: "Volkswagen",
    modelo: "Vento 2.5 Advance", anio: 2015, kilometraje: "130.000 km", transmision: "Automático", tipo: "Sedán",
    motor: "2.5", precio_texto: "USD 14.500", created_at: "2026-10-03T10:00:00Z",
  }),
  auto({
    id: "v-amarok", slug: "vw-amarok-v6-extreme-2025", nombre: "Volkswagen Amarok V6 Extreme", marca: "Volkswagen",
    modelo: "Amarok V6 Extreme", anio: 2025, kilometraje: "0 km", combustible: "Diésel", transmision: "Automático",
    tipo: "Pick-up", precio_texto: "USD 62.000", created_at: "2026-10-06T10:00:00Z",
  }),
  auto({
    id: "v-corolla", slug: "toyota-corolla-xei-2011", nombre: "Toyota Corolla XEI", marca: "Toyota", modelo: "Corolla XEI",
    anio: 2011, kilometraje: "180.000 km", tipo: "Sedán", motor: "1.8", precio_texto: "USD 9.500", created_at: "2026-09-15T10:00:00Z",
  }),
  auto({
    id: "v-partner", slug: "peugeot-partner-2014", nombre: "Peugeot Partner", marca: "Peugeot", modelo: "Partner",
    anio: 2014, kilometraje: "150.000 km", tipo: "Utilitario", estado: "vendido", created_at: "2026-09-20T10:00:00Z",
  }),
  auto({
    id: "v-kangoo", slug: "renault-kangoo-2016", nombre: "Renault Kangoo", marca: "Renault", modelo: "Kangoo",
    anio: 2016, kilometraje: "120.000 km", tipo: "Utilitario", precio_texto: "$11.000.000", created_at: "2026-10-02T10:00:00Z",
  }),
  auto({
    id: "v-xr150", slug: "honda-xr-150-2022", nombre: "Honda XR 150", marca: "Honda", modelo: "XR 150",
    anio: 2022, kilometraje: "12.000 km", tipo: "Moto", estado: "reservado", precio_texto: "$3.200.000", created_at: "2026-10-01T10:00:00Z",
  }),
];
