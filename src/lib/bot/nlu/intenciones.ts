import { coincideAprox, esSoloEmojis, normalizar } from "./normalizar";
import { aplicarFrases } from "./vocabulario";

// El orden del tipo es la prioridad: "empleo" y "humano" ganan sobre todo (pedir trabajo manda sobre pedir
// "un vendedor") y "ver_mas" va antes que "catalogo" para que "mostrame mas" no se lea como un pedido de catalogo.
export type Intencion =
  | "empleo"
  | "humano"
  | "identidad"
  | "avisame"
  | "negacion"
  | "precio"
  | "financiacion"
  | "permuta"
  | "pagos"
  | "horarios"
  | "ubicacion"
  | "garantia"
  | "documentacion"
  | "disponibilidad"
  | "info"
  | "ver_mas"
  | "catalogo"
  | "afirmacion"
  | "gracias"
  | "despedida"
  | "cortesia"
  | "saludo"
  | "desconocida";

interface Contexto {
  /** Palabras del mensaje ya normalizado y con las expresiones de varias palabras juntas. */
  tokens: string[];
  /** Mensaje tal cual lo escribio el cliente, para detectar emojis (la normalizacion los borra). */
  original: string;
  /** True si el mensaje ya trae una intencion de contenido (precio, ubicacion, etc.): ahi un "no" inicial no es una negativa. */
  hayContenido: boolean;
}

interface Regla {
  intencion: Exclude<Intencion, "desconocida">;
  /** Frases de varias palabras: se buscan completas y por igualdad exacta, nunca aproximadas. */
  frases?: string[];
  /** Palabras sueltas. Las de 6+ letras admiten un error de tipeo ("financiasion"). */
  palabras?: string[];
  /** Palabras sueltas que NO admiten error de tipeo: la aproximacion las confundiria con otra palabra. */
  exactas?: string[];
  /** Condiciones que no se expresan como lista (largo del mensaje, primer token, emojis). */
  extra?: (contexto: Contexto) => boolean;
}

// Con menos letras un error de tipeo ya es otra palabra ("Manuel" ≈ "manual"), y coincideAprox
// es muy permisivo con las de 5 letras: la aproximacion se reserva para las de 6 o mas.
const LARGO_MINIMO_APROX = 6;

const NEGACION_PRIMER_TOKEN = new Set(["no", "nop", "nah", "nada"]);
const NEGACION_MAX_TOKENS = 5;

// Intenciones que son una pregunta o pedido concreto. Si alguna aparece, "no tienen financiacion?" es
// una pregunta con un "no" delante y no un rechazo: la negacion por primer token no corre.
const INTENCIONES_CONTENIDO = new Set<Intencion>([
  "empleo",
  "precio",
  "financiacion",
  "permuta",
  "pagos",
  "horarios",
  "ubicacion",
  "garantia",
  "documentacion",
  "disponibilidad",
  "info",
  "ver_mas",
  "catalogo",
  "avisame",
  "humano",
  "identidad",
]);

// "mis datos", "tu numero": con un posesivo delante, "datos" es lo que el cliente ofrece y no lo que pide.
const POSESIVOS = new Set(["mis", "tus", "sus", "mi", "tu"]);

// Marcas de que "dueno" habla del historial del vehiculo ("es primer dueno?", "tuvo un solo dueno?")
// y no de querer hablar con el dueno de la agencia.
const DUENO_HISTORIAL = new Set(["primer", "segundo", "anterior", "unico", "solo", "tuvo", "tiene"]);
const DUENO_MAX_TOKENS = 4;

/** "dueno" en un mensaje cortito y sin marcas de historial: "el dueno?" pide hablar con el dueno. */
function pideAlDueno(tokens: string[]): boolean {
  return (
    tokens.length <= DUENO_MAX_TOKENS &&
    (tokens.includes("dueno") || tokens.includes("duenio")) &&
    !tokens.some((token) => DUENO_HISTORIAL.has(token))
  );
}

