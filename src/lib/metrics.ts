import type { Vehiculo } from "./types";

/** Argentina no aplica horario de verano: el offset es fijo. */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type Rango = "dia" | "semana" | "mes";
export type Bucket = { key: string; label: string; total: number };

export type Kpis = {
  stockActivo: number;
  disponibles: number;
  reservados: number;
  vendidosSemana: number;
  vendidosSemanaPrevia: number;
  deltaSemana: number;
  rotacionDias: number | null;
};

/** El día calendario argentino de un instante, como Date UTC a medianoche. */
export function toArDay(iso: string): Date {
  const local = new Date(new Date(iso).getTime() - AR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** El lunes de la semana argentina que contiene ese instante. */
export function startOfArWeek(iso: string): Date {
  const dia = toArDay(iso);
  const desdeLunes = (dia.getUTCDay() + 6) % 7;
  return new Date(dia.getTime() - desdeLunes * DIA_MS);
}

function claveDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function claveMes(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Vendidos con fecha registrada. Los vendidos históricos sin sold_at quedan fuera. */
function ventasConFecha(vehiculos: Vehiculo[]): Vehiculo[] {
  return vehiculos.filter((v) => v.estado === "vendido" && v.sold_at !== null);
}

export function getKpis(vehiculos: Vehiculo[], ahora: string = new Date().toISOString()): Kpis {
  const disponibles = vehiculos.filter((v) => v.estado === "disponible").length;
  const reservados = vehiculos.filter((v) => v.estado === "reservado").length;

  const ventas = ventasConFecha(vehiculos);
  const semanaActual = startOfArWeek(ahora).getTime();
  const semanaPrevia = semanaActual - 7 * DIA_MS;

  const vendidosSemana = ventas.filter(
    (v) => startOfArWeek(v.sold_at!).getTime() === semanaActual
  ).length;
  const vendidosSemanaPrevia = ventas.filter(
    (v) => startOfArWeek(v.sold_at!).getTime() === semanaPrevia
  ).length;

  const corte = new Date(ahora).getTime() - 90 * DIA_MS;
  const recientes = ventas.filter((v) => new Date(v.sold_at!).getTime() >= corte);
  const rotacionDias = recientes.length
    ? Math.round(
        recientes.reduce(
          (suma, v) =>
            suma + (new Date(v.sold_at!).getTime() - new Date(v.created_at).getTime()) / DIA_MS,
          0
        ) / recientes.length
      )
    : null;

  return {
    stockActivo: disponibles + reservados,
    disponibles,
    reservados,
    vendidosSemana,
    vendidosSemanaPrevia,
    deltaSemana: vendidosSemana - vendidosSemanaPrevia,
    rotacionDias,
  };
}

/** Los buckets del período, del más viejo al más nuevo, incluidos los vacíos. */
function construirBuckets(rango: Rango, ahora: string): Bucket[] {
  if (rango === "dia") {
    const hoy = toArDay(ahora);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(hoy.getTime() - (29 - i) * DIA_MS);
      return { key: claveDia(d), label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, total: 0 };
    });
  }

  if (rango === "semana") {
    const lunes = startOfArWeek(ahora);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(lunes.getTime() - (11 - i) * 7 * DIA_MS);
      return { key: claveDia(d), label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, total: 0 };
    });
  }

  const hoy = toArDay(ahora);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (11 - i), 1));
    return { key: claveMes(d), label: MESES[d.getUTCMonth()], total: 0 };
  });
}

/** La clave de bucket que le corresponde a una venta. */
function claveDeVenta(soldAt: string, rango: Rango): string {
  if (rango === "dia") return claveDia(toArDay(soldAt));
  if (rango === "semana") return claveDia(startOfArWeek(soldAt));
  return claveMes(toArDay(soldAt));
}

export function getSerieVentas(
  vehiculos: Vehiculo[],
  rango: Rango,
  ahora: string = new Date().toISOString()
): Bucket[] {
  const buckets = construirBuckets(rango, ahora);
  const porClave = new Map(buckets.map((b) => [b.key, b]));

  for (const venta of ventasConFecha(vehiculos)) {
    const bucket = porClave.get(claveDeVenta(venta.sold_at!, rango));
    if (bucket) bucket.total += 1;
  }

  return buckets;
}
