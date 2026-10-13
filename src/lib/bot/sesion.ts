import { EDAD_MAXIMA, EDAD_MINIMA } from "./nlu/numeros";

export type Paso = "libre" | "pidiendo_nombre" | "pidiendo_telefono" | "eligiendo_historia" | "postulando";

/** Datos que se piden en la postulacion de vendedor, en el orden en que se preguntan. */
export const CAMPOS_POSTULACION = [
  "nombre",
  "edad",
  "localidad",
  "telefono",
  "experiencia_ventas",
  "experiencia_rubro",
  "financiaciones",
  "disponibilidad",
] as const;
export type CampoPostulacion = (typeof CAMPOS_POSTULACION)[number];

export type DatosPostulacion = {
  nombre?: string;
  edad?: number;
  localidad?: string;
  telefono?: string;
  experiencia_ventas?: string;
  experiencia_rubro?: string;
  financiaciones?: string;
  disponibilidad?: string;
};

export type Postulacion = {
  datos: DatosPostulacion;
  /** Datos que el candidato prefirio no responder: no se vuelven a preguntar. */
  omitidos: CampoPostulacion[];
  /** Dato que se pregunto y espera respuesta (null si no hay una pregunta pendiente). */
  campo: CampoPostulacion | null;
  /** Se conto la experiencia en ventas sin decir cuanto tiempo: se espera la duracion antes de seguir. */
  pendienteDuracion: boolean;
  /** True una vez armado el mensaje para Marcos: un nuevo "cv" no vuelve a pedir todo. */
  enviada: boolean;
};

export const postulacionNueva = (): Postulacion => ({
  datos: {},
  omitidos: [],
  campo: null,
  pendienteDuracion: false,
  enviada: false,
});

// Una respuesta libre mas larga no aporta y rompe los limites de los mensajes y de los links.
const MAX_RESPUESTA_POSTULACION = 300;

/** Lo ultimo que ofrecio el bot: un "si" del cliente se interpreta segun esto. */
export type Oferta = "contacto" | "mas" | "aviso";

export type Filtros = {
  /** Marca tal cual figura en el catalogo (ej. "Peugeot"). */
  marca?: string;
  /** Claves de tipo normalizadas (ej. ["pickup"]). Varias para palabras como "camioneta". */
  tipos?: string[];
  combustible?: string;
  transmision?: string;
  anio?: number;
};

export type Sesion = {
  paso: Paso;
  filtros: Filtros;
  /** Auto del que se esta hablando ("ese", "cuanto sale?"). */
  vehiculoActualId: string | null;
  /** Historia que origino `vehiculoActualId`; sirve para olvidarla si dice "no es ese". */
  historiaActualId: string | null;
  /** Autos del ultimo listado, en orden (para "el segundo"). */
  mostradosIds: string[];
  /** Todos los ya mostrados en la busqueda actual (para "ver mas" sin repetir). */
  vistosIds: string[];
  lead: { nombre?: string; telefono?: string; vehiculoInteres?: string; motivo?: string };
  /** Postulacion de vendedor en curso (o ya armada); null si el cliente nunca pidio trabajo. */
  postulacion: Postulacion | null;
  /** Pregunta del cliente que quedo sin responder mientras se identifica la historia. */
  preguntaPendiente: string | null;
  historiaPendienteId: string | null;
  ofrecio: Oferta | null;
  /** Mensajes seguidos que el bot no entendio. */
  fallos: number;
  saludado: boolean;
  ultimaActividad: string;
};

const PASOS: Paso[] = ["libre", "pidiendo_nombre", "pidiendo_telefono", "eligiendo_historia", "postulando"];
const OFERTAS: Oferta[] = ["contacto", "mas", "aviso"];

export function sesionNueva(ahora: Date): Sesion {
  return {
    paso: "libre",
    filtros: {},
    vehiculoActualId: null,
    historiaActualId: null,
    mostradosIds: [],
    vistosIds: [],
    lead: {},
    postulacion: null,
    preguntaPendiente: null,
    historiaPendienteId: null,
    ofrecio: null,
    fallos: 0,
    saludado: false,
    ultimaActividad: ahora.toISOString(),
  };
}

/** Pasadas `horas` sin actividad el contexto se reinicia (el cliente vuelve por otra cosa). */
export function sesionVigente(sesion: Sesion, ahora: Date, horas = 24): boolean {
  const ultima = Date.parse(sesion.ultimaActividad);
  if (Number.isNaN(ultima)) return false;
  return ahora.getTime() - ultima <= horas * 60 * 60 * 1000;
}

