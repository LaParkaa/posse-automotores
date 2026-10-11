import type { VehiculoCatalogo } from "../types";
import { coincideAprox, normalizar } from "./normalizar";
import {
  ALIAS_MARCA,
  SINONIMOS_COMBUSTIBLE,
  SINONIMOS_TIPO,
  SINONIMOS_TRANSMISION,
  aplicarFrases,
} from "./vocabulario";

export type Entidades = {
  /** Autos del catalogo nombrados por modelo (cualquier estado). */
  vehiculoIds: string[];
  /** Marca tal cual figura en el catalogo, si se nombro una marca (sola, sin modelo). */
  marca: string | null;
  /** Claves de tipo (ver SINONIMOS_TIPO); varias para "camioneta". */
  tipos: string[];
  combustible: string | null;
  transmision: string | null;
  anio: number | null;
  /** 1..9 para "el 2", "la primera"; -1 para "el ultimo". */
  ordinal: number | null;
  /** "ese", "esa", "el mismo": se refiere al auto del que se venia hablando. */
  deictico: boolean;
};

const ANIO_MIN = 1980;
const ANIO_MAX = 2030;
// Un ordinal o un deictico solo tiene sentido en una respuesta corta ("el 2", "esa me interesa"); en una frase
// larga ("tienen la 208 y el 2 de la web") el numero suelto es parte de otra cosa.
const MAX_TOKENS_ORDINAL = 4;
const MAX_TOKENS_DEICTICO = 5;

// Map y no objeto: un token como "constructor" no debe encontrar nada.
const ORDINALES = new Map<string, number>([
  ["primero", 1], ["primera", 1],
  ["segundo", 2], ["segunda", 2],
  ["tercero", 3], ["tercera", 3],
  ["cuarto", 4], ["cuarta", 4],
  ["quinto", 5], ["quinta", 5],
  ["ultimo", -1], ["ultima", -1],
]);

const DEICTICOS = new Set(["ese", "esa", "eso", "mismo", "misma"]);

/** Un vehiculo se nombra por el primer token de su modelo ("Amarok V6 Extreme" → "amarok", "XR 150" → "xr"). */
function primerTokenModelo(v: VehiculoCatalogo): string {
  return normalizar(v.modelo).split(" ")[0] ?? "";
}

/**
 * La marca se compara con su primer token ("Mercedes-Benz" → "mercedes"), que es como la escribe el cliente
 * y como figura en ALIAS_MARCA.
 */
function primerTokenMarca(v: VehiculoCatalogo): string {
  return normalizar(v.marca).split(" ")[0] ?? "";
}

function primeroEnDiccionario(tokens: string[], diccionario: Record<string, string>): string | null {
  for (const token of tokens) {
    // Igualdad exacta (el diccionario no tiene prototipo): con tolerancia "Manuel" seria "manual".
    const valor = diccionario[token];
    if (valor !== undefined) return valor;
  }
  return null;
}

export function extraerEntidades(texto: string, catalogo: VehiculoCatalogo[]): Entidades {
  const tokens = aplicarFrases(normalizar(texto)).split(" ").filter((t) => t !== "");

  // Autos nombrados. Se recuerdan los tokens que sirvieron para nombrarlos: si el modelo es un numero que
  // parece un año ("2008"), ese token no puede contar tambien como año pedido.
  const tokensDeModelo = new Set<string>();
  const vehiculoIds: string[] = [];
  for (const v of catalogo) {
    const modelo = primerTokenModelo(v);
    if (modelo === "") continue;
    // coincideAprox exige igualdad exacta cuando hay digitos, asi que 206 y 208 nunca se confunden.
    const nombrado = tokens.filter((token) => coincideAprox(token, modelo));
    if (nombrado.length === 0) continue;
    vehiculoIds.push(v.id);
    nombrado.forEach((token) => tokensDeModelo.add(token));
  }

  // Marca: solo si no se nombro un auto concreto (con "peugeot 208" interesa el 208, no toda la marca).
  let marca: string | null = null;
  if (vehiculoIds.length === 0) {
    for (const token of tokens) {
      // El alias se resuelve por igualdad exacta; la tolerancia a typos aplica solo al nombre de marca del catalogo.
      const alias = ALIAS_MARCA[token];
      const encontrada = catalogo.find((v) => {
        const nombre = primerTokenMarca(v);
        return nombre !== "" && (token === nombre || alias === nombre || coincideAprox(token, nombre));
      });
      if (encontrada) {
        marca = encontrada.marca;
        break;
      }
    }
  }

  // Tipos: se juntan los de todos los tokens, sin repetir ("camioneta" aporta tres claves).
  const tipos: string[] = [];
  for (const token of tokens) {
    for (const clave of SINONIMOS_TIPO[token] ?? []) {
      if (!tipos.includes(clave)) tipos.push(clave);
    }
  }

  // Año: token completo de 4 digitos. "9.500.000" y "177.000" son un solo token con puntos, y "1999999"
  // tiene mas de 4 digitos, asi que ninguno pasa el patron.
  let anio: number | null = null;
  for (const token of tokens) {
    if (!/^\d{4}$/.test(token) || tokensDeModelo.has(token)) continue;
    const valor = Number(token);
    if (valor >= ANIO_MIN && valor <= ANIO_MAX) {
      anio = valor;
      break;
    }
  }

  // Ordinal: un digito suelto ("el 2") o una palabra ("la primera"). Los numeros de 3+ digitos son modelos (206).
  let ordinal: number | null = null;
  if (tokens.length <= MAX_TOKENS_ORDINAL) {
    for (const token of tokens) {
      const valor = /^[1-9]$/.test(token) ? Number(token) : ORDINALES.get(token);
      if (valor !== undefined) {
        ordinal = valor;
        break;
      }
    }
  }

  const deictico = tokens.length <= MAX_TOKENS_DEICTICO && tokens.some((token) => DEICTICOS.has(token));

  return {
    vehiculoIds,
    marca,
    tipos,
    combustible: primeroEnDiccionario(tokens, SINONIMOS_COMBUSTIBLE),
    transmision: primeroEnDiccionario(tokens, SINONIMOS_TRANSMISION),
    anio,
    ordinal,
    deictico,
  };
}
