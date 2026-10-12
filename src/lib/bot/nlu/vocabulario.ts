import { normalizar } from "./normalizar";

/** Clave comparable de un tipo de vehiculo del stock: "Pick-up" → "pickup", "Sedán" → "sedan". */
export function claveTipo(tipo: string): string {
  return normalizar(tipo).replace(/\s+/g, "");
}

// Expresiones que el cliente escribe en varias palabras y las reglas tienen que ver como una sola.
const FRASES: Array<[RegExp, string]> = [
  [/\bpick up\b/g, "pickup"],
  [/\bgas oil\b/g, "gasoil"],
  // "0 km", "okm", "cero kms" y "cero kilometros" son todos "0km". El lookbehind evita tocar un
  // kilometraje que termina en 0 ("10 km", "1.0 km"): solo vale un 0 que no sigue a un digito ni a un separador.
  [/(?<![\d.,])(?:0\s*|cero\s+)(?:km|kms|kilometros?)\b/g, "0km"],
  [/\bokm\b/g, "0km"],
];

/** Recibe texto ya normalizado y junta las expresiones de varias palabras en una sola. */
export function aplicarFrases(textoNormalizado: string): string {
  return FRASES.reduce((texto, [patron, reemplazo]) => texto.replace(patron, reemplazo), textoNormalizado);
}

// Todas las claves estan ya normalizadas (minusculas, sin tildes) y los valores son claves de `claveTipo`.
// "auto" y "autos" NO estan a proposito: no restringen el tipo, el cliente busca "un auto" en general.
function porTipo(clave: string, palabras: string[]): Record<string, string[]> {
  return Object.fromEntries(palabras.map((palabra) => [palabra, [clave]]));
}

// Los diccionarios no tienen prototipo: un token como "constructor" o "toString" no debe encontrar nada.
function sinPrototipo<T>(entradas: Record<string, T>): Record<string, T> {
  return Object.assign(Object.create(null) as Record<string, T>, entradas);
}

export const SINONIMOS_TIPO: Record<string, string[]> = sinPrototipo({
  ...porTipo("hatchback", ["hatch", "hatchback", "hatchbacks"]),
  ...porTipo("sedan", ["sedan", "sedanes"]),
  ...porTipo("suv", ["suv", "suvs", "todoterreno", "4x4"]),
  ...porTipo("pickup", [
    "pickup",
    "pickups",
    "hilux",
    "ranger",
    "s10",
    "frontier",
    "alaskan",
    "amarok",
    "toro",
    "saveiro",
  ]),
  // "camioneta" en la calle es cualquiera de las tres: se muestran todas.
  camioneta: ["pickup", "camioneta", "suv"],
  camionetas: ["pickup", "camioneta", "suv"],
  ...porTipo("utilitario", [
    "utilitario",
    "utilitarios",
    "furgon",
    "furgones",
    "furgoneta",
    "chatita",
    "chatitas",
    "chato",
    "kangoo",
    "partner",
    "berlingo",
    "trafic",
    "master",
    "ducato",
    "fiorino",
    "combi",
  ]),
  ...porTipo("moto", ["moto", "motos", "motocicleta", "motito", "scooter"]),
});

export const SINONIMOS_COMBUSTIBLE: Record<string, string> = sinPrototipo({
  nafta: "nafta",
  naftero: "nafta",
  naftera: "nafta",
  gasoil: "diesel",
  gasoleo: "diesel",
  diesel: "diesel",
  diesell: "diesel",
  gnc: "gnc",
  hibrido: "hibrido",
  hibrida: "hibrido",
  electrico: "electrico",
  electrica: "electrico",
});

export const SINONIMOS_TRANSMISION: Record<string, string> = sinPrototipo({
  automatico: "automatico",
  automatica: "automatico",
  automaticos: "automatico",
  automaticas: "automatico",
  at: "automatico",
  aut: "automatico",
  manual: "manual",
  manuales: "manual",
  mecanico: "manual",
  mecanica: "manual",
  mt: "manual",
});

export const ALIAS_MARCA: Record<string, string> = sinPrototipo({
  vw: "volkswagen",
  chevy: "chevrolet",
  merce: "mercedes",
  mercedes: "mercedes",
  benz: "mercedes",
  fiat: "fiat",
  ford: "ford",
  renault: "renault",
  peugeot: "peugeot",
  toyota: "toyota",
  honda: "honda",
  citroen: "citroen",
  nissan: "nissan",
  volkswagen: "volkswagen",
  chevrolet: "chevrolet",
});