/** "numero" pide un contacto ("me pasas un numero?"), pero "numero de patente/motor/chasis" es un dato del auto. */
function pideNumero(tokens: string[]): boolean {
  return tokens.some((token, i) => token === "numero" && tokens[i + 1] !== "de");
}
const AFIRMACION_PRIMER_TOKEN = new Set([
  "si",
  "sii",
  "siii",
  "sisi",
  "dale",
  "ok",
  "oka",
  "okey",
  "claro",
  "bueno",
  "perfecto",
  "obvio",
  "mandale",
  "quiero",
]);
// "de una" y "me interesa" son dos palabras: se comparan contra el comienzo del mensaje.
const AFIRMACION_PREFIJOS = ["de una", "me interesa"];
// Con 5 tokens ya es una frase con otro contenido ("si tienen financiacion me interesa").
const AFIRMACION_MAX_TOKENS = 4;
const EMOJIS_AFIRMACION = new Set(["👍", "👌", "🙌", "✅", "🙏", "💪"]);
// Selector de variante (\uFE0F), union de secuencias (\u200D) y tonos de piel: acompanan al emoji pero no lo cambian.
// Van como escapes y no literales porque son invisibles y eslint los marcaria como caracteres enganosos.
const ADORNOS_EMOJI = /[\uFE0F\u200D\s\u{1F3FB}-\u{1F3FF}]/gu;

/** True si el mensaje es solo emojis de afirmacion ("👍", "👍🏽", "👌👌"). */
function esEmojiAfirmativo(original: string): boolean {
  if (!esSoloEmojis(original)) return false;
  const emojis = Array.from(original.replace(ADORNOS_EMOJI, ""));
  return emojis.length > 0 && emojis.every((emoji) => EMOJIS_AFIRMACION.has(emoji));
}

function empiezaCon(tokens: string[], prefijo: string): boolean {
  const palabras = prefijo.split(" ");
  return palabras.every((palabra, i) => tokens[i] === palabra);
}

