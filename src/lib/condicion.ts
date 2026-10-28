import type { Vehiculo } from "@/lib/types";

export type Condicion = "usados" | "0km";

/** Lee el valor de la URL (?condicion=...) y descarta cualquier otra cosa. */
export function condicionDeUrl(valor: string | undefined): Condicion | undefined {
  return valor === "usados" || valor === "0km" ? valor : undefined;
}

/**
 * El kilometraje se carga a mano ("190.000 km", "104.000km", "0km", "0", "Consultá km"). Un auto es 0km solo si
 * trae cifras y todas son cero; "Consultá km" no dice nada, así que cuenta como usado.
 */
export function esCeroKm(v: Pick<Vehiculo, "kilometraje">): boolean {
  const cifras = v.kilometraje.replace(/\D/g, "");
  return cifras !== "" && Number(cifras) === 0;
}

export function cumpleCondicion(v: Pick<Vehiculo, "kilometraje">, condicion: Condicion | undefined): boolean {
  if (condicion === undefined) return true;
  return condicion === "0km" ? esCeroKm(v) : !esCeroKm(v);
}
