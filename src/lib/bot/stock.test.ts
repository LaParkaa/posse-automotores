import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatearStock,
  obtenerStockTexto,
  STOCK_NO_DISPONIBLE,
  type VehiculoStock,
} from "./stock";

const corolla: VehiculoStock = {
  slug: "toyota-corolla-xei-2011",
  nombre: "Toyota Corolla XEI",
  anio: 2011,
  kilometraje: "180.000 km",
  combustible: "Nafta",
  transmision: "Manual",
  motor: "1.8",
  tipo: "Sedán",
  precio_texto: "USD 9.500",
};

describe("formatearStock", () => {
  it("arma una linea por vehiculo con los datos en orden fijo y el link a la ficha", () => {
    expect(formatearStock([corolla], "https://posse.example")).toBe(
      "- Toyota Corolla XEI | 2011 | 180.000 km | Nafta | Manual | 1.8 | Sedán | USD 9.500 | https://posse.example/vehiculos/toyota-corolla-xei-2011",
    );
  });

  it("reemplaza motor y tipo nulos por un guion para no correr las columnas", () => {
    const linea = formatearStock([{ ...corolla, motor: null, tipo: null }], "https://posse.example");

    expect(linea).toContain("| Manual | - | - | USD 9.500 |");
  });

  it("no duplica la barra final de la URL del sitio", () => {
    expect(formatearStock([corolla], "https://posse.example/")).toContain(
      "https://posse.example/vehiculos/toyota-corolla-xei-2011",
    );
  });

  it("omite el link si no hay URL del sitio configurada", () => {
    expect(formatearStock([corolla], "")).toBe(
      "- Toyota Corolla XEI | 2011 | 180.000 km | Nafta | Manual | 1.8 | Sedán | USD 9.500",
    );
  });

  it("separa varios vehiculos con saltos de linea", () => {
    const lineas = formatearStock([corolla, { ...corolla, slug: "otro", nombre: "Otro" }], "").split("\n");

    expect(lineas).toHaveLength(2);
  });

  it("avisa cuando no hay vehiculos disponibles", () => {
    expect(formatearStock([], "https://posse.example")).toBe(
      "No hay vehículos disponibles en este momento.",
    );
  });
});

describe("obtenerStockTexto", () => {
  afterEach(() => vi.restoreAllMocks());

  it("consulta solo vehiculos_posse disponibles y no borrados", async () => {
    const filtros: Array<[string, unknown]> = [];
    let tabla = "";
    let columnas = "";
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: (arg) => {
        columnas = String(arg);
        return consulta;
      },
      eq: (columna, valor) => {
        filtros.push([columna as string, valor]);
        return consulta;
      },
      is: (columna, valor) => {
        filtros.push([columna as string, valor]);
        return consulta;
      },
      order: () => consulta,
      limit: async () => ({ data: [corolla], error: null }),
    };
    const db = {
      from: (nombre: string) => {
        tabla = nombre;
        return consulta;
      },
    } as unknown as SupabaseClient;

    const texto = await obtenerStockTexto(db, "");

    expect(tabla).toBe("vehiculos_posse");
    expect(filtros).toContainEqual(["estado", "disponible"]);
    expect(filtros).toContainEqual(["deleted_at", null]);
    expect(columnas).toContain("slug");
    expect(columnas).toContain("precio_texto");
    // Los datos privados de la venta nunca pueden llegar al prompt.
    expect(columnas).not.toContain("sale_price");
    expect(columnas).not.toContain("sale_notes");
    expect(columnas).not.toContain("sold_at");
    expect(texto).toContain("Toyota Corolla XEI");
  });

  it("devuelve STOCK_NO_DISPONIBLE si Supabase responde con error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: () => consulta,
      is: () => consulta,
      order: () => consulta,
      limit: async () => ({ data: null, error: { message: "boom" } }),
    };
    const db = { from: () => consulta } as unknown as SupabaseClient;

    expect(await obtenerStockTexto(db, "")).toBe(STOCK_NO_DISPONIBLE);
  });

  it("devuelve STOCK_NO_DISPONIBLE si la consulta lanza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      from: () => {
        throw new Error("sin conexion");
      },
    } as unknown as SupabaseClient;

    expect(await obtenerStockTexto(db, "")).toBe(STOCK_NO_DISPONIBLE);
  });
});
