import type { SupabaseClient } from "@supabase/supabase-js";

export type VehiculoStock = {
  slug: string;
  nombre: string;
  anio: number;
  kilometraje: string;
  combustible: string;
  transmision: string;
  motor: string | null;
  tipo: string | null;
  precio_texto: string;
};

/** Texto que reemplaza al inventario cuando no se pudo consultar: el bot no debe inventar autos. */
export const STOCK_NO_DISPONIBLE =
  "NO SE PUDO CONSULTAR EL INVENTARIO. No menciones ni confirmes vehículos concretos: decí que en este momento no podés confirmar la disponibilidad y ofrecé el WhatsApp del local.";

// Tope para que el prompt no crezca sin control: cada vehiculo ocupa ~50 tokens.
const LIMITE_STOCK = 40;

const COLUMNAS = "slug, nombre, anio, kilometraje, combustible, transmision, motor, tipo, precio_texto";

/**
 * Una linea por vehiculo con las columnas siempre en el mismo orden (los nulos van
 * como "-"), asi el modelo no confunde un motor con un tipo. Es mucho mas barato en
 * tokens que mandar JSON.
 */
export function formatearStock(vehiculos: VehiculoStock[], siteUrl: string): string {
  if (vehiculos.length === 0) return "No hay vehículos disponibles en este momento.";

  const base = siteUrl.replace(/\/+$/, "");

  return vehiculos
    .map((v) => {
      const datos = [
        v.nombre,
        String(v.anio),
        v.kilometraje,
        v.combustible,
        v.transmision,
        v.motor ?? "-",
        v.tipo ?? "-",
        v.precio_texto,
      ];
      if (base) datos.push(`${base}/vehiculos/${v.slug}`);
      return `- ${datos.join(" | ")}`;
    })
    .join("\n");
}

/**
 * Lee los vehiculos disponibles y los deja listos para el prompt.
 * No usa getVehiculosDisponibles() de data.ts a proposito: aquel cae a datos de
 * muestra locales ante un error, y el bot terminaria ofreciendo autos que no existen.
 */
export async function obtenerStockTexto(db: SupabaseClient, siteUrl: string): Promise<string> {
  try {
    const { data, error } = await db
      .from("vehiculos_posse")
      .select(COLUMNAS)
      .eq("estado", "disponible")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIMITE_STOCK);

    if (error) throw new Error(error.message);
    return formatearStock((data ?? []) as VehiculoStock[], siteUrl);
  } catch (err) {
    console.error("[bot] No se pudo leer el stock:", err);
    return STOCK_NO_DISPONIBLE;
  }
}