// Ordenada igual que el tipo `Intencion`: el resultado sale en este orden.
const REGLAS: Regla[] = [
  {
    intencion: "empleo",
    // "vendedor" y "trabajo" sueltos NO van: "quiero hablar con un vendedor" es pedir a alguien de ventas y
    // "lo necesito para trabajo" es de autos. Solo frases que piden empleo.
    frases: [
      "curriculum vitae",
      "c v",
      "busco trabajo",
      "busco laburo",
      "trabajar con ustedes",
      "trabajar en la agencia",
      "trabajar en posse",
      "trabajar con posse",
      "buscan vendedor",
      "buscan un vendedor",
      "buscan vendedora",
      "necesitan vendedor",
      "necesitan un vendedor",
      "puesto de vendedor",
      "puesto de vendedora",
    ],
    // Solo "curriculum" admite error de tipeo ("curriculun"): las demas, exactas. "postular" aproximado
    // coincidiria con "popular" ("un auto popular").
    palabras: ["curriculum"],
    exactas: ["cv", "curriculo", "empleo", "laburo", "postular", "postularme", "postularse", "postulo", "postulacion"],
  },
  {
    intencion: "humano",
    // "persona" y "humano" sueltas NO van: "es una persona la que me atiende?" pregunta por la identidad.
    // "numero" y "dueno" tampoco van sueltas: ver `pideNumero` y `pideAlDueno`.
    frases: [
      "hablar con alguien",
      "con una persona",
      "con un humano",
      "hablo con",
      "me llamas",
      "me llaman",
      "pasame con",
      "pasame el contacto",
      "con el dueno",
      "con el duenio",
      "numero de telefono",
      "numero de whatsapp",
      "numero de contacto",
    ],
    palabras: ["vendedor", "vendedora", "asesor", "asesora", "secretaria", "telefono", "whatsapp", "llamame"],
    exactas: ["nati", "wsp", "wasap", "cel"],
    extra: ({ tokens }) => pideNumero(tokens) || pideAlDueno(tokens),
  },
  {
    intencion: "identidad",
    // "con quien hablo" va aca y no en humano: el cliente quiere saber QUIEN es, no pedir a alguien.
    frases: [
      "sos un bot",
      "sos bot",
      "es un bot",
      "sos una persona",
      "sos humano",
      "sos real",
      "es una persona",
      "atiende una persona",
      "con quien hablo",
      "sos ia",
    ],
    palabras: ["maquina"],
    exactas: ["robot"],
    // "automatico" suelto es la transmision de un auto ("busco uno automatico"): solo es una pregunta
    // por el bot cuando habla de "mensaje" o "respuesta" ("es un mensaje automatico?").
    extra: ({ tokens }) =>
      tokens.includes("automatico") && (tokens.includes("mensaje") || tokens.includes("respuesta")),
  },
  {
    intencion: "avisame",
    // Siempre frases completas: "cuando" suelto aparece en "cuando puedo ir a verlo".
    frases: [
      "me avisan",
      "me avisas",
      "cuando entre",
      "cuando llegue",
      "si entra",
      "si llega",
      "dejame mi contacto",
    ],
    palabras: ["avisame", "avisenme"],
  },
  {
    intencion: "negacion",
    frases: ["ese no", "esa no", "no es ese", "no es esa", "no gracias"],
    // Un "no" al principio de un mensaje corto es una negativa; en una frase larga
    // ("no se si tienen alguna pickup nafta") es solo una palabra mas. Tampoco lo es si el mensaje
    // ya pregunta algo ("no tienen financiacion?", "no me pasas el precio?").
    extra: ({ tokens, hayContenido }) =>
      !hayContenido && tokens.length > 0 && tokens.length <= NEGACION_MAX_TOKENS && NEGACION_PRIMER_TOKEN.has(tokens[0]),
  },
  {
    intencion: "precio",
    frases: [
      "cuanto sale",
      "cuanto salen",
      "cuanto cuesta",
      "cuanto vale",
      "cuanto esta",
      "cuanto piden",
      "cuanto pedis",
      "a cuanto",
      "cuanto es",
    ],
    palabras: ["precio", "presio"],
    exactas: ["valor", "valores", "costo", "costos"],
  },
  {
    intencion: "financiacion",
    frases: ["plan de pago"],
    palabras: ["financiacion", "financiar", "financiado", "financian", "cuota", "cuotas", "credito", "prestamo", "anticipo"],
  },
  {
    intencion: "permuta",
    frases: [
      "toman usados",
      "tomas usados",
      "tomas mi auto",
      "toman mi auto",
      "parte de pago",
      "entrego mi auto",
      "entregar mi usado",
      "tengo un usado",
      "por mi auto",
      "por mi usado",
      "por mi vehiculo",
      "me toman",
      "me tomas",
      "toman mi",
      "tomas mi",
    ],
    palabras: ["permuta", "permutan", "permutas"],
  },
  {
    intencion: "pagos",
    frases: ["formas de pago", "medios de pago", "como se paga", "como pago"],
    palabras: ["efectivo", "transferencia"],
    exactas: ["cheque", "cheques"],
  },
  {
    intencion: "horarios",
    frases: ["a que hora", "hasta que hora"],
    palabras: ["horario", "horarios", "cierran", "sabados", "domingos"],
    // "atienden" aproximado coincidiria con "atiende" ("es una persona la que me atiende?"),
    // que es una pregunta por la identidad y no por los horarios.
    exactas: ["abren", "atienden"],
  },
  {
    intencion: "ubicacion",
    frases: ["donde estan", "donde queda", "como llego", "donde se encuentran"],
    palabras: ["direccion", "ubicacion"],
    exactas: ["mapa"],
  },
  {
    intencion: "garantia",
    palabras: ["garantia"],
  },
  {
    intencion: "documentacion",
    frases: ["libre de deuda"],
    palabras: ["documentacion", "papeles", "titulo", "cedula", "patente"],
    exactas: ["08", "vtv"],
  },
  {
    intencion: "disponibilidad",
    frases: [
      "sigue disponible",
      "esta disponible",
      "lo tienen",
      "la tienen",
      "todavia esta",
      "sigue en venta",
      "se vendio",
      "esta vendido",
      "esta vendida",
    ],
  },
  {
    intencion: "info",
    frases: ["mas info", "cuantos km", "que motor", "que ano"],
    palabras: ["informacion", "detalles", "caracteristicas", "kilometros", "kilometraje"],
    exactas: ["info", "ficha", "km"],
    // "datos" solo si lo pide el cliente: "te paso mis datos" es lo que ofrece el cliente.
    extra: ({ tokens }) => tokens.some((token, i) => token === "datos" && !POSESIVOS.has(tokens[i - 1])),
  },
  {
    intencion: "ver_mas",
    frases: [
      "ver mas",
      "mas opciones",
      "que mas",
      "tenes otro",
      "tenes otra",
      "otro mas",
      "algo mas",
      "mostrame mas",
      "muestrame mas",
    ],
    palabras: ["siguiente"],
    exactas: ["otros", "otras"],
  },
  {
    intencion: "catalogo",
    // "tienen"/"tenes" solos no alcanzan ("tienen garantia?" no pide el catalogo): se piden con su complemento.
    frases: [
      "que tienen",
      "que autos tienen",
      "que vehiculos",
      "que hay",
      "tienen alguna",
      "tenes alguna",
      "tienen algun",
      "tenes algun",
      "algun auto",
      "algun utilitario",
      "estoy buscando",
      "quiero un",
      "quiero una",
      "me interesa un",
      "me interesa una",
      // "lista" suelta es tambien "esta lista para transferir": solo cuenta como pedido de lista.
      "la lista",
      "lista de",
      "una lista",
    ],
    palabras: ["catalogo", "mostrame", "muestrame"],
    exactas: ["stock", "busco"],
  },
  {
    intencion: "afirmacion",
    // Solo en mensajes cortos: "si" al comienzo de una frase larga es un condicional ("si tienen financiacion...").
    extra: ({ tokens, original }) =>
      esEmojiAfirmativo(original) ||
      (tokens.length > 0 &&
        tokens.length <= AFIRMACION_MAX_TOKENS &&
        (AFIRMACION_PRIMER_TOKEN.has(tokens[0]) || AFIRMACION_PREFIJOS.some((prefijo) => empiezaCon(tokens, prefijo)))),
  },
  {
    intencion: "gracias",
    frases: ["mil gracias", "muy amable"],
    palabras: ["gracias"],
    // "genial" y "joya" son cortas o se parecen a otras palabras: nada de errores de tipeo.
    exactas: ["genial", "joya"],
  },
  {
    intencion: "despedida",
    frases: ["hasta luego", "nos vemos", "buen finde"],
    // "saludos" aproximado coincidiria con "saludo", que es mas bien un saludo de apertura.
    exactas: ["chau", "chao", "saludos"],
  },
  {
    intencion: "cortesia",
    frases: ["como estas", "como andas", "como va", "todo bien", "como te va", "que tal estas"],
  },
  {
    intencion: "saludo",
    frases: ["buen dia", "buenos dias", "buenas tardes", "buenas noches", "que tal"],
    // "buenas" aproximado coincidiria con "bueno", que es una afirmacion ("bueno, dale").
    exactas: ["hola", "ola", "buenas", "epa"],
  },
];

