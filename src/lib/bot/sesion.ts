export type Paso = "libre" | "pidiendo_nombre" | "pidiendo_telefono" | "eligiendo_historia";

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
  /** Pregunta del cliente que quedo sin responder mientras se identifica la historia. */
  preguntaPendiente: string | null;
  historiaPendienteId: string | null;
  ofrecio: Oferta | null;
  /** Mensajes seguidos que el bot no entendio. */
  fallos: number;
  saludado: boolean;
  ultimaActividad: string;
};

const PASOS: Paso[] = ["libre", "pidiendo_nombre", "pidiendo_telefono", "eligiendo_historia"];
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
    preguntaPendiente: textoONulo(c.preguntaPendiente),
    historiaPendienteId: textoONulo(c.historiaPendienteId),
    ofrecio: OFERTAS.includes(c.ofrecio as Oferta) ? (c.ofrecio as Oferta) : null,
    fallos: enteroNoNegativo(c.fallos),
    saludado: c.saludado === true,
    ultimaActividad: esTexto(c.ultimaActividad) ? c.ultimaActividad : base.ultimaActividad,
  };
}
