import { tokenizar } from "./normalizar";

/**
 * Numeros y tiempos como los escribe la gente ("28", "veintiocho", "cinco años", "seis meses", "año y medio").
 * Sirve para la edad y los años de experiencia de la postulacion: "tengo 5 años de experiencia" no es una edad.
 * Todo trabaja sobre palabras ya normalizadas (minusculas y sin tildes), que es lo que devuelve `tokenizar`.
 */

// Mapas y no objetos: un token como "constructor" o "toString" no puede encontrar nada.
const UNIDADES = new Map<string, number>(
  Object.entries({
    un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
    veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  }),
);
const DECENAS = new Map<string, number>(
  Object.entries({ treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70 }),
);
// Tras normalizar, "año" es "ano" y "años" es "anos".
const TIEMPO = new Map<string, { singular: string; plural: string }>([
  ["ano", { singular: "año", plural: "años" }],
  ["anos", { singular: "año", plural: "años" }],
  ["mes", { singular: "mes", plural: "meses" }],
  ["meses", { singular: "mes", plural: "meses" }],
]);

export const EDAD_MINIMA = 16;
export const EDAD_MAXIMA = 75;

// Despues de "tengo 28 años" estas palabras dicen que los años eran de experiencia y no de edad.
const SIGUE_UNA_EXPERIENCIA = new Set(["ventas", "venta", "el", "la", "una", "agencia", "agencias", "concesionaria", "concesionarias", "autos", "rubro", "gestoria", "atencion"]);
const NEGATIVAS = /^ (no|nada|ninguna|ninguno|ningun|nunca) /;

/**
 * El numero que empieza en `tokens[i]`: digitos ("28") o palabras ("veintiocho", "treinta y cinco").
 * `largo` es cuantas palabras ocupa. Los numeros de mas de 3 cifras ("1990") no cuentan: son años, no cantidades.
 */
export function numeroEn(tokens: string[], i: number): { valor: number; largo: number } | null {
  const token = tokens[i];
  if (token === undefined) return null;
  if (/^\d{1,3}$/.test(token)) return { valor: Number(token), largo: 1 };

  const decena = DECENAS.get(token);
  if (decena !== undefined) {
    const unidad = tokens[i + 1] === "y" ? UNIDADES.get(tokens[i + 2] ?? "") : undefined;
    return unidad !== undefined && unidad <= 9 ? { valor: decena + unidad, largo: 3 } : { valor: decena, largo: 1 };
  }
  const unidad = UNIDADES.get(token);
  return unidad === undefined ? null : { valor: unidad, largo: 1 };
}

/**
 * Cuanto tiempo de experiencia dijo, listo para mostrar: "5 años", "6 meses", "1 año y medio", "medio año",
 * "2 años y 3 meses". null si no dijo cuanto.
 */
export function duracionDe(texto: string): string | null {
  const tokens = tokenizar(texto);
  const encontradas: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const unidad = TIEMPO.get(tokens[i]);
    if (unidad === undefined) continue;

    if (tokens[i - 1] === "medio" || tokens[i - 1] === "media") {
      encontradas.push(`medio ${unidad.singular}`);
      continue;
    }
    // El numero va justo antes de la unidad: una palabra ("5", "cinco") o tres ("treinta y cinco").
    let cantidad: number | null = null;
    for (const largo of [3, 1]) {
      const numero = numeroEn(tokens, i - largo);
      if (numero && numero.largo === largo) {
        cantidad = numero.valor;
        break;
      }
    }
    const yMedio = tokens[i + 1] === "y" && (tokens[i + 2] === "medio" || tokens[i + 2] === "media") ? " y medio" : "";
    // "año y medio", sin numero adelante, es un año y medio.
    if (cantidad === null && yMedio !== "") cantidad = 1;
    if (cantidad === null) continue;
    encontradas.push(`${cantidad} ${cantidad === 1 ? unidad.singular : unidad.plural}${yMedio}`);
  }

  return encontradas.length > 0 ? encontradas.slice(0, 2).join(" y ") : null;
}

/** "no", "ninguna", "sin experiencia", "es mi primer trabajo": contesta que no tiene experiencia. */
export function sinExperiencia(texto: string): boolean {
  const dicho = ` ${tokenizar(texto).join(" ")} `;
  return (
    NEGATIVAS.test(dicho) ||
    dicho.includes(" sin experiencia ") ||
    dicho.includes(" primer trabajo ") ||
    dicho.includes(" primera experiencia ")
  );
}

/**
 * Edad de 16 a 75. Con `directa` (se pregunto la edad) vale el primer numero en rango de cualquier frase
 * ("28", "tengo 28", "veintiocho", "28 años"). Sin ella solo "tengo N años", y no si los años son de
 * experiencia ("tengo 5 años de experiencia", "tengo 20 años en ventas").
 */
export function edadDe(texto: string, directa: boolean): number | null {
  const tokens = tokenizar(texto);
  const enRango = (valor: number) => valor >= EDAD_MINIMA && valor <= EDAD_MAXIMA;

  if (directa) {
    for (let i = 0; i < tokens.length; i++) {
      const numero = numeroEn(tokens, i);
      if (numero && enRango(numero.valor)) return numero.valor;
    }
    return null;
  }

  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i] !== "tengo") continue;
    const numero = numeroEn(tokens, i + 1);
    if (!numero || !enRango(numero.valor)) continue;
    const despues = i + 1 + numero.largo;
    if (tokens[despues] !== "anos") continue;
    // "tengo 28 años de edad" es una edad; "de experiencia" o "en ventas" no.
    if (tokens[despues + 1] === "de" && tokens[despues + 2] !== "edad") continue;
    if (tokens[despues + 1] === "en" && SIGUE_UNA_EXPERIENCIA.has(tokens[despues + 2] ?? "")) continue;
    return numero.valor;
  }
  return null;
}
