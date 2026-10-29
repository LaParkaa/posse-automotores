import { coincideAprox, normalizar } from "./normalizar";

/**
 * "Tengo un chevrolt corsa 2010 para entregar": el cliente ofrece SU auto como parte de pago. No pregunta por un
 * auto del stock, así que no hay que buscarlo en el catálogo. Acá se reconoce esa frase y se saca el modelo y el año
 * para armarle el simulador de financiación con su usado ya cargado.
 */

export type UsadoDelCliente = {
  /** "Chevrolet Corsa"; null si dijo solo "un usado" y no el modelo. */
  modelo: string | null;
  anio: number | null;
};

// Cierres de "tengo X para ...": entregar, dar, cambiar, la entrega, parte de pago, canje.
const CIERRE_TENGO = new Set(["entregar", "entregarlo", "entregarla", "dar", "darlo", "darla", "cambiar", "cambiarlo", "cambiarla", "permutar", "entrega", "canje", "canjear", "parte"]);
// "entrego mi X", "cambiar un X": el verbo tiene que ir seguido de "mi/un/una" para no confundir con "cambio de aceite".
const VERBOS_ENTREGA = new Set(["entregar", "entrego", "entregaria", "cambiar", "cambio", "permutar", "permuto", "permutaria"]);
const POSESIVOS = new Set(["mi", "mis", "mio", "mia", "un", "una"]);
// "tengo 2 millones para entregar" es un anticipo en plata, no un auto.
const PLATA = new Set(["millon", "millones", "mil", "pesos", "peso", "dolares", "dolar", "usd", "plata", "efectivo", "lucas", "luca", "palo", "palos", "anticipo"]);
// Donde termina el nombre del auto cuando viene despues del verbo ("entrego mi gol 2012 por uno mas nuevo").
const CORTES = new Set(["por", "y", "para", "que", "como", "asi", "si", "pero", "porque", "en", "a", "con"]);
const RELLENO = new Set(["un", "una", "mi", "mis", "mio", "mia", "el", "la", "de", "del", "modelo", "ano", "tipo"]);
const GENERICAS = new Set(["usado", "usada", "auto", "autos", "coche", "vehiculo", "camioneta", "moto", "camion", "utilitario", "carro"]);

const MAX_PALABRAS = 6;
const MAX_LARGO = 60;
const ANIO = /^(19[89]\d|20[0-3]\d)$/;

function esPlata(palabras: string[]): boolean {
  return palabras.some((p) => PLATA.has(p) || /^\d+k$/.test(p)) || (palabras.length > 0 && palabras.every((p) => /^[\d.,]+$/.test(p)));
}

/** El nombre del auto que ofrece, como palabras ya normalizadas, o null si la frase no ofrece un auto. */
function palabrasDelUsado(tokens: string[]): string[] | null {
  // "tengo (un|mi) <X> para entregar"
  const iTengo = tokens.indexOf("tengo");
  if (iTengo >= 0) {
    for (let i = iTengo + 1; i < tokens.length - 1; i++) {
      // "para entregar" o "para la entrega".
      const cierre = tokens[i + 1] === "la" || tokens[i + 1] === "el" ? tokens[i + 2] : tokens[i + 1];
      if (tokens[i] === "para" && cierre !== undefined && CIERRE_TENGO.has(cierre)) {
        const x = tokens.slice(iTengo + 1, i);
        return esPlata(x) || x.length === 0 || x.length > MAX_PALABRAS + 2 ? null : x;
      }
    }
  }
  // "entrego mi <X>", "cambiar un <X>"
  for (let i = 0; i < tokens.length - 1; i++) {
    if (VERBOS_ENTREGA.has(tokens[i]) && POSESIVOS.has(tokens[i + 1])) {
      const x: string[] = [];
      for (const p of tokens.slice(i + 2)) {
        if (CORTES.has(p) || x.length >= MAX_PALABRAS) break;
        x.push(p);
      }
      return esPlata(x) ? null : x;
    }
  }
  return null;
}

/** True si el mensaje ofrece un auto propio para entregar (la intención "permuta" lo usa). */
export function ofreceUsado(tokens: string[]): boolean {
  return palabrasDelUsado(tokens) !== null;
}

const aTitulo = (palabra: string) => palabra.charAt(0).toUpperCase() + palabra.slice(1);

/** Corrige una marca mal escrita ("chevrolt" → "Chevrolet") con las marcas del catálogo. */
function marcaCorregida(palabra: string, marcas: string[]): string | null {
  if (palabra.length < 6) return null;
  for (const marca of marcas) {
    const m = normalizar(marca).split(" ")[0];
    if (m && palabra !== m && palabra[0] === m[0] && coincideAprox(palabra, m)) return marca.trim();
  }
  return null;
}

/**
 * Saca el modelo y el año del auto que el cliente ofrece. `marcas` son las marcas del catálogo, solo para corregir
 * errores de tipeo. Devuelve null si el mensaje no ofrece un auto.
 */
export function extraerUsado(texto: string, marcas: string[] = []): UsadoDelCliente | null {
  const normal = normalizar(texto);
  const x = palabrasDelUsado(normal === "" ? [] : normal.split(" "));
  if (x === null) return null;

  const anio = x.map((p) => ANIO.exec(p)?.[0]).find((a) => a !== undefined);
  const nombre = x
    .filter((p) => !RELLENO.has(p) && !ANIO.test(p) && !GENERICAS.has(p))
    .map((p) => marcaCorregida(p, marcas) ?? aTitulo(p))
    .join(" ")
    .slice(0, MAX_LARGO)
    .trim();

  return { modelo: nombre === "" ? null : nombre, anio: anio === undefined ? null : Number(anio) };
}

/** "Chevrolet Corsa 2010" / "Chevrolet Corsa" / null si no dijo el modelo. */
export function descripcionDelUsado(u: UsadoDelCliente): string | null {
  if (!u.modelo) return null;
  return u.anio ? `${u.modelo} ${u.anio}` : u.modelo;
}
