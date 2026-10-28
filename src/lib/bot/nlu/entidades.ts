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

// La tolerancia a typos solo rige para palabras largas que empiezan igual que el modelo/marca: con menos, una
// palabra comun del castellano rioplatense queda a una edicion de un nombre ("venta" → Vento, "onda" → Honda).
const MIN_LETRAS_MODELO_APROX = 5;
const MIN_LETRAS_MARCA_APROX = 6;

// Palabras comunes que estan a una o dos ediciones de un modelo y nunca deben nombrarlo por tolerancia
// ("esta en venta?" no es el Vento). Igualdad exacta sigue valiendo: si existiera un modelo "Rango", "rango" lo nombra.
const NO_APROXIMAR_A_MODELO = new Set([
  "venta", "ventas", "vendo", "vendes", "vender", "vendi", "viento", "vientos",
  "cosa", "cosas", "casa", "casas", "foco", "focos", "siesta", "fiestas", "patio", "rango", "danger",
]);

// Palabras tan comunes que, solas, no nombran un auto: "uno" aparece en "tenes uno de nafta?".
const MODELOS_QUE_PIDEN_MARCA = new Set(["uno"]);

// Cifras que, pegadas a un numero de 4 digitos, lo vuelven km o precio y no un año ("2000 km", "usd 2000").
// "u$s" queda como "us" porque normalizar() borra el "$".
const SIGUE_A_UN_NUMERO_QUE_NO_ES_ANIO = new Set(["km", "kms", "kilometros", "kilometro", "pesos", "dolares", "usd", "mil"]);
const ANTECEDE_A_UN_NUMERO_QUE_NO_ES_ANIO = new Set(["mil", "usd", "u$s", "us"]);

// Cilindrada ("1.4", "2.0"): la cargan al principio del modelo y no nombra al auto ("Tiguan 1.4" no es el Vento 1.4).
const ES_CILINDRADA = /^\d[.,]\d$/;
// "golcito", "golito": el modelo con un diminutivo pegado.
const DIMINUTIVOS = ["cito", "cita", "ito", "ita"];
const MIN_LETRAS_DIMINUTIVO = 3;

/**
 * Un vehiculo se nombra por el primer token de su modelo ("Amarok V6 Extreme" → "amarok", "XR 150" → "xr").
 * Si el modelo arranca con la cilindrada ("1.8 LTZ"), el nombre sale de la primera palabra del titulo que no
 * es la marca ("Chevrolet Tracker 1.8 LTZ" → "tracker").
 */
function primerTokenModelo(v: VehiculoCatalogo): string {
  const modelo = normalizar(v.modelo).split(" ")[0] ?? "";
  if (!ES_CILINDRADA.test(modelo)) return modelo;
  const marca = primerTokenMarca(v);
  const palabra = normalizar(v.nombre)
    .split(" ")
    .find((token) => /^\p{L}{3,}$/u.test(token) && token !== marca && ALIAS_MARCA[token] !== marca);
  return palabra ?? modelo;
}

/**
 * La marca se compara con su primer token ("Mercedes-Benz" → "mercedes"), que es como la escribe el cliente
 * y como figura en ALIAS_MARCA.
 */
function primerTokenMarca(v: VehiculoCatalogo): string {
  return normalizar(v.marca).split(" ")[0] ?? "";
}

/** Segundo token del modelo ("A 200" → "200", "T-Cross" → "cross"), o null si el modelo es de un solo token. */
function segundoTokenModelo(v: VehiculoCatalogo): string | null {
  return normalizar(v.modelo).split(" ")[1] ?? null;
}

/** Tolerancia a typos para el nombre de un modelo o marca: solo palabras largas, con la misma inicial. */
function aproximaNombre(token: string, nombre: string, minLetras: number): boolean {
  return token.length >= minLetras && token[0] === nombre[0] && coincideAprox(token, nombre);
}

/**
 * Posiciones de los tokens del texto que nombran el modelo del vehiculo. Un modelo de una letra ("A 200",
 * "T-Cross") solo cuenta junto a su segundo token, porque la letra suelta es una palabra cualquiera ("a cuanto esta?").
 */