const esTexto = (v: unknown): v is string => typeof v === "string";
const textoONulo = (v: unknown): string | null => (esTexto(v) ? v : null);
const listaDeTextos = (v: unknown): string[] => (Array.isArray(v) ? v.filter(esTexto) : []);
// NaN, Infinity y negativos vienen de jsonb corrupto o editado a mano: no son un contador valido.
const enteroNoNegativo = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0 ? v : 0;

const esCampo = (v: unknown): v is CampoPostulacion => (CAMPOS_POSTULACION as readonly unknown[]).includes(v);

function textoAcotado(v: unknown): string | null {
  if (!esTexto(v)) return null;
  const texto = v.trim().slice(0, MAX_RESPUESTA_POSTULACION);
  return texto === "" ? null : texto;
}

/** Lee la postulacion guardada (jsonb) sin confiar en su forma: lo invalido se descarta. */
function normalizarPostulacion(crudo: unknown): Postulacion | null {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return null;
  const c = crudo as Record<string, unknown>;
  const d = typeof c.datos === "object" && c.datos !== null && !Array.isArray(c.datos) ? (c.datos as Record<string, unknown>) : {};

  const datos: DatosPostulacion = {};
  for (const campo of CAMPOS_POSTULACION) {
    if (campo === "edad") {
      const edad = d.edad;
      if (typeof edad === "number" && Number.isInteger(edad) && edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA) datos.edad = edad;
      continue;
    }
    const texto = textoAcotado(d[campo]);
    if (texto !== null) datos[campo] = texto;
  }

  return {
    datos,
    omitidos: Array.isArray(c.omitidos) ? [...new Set(c.omitidos.filter(esCampo))] : [],
    campo: esCampo(c.campo) ? c.campo : null,
    pendienteDuracion: c.pendienteDuracion === true,
    enviada: c.enviada === true,
  };
}

/** Lee lo guardado en la base (jsonb) sin confiar en su forma: lo invalido se descarta. */
export function normalizarSesion(crudo: unknown, ahora: Date): Sesion {
  const base = sesionNueva(ahora);
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return base;
  const c = crudo as Record<string, unknown>;

  const lead = typeof c.lead === "object" && c.lead !== null && !Array.isArray(c.lead) ? (c.lead as Record<string, unknown>) : {};
  const filtros =
    typeof c.filtros === "object" && c.filtros !== null && !Array.isArray(c.filtros)
      ? (c.filtros as Record<string, unknown>)
      : {};

  const tipos = listaDeTextos(filtros.tipos);

  return {
    paso: PASOS.includes(c.paso as Paso) ? (c.paso as Paso) : base.paso,
    filtros: {
      ...(esTexto(filtros.marca) ? { marca: filtros.marca } : {}),
      // Una lista vacia no filtra nada: se omite la clave para no confundirla con "filtro activo".
      ...(tipos.length > 0 ? { tipos } : {}),
      ...(esTexto(filtros.combustible) ? { combustible: filtros.combustible } : {}),
      ...(esTexto(filtros.transmision) ? { transmision: filtros.transmision } : {}),
      ...(typeof filtros.anio === "number" && Number.isFinite(filtros.anio) ? { anio: filtros.anio } : {}),
    },
    vehiculoActualId: textoONulo(c.vehiculoActualId),
    historiaActualId: textoONulo(c.historiaActualId),
    mostradosIds: listaDeTextos(c.mostradosIds),
    vistosIds: listaDeTextos(c.vistosIds),
    lead: {
      ...(esTexto(lead.nombre) ? { nombre: lead.nombre } : {}),
      ...(esTexto(lead.telefono) ? { telefono: lead.telefono } : {}),
      ...(esTexto(lead.vehiculoInteres) ? { vehiculoInteres: lead.vehiculoInteres } : {}),
      ...(esTexto(lead.motivo) ? { motivo: lead.motivo } : {}),
    },
    postulacion: normalizarPostulacion(c.postulacion),
    preguntaPendiente: textoONulo(c.preguntaPendiente),
    historiaPendienteId: textoONulo(c.historiaPendienteId),
    ofrecio: OFERTAS.includes(c.ofrecio as Oferta) ? (c.ofrecio as Oferta) : null,
    fallos: enteroNoNegativo(c.fallos),
    saludado: c.saludado === true,
    ultimaActividad: esTexto(c.ultimaActividad) ? c.ultimaActividad : base.ultimaActividad,
  };
}
