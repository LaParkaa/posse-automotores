import type { Moneda } from "./types";

/** "$ 15.400.000" — sin decimales, separador de miles con punto (es-AR). */
export function formatARS(monto: number): string {
  return `$ ${Math.round(monto).toLocaleString("es-AR")}`;
}

/** "USD 14.500" — sin decimales, separador de miles con punto (es-AR). */
export function formatUSD(monto: number): string {
  return `USD ${Math.round(monto).toLocaleString("es-AR")}`;
}

export function formatMoneda(monto: number, moneda: Moneda): string {
  return moneda === "USD" ? formatUSD(monto) : formatARS(monto);
}

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DECENAS = [
  "diez", "once", "doce", "trece", "catorce", "quince",
  "dieciséis", "diecisiete", "dieciocho", "diecinueve",
];
const VEINTES = [
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
  "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS_MULT = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function dosDigitos(n: number): string {
  if (n === 0) return "";
  if (n < 10) return UNIDADES[n];
  if (n < 20) return DECENAS[n - 10];
  if (n < 30) return VEINTES[n - 20];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS_MULT[d] : `${DECENAS_MULT[d]} y ${UNIDADES[u]}`;
}

function tresDigitos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) partes.push(dosDigitos(resto));
  return partes.join(" ");
}

/** Convierte un entero no negativo a palabras en español, ej. 15400000 -> "quince millones cuatrocientos mil". */
export function numeroALetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return "cero";

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? "un millón" : `${tresDigitos(millones)} millones`);
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${tresDigitos(miles)} mil`);
  if (resto > 0) partes.push(tresDigitos(resto));

  return partes.join(" ").trim();
}

function capitalizar(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** Para recibos: "Quince millones cuatrocientos mil pesos con 00/100". */
export function montoEnLetras(monto: number, moneda: Moneda): string {
  const absoluto = Math.abs(monto);
  const entero = Math.floor(absoluto);
  const centavos = Math.round((absoluto - entero) * 100);
  const unidad = moneda === "USD" ? "dólares" : "pesos";
  return `${capitalizar(numeroALetras(entero))} ${unidad} con ${String(centavos).padStart(2, "0")}/100`;
}