// Se arman una sola vez al cargar el modulo: son datos fijos.
const REGLAS_COMPILADAS = REGLAS.map((regla) => {
  const palabras = [...(regla.palabras ?? []), ...(regla.exactas ?? [])];
  return {
    regla,
    exactas: new Set(palabras),
    aproximadas: (regla.palabras ?? []).filter((palabra) => palabra.length >= LARGO_MINIMO_APROX),
  };
});

function coincide(
  { regla, exactas, aproximadas }: (typeof REGLAS_COMPILADAS)[number],
  contexto: Contexto,
  conBordes: string,
): boolean {
  if (regla.extra?.(contexto)) return true;
  if (regla.frases?.some((frase) => conBordes.includes(` ${frase} `))) return true;
  return contexto.tokens.some((token) => exactas.has(token) || aproximadas.some((palabra) => coincideAprox(token, palabra)));
}

/** Intenciones detectadas, de mas a menos prioritaria (el orden del tipo). Nunca vacia: "desconocida" si no hay ninguna. */
export function detectarIntenciones(texto: string): Intencion[] {
  const normalizado = aplicarFrases(normalizar(texto));
  const base: Contexto = {
    tokens: normalizado === "" ? [] : normalizado.split(" "),
    original: texto,
    hayContenido: false,
  };
  // Los espacios de los bordes hacen que una frase solo coincida con palabras enteras ("si entra" no esta en "casi entrar").
  const conBordes = ` ${normalizado} `;
  // Primero las intenciones de contenido: la negacion por primer token depende de si hay alguna.
  const contexto: Contexto = {
    ...base,
    hayContenido: REGLAS_COMPILADAS.some(
      (compilada) => INTENCIONES_CONTENIDO.has(compilada.regla.intencion) && coincide(compilada, base, conBordes),
    ),
  };

  const detectadas = REGLAS_COMPILADAS.filter((compilada) => coincide(compilada, contexto, conBordes)).map(
    ({ regla }) => regla.intencion,
  );
  return detectadas.length > 0 ? detectadas : ["desconocida"];
}