function posicionesQueNombran(v: VehiculoCatalogo, modelo: string, tokens: string[]): number[] {
  const posiciones: number[] = [];
  const segundo = segundoTokenModelo(v);

  tokens.forEach((token, i) => {
    if (modelo.length === 1) {
      if (token === modelo && segundo !== null && tokens[i + 1] === segundo) posiciones.push(i, i + 1);
      return;
    }
    // coincideAprox exige igualdad exacta cuando hay digitos, asi que 206 y 208 nunca se confunden.
    const coincide =
      token === modelo ||
      esDiminutivo(token, modelo) ||
      (!NO_APROXIMAR_A_MODELO.has(token) && aproximaNombre(token, modelo, MIN_LETRAS_MODELO_APROX));
    if (coincide) posiciones.push(i);
  });

  // "uno" solo se nombra si tambien aparece la marca ("fiat uno"), sea escrita o como alias.
  if (posiciones.length > 0 && MODELOS_QUE_PIDEN_MARCA.has(modelo)) {
    const marca = primerTokenMarca(v);
    if (!tokens.some((token) => token === marca || ALIAS_MARCA[token] === marca)) return [];
  }
  return posiciones;
}

function esDiminutivo(token: string, modelo: string): boolean {
  return modelo.length >= MIN_LETRAS_DIMINUTIVO && /^\p{L}+$/u.test(modelo) && DIMINUTIVOS.some((sufijo) => token === modelo + sufijo);
}

function primeroEnDiccionario(tokens: string[], diccionario: Record<string, string>): string | null {
  for (const token of tokens) {
    // Igualdad exacta (el diccionario no tiene prototipo): con tolerancia "Manuel" seria "manual".
    const valor = diccionario[token];
    if (valor !== undefined) return valor;
  }
  return null;
}

/**
 * "el gol power" con un Gol disponible y otro vendido, o "vento 2014" entre tres Ventos: de los autos del mismo
 * modelo se queda el del año pedido y, si sigue habiendo varios, el unico disponible. Modelos distintos no se
 * tocan ("la 206 o la 208" son dos pedidos).
 */
function distinguirMismoModelo(ids: string[], catalogo: VehiculoCatalogo[], anio: number | null): string[] {
  const porId = new Map(catalogo.map((v) => [v.id, v]));
  const familias = new Map<string, VehiculoCatalogo[]>();
  for (const id of ids) {
    const v = porId.get(id);
    if (v) familias.set(primerTokenModelo(v), [...(familias.get(primerTokenModelo(v)) ?? []), v]);
  }
  const elegidos = new Set<string>();
  for (const autos of familias.values()) {
    let grupo = autos;
    if (grupo.length > 1 && anio !== null && grupo.some((v) => v.anio === anio)) grupo = grupo.filter((v) => v.anio === anio);
    if (grupo.length > 1) {
      const enVenta = grupo.filter((v) => v.estado === "disponible");
      if (enVenta.length === 1) grupo = enVenta;
    }
    grupo.forEach((v) => elegidos.add(v.id));
  }
  return ids.filter((id) => elegidos.has(id));
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
    const posiciones = posicionesQueNombran(v, modelo, tokens);
    if (posiciones.length === 0) continue;
    vehiculoIds.push(v.id);
    posiciones.forEach((i) => tokensDeModelo.add(tokens[i]));
  }

  // Marca: solo si no se nombro un auto concreto (con "peugeot 208" interesa el 208, no toda la marca).
  let marca: string | null = null;
  if (vehiculoIds.length === 0) {
    for (const token of tokens) {
      // El alias se resuelve por igualdad exacta; la tolerancia a typos aplica solo al nombre de marca del catalogo.
      const alias = ALIAS_MARCA[token];
      const encontrada = catalogo.find((v) => {
        const nombre = primerTokenMarca(v);
        return nombre !== "" && (token === nombre || alias === nombre || aproximaNombre(token, nombre, MIN_LETRAS_MARCA_APROX));
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
  for (const [i, token] of tokens.entries()) {
    if (!/^\d{4}$/.test(token) || tokensDeModelo.has(token)) continue;
    // "2000 km", "2000 dolares", "mil 2000", "usd 2000": es kilometraje o precio, no un año.
    if (SIGUE_A_UN_NUMERO_QUE_NO_ES_ANIO.has(tokens[i + 1] ?? "") || ANTECEDE_A_UN_NUMERO_QUE_NO_ES_ANIO.has(tokens[i - 1] ?? "")) continue;
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
    vehiculoIds: distinguirMismoModelo(vehiculoIds, catalogo, anio),
    marca,
    tipos,
    combustible: primeroEnDiccionario(tokens, SINONIMOS_COMBUSTIBLE),
    transmision: primeroEnDiccionario(tokens, SINONIMOS_TRANSMISION),
    anio,
    ordinal,
    deictico,
  };
}
