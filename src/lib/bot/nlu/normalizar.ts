// Marcas temporales para proteger el punto y la coma que van entre digitos (1.6, 177.000, 9,5)
// mientras se limpia el resto de la puntuacion. Un mensaje real podria traerlos crudos (cualquier
// cliente puede mandar un caracter de control crudo), por eso se descartan al empezar, antes de proteger nada.
const PUNTO_PROTEGIDO = "\u0001";
const COMA_PROTEGIDA = "\u0002";

/**
 * Deja el texto en una forma unica para comparar: el cliente escribe "¡Holaaa! ¿Cómo andás?"
 * y las reglas del bot solo tienen que conocer "hola como andas".
 */
export function normalizar(texto: string): string {
  const sinTildes = texto
    // Si quedaran, se confundirian con los separadores protegidos y saldria un "." o "," de la nada.
    .replace(/[\u0001\u0002]/g, " ")
    .normalize("NFD")
    // Despues de NFD la "ñ" es "n" + tilde combinante: borrar la tilde la deja en "n" (como se tipea en el celu).
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // El signo de pesos solo estorba: "$9.500.000" y "9.500.000" son lo mismo.
    .replace(/\$/g, "");

  const limpio = sinTildes
    // Se protegen solo los separadores rodeados de digitos; un punto de fin de frase ("hola.") no.
    // (El lookahead evita consumir el digito siguiente, asi "9.500.000" se protege completo.)
    .replace(/(\d)([.,])(?=\d)/g, (_, digito: string, signo: string) =>
      digito + (signo === "." ? PUNTO_PROTEGIDO : COMA_PROTEGIDA),
    )
    // Signos y emojis pasan a espacio (no se borran) para que "pick-up" quede "pick up".
    .replace(/[^\p{L}\p{N}\s\u0001\u0002]/gu, " ")
    .replaceAll(PUNTO_PROTEGIDO, ".")
    .replaceAll(COMA_PROTEGIDA, ",")
    // "holaaaa" → "hola"; se deja pasar una repeticion doble ("sii", "cooper") porque puede ser parte de la palabra.
    .replace(/(\p{L})\1{2,}/gu, "$1");

  return limpio.replace(/\s+/g, " ").trim();
}

export function tokenizar(texto: string): string[] {
  const normalizado = normalizar(texto);
  return normalizado === "" ? [] : normalizado.split(" ");
}

/**
 * True si el mensaje es solo emojis (un "👍" o un "❤️"): sin letras ni numeros, pero con algun emoji.
 * Las banderas ("🇦🇷") son indicadores regionales, no pictogramas, por eso se cuentan aparte.
 */
export function esSoloEmojis(texto: string): boolean {
  return !/[\p{L}\p{N}]/u.test(texto) && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(texto);
}

/** Distancia de Levenshtein (ediciones de a un caracter), con dos filas para no gastar memoria de mas. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + costo);
    }
    anterior = actual;
  }
  return anterior[b.length];
}

/**
 * Coincidencia tolerante a errores de tipeo. El primer argumento es lo que escribio el cliente y el segundo
 * la palabra del diccionario o del catalogo: la tolerancia se mide por esta ultima, porque si dependiera de
 * la mas larga "motor" (5) pasaria por "moto". En las palabras cortas un error ya es otra palabra
 * ("hola"/"ola") y en los numeros 206 y 208 son autos distintos.
 */
export function coincideAprox(token: string, objetivo: string): boolean {
  if (token === objetivo) return true;
  if (/\d/.test(token) || /\d/.test(objetivo)) return false;

  const largo = objetivo.length;
  if (largo <= 4) return false;
  const tolerancia = largo <= 7 ? 1 : 2;
  // Con otro largo la distancia ya supera la tolerancia: se evita calcularla.
  if (Math.abs(token.length - largo) > tolerancia) return false;
  return distancia(token, objetivo) <= tolerancia;
}
