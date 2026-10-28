/**
 * Estadísticas del sitio: qué se registra y cómo se valida. Todo sin datos personales; el único identificador es un
 * número al azar del navegador. Código puro (sin React ni red) para poder probarlo.
 */

export const TIPOS_EVENTO = ["visita", "whatsapp", "simular", "simulacion"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const ORIGENES = ["instagram", "facebook", "google", "whatsapp", "directo", "otro"] as const;
export type Origen = (typeof ORIGENES)[number];

export type Dispositivo = "celular" | "compu";

export type EventoEntrante = {
  tipo: TipoEvento;
  ruta: string;
  vehiculo_slug: string | null;
  visitante: string | null;
  origen: Origen | null;
};

// El admin y la API no son del público: no se miden.
const RUTAS_IGNORADAS = ["/admin", "/panel", "/api"];
const MAX_RUTA = 200;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 120;
const VISITANTE = /^[A-Za-z0-9-]{8,64}$/;

export function rutaSeSigue(ruta: string): boolean {
  if (!ruta.startsWith("/") || ruta.length > MAX_RUTA) return false;
  return !RUTAS_IGNORADAS.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));
}

/** "/vehiculos/volkswagen-gol-power-1-6-2010" → "volkswagen-gol-power-1-6-2010". */
export function slugDeRuta(ruta: string): string | null {
  const m = /^\/vehiculos\/([^/?#]+)/.exec(ruta);
  return m && SLUG.test(m[1]) && m[1].length <= MAX_SLUG ? m[1] : null;
}

/** El auto al que apunta un link al simulador ("/financiacion?auto=slug"). */
export function slugDeHrefSimulador(href: string): string | null {
  const m = /[?&]auto=([^&#]+)/.exec(href);
  if (!m) return null;
  try {
    const slug = decodeURIComponent(m[1]);
    return SLUG.test(slug) && slug.length <= MAX_SLUG ? slug : null;
  } catch {
    return null;
  }
}

/** Valida lo que llega a la API: devuelve el evento limpio o null si no sirve. Ignora campos desconocidos. */
export function validarEvento(crudo: unknown): EventoEntrante | null {
  if (typeof crudo !== "object" || crudo === null) return null;
  const c = crudo as Record<string, unknown>;

  if (typeof c.tipo !== "string" || !(TIPOS_EVENTO as readonly string[]).includes(c.tipo)) return null;
  if (typeof c.ruta !== "string" || !rutaSeSigue(c.ruta)) return null;

  let vehiculo: string | null = null;
  if (typeof c.vehiculo_slug === "string" && c.vehiculo_slug.length <= MAX_SLUG && SLUG.test(c.vehiculo_slug)) {
    vehiculo = c.vehiculo_slug;
  }
  // Una visita a la ficha de un auto cuenta para ese auto aunque el navegador no lo diga.
  vehiculo ??= slugDeRuta(c.ruta);

  const visitante = typeof c.visitante === "string" && VISITANTE.test(c.visitante) ? c.visitante : null;
  const origen =
    typeof c.origen === "string" && (ORIGENES as readonly string[]).includes(c.origen) ? (c.origen as Origen) : null;

  return { tipo: c.tipo as TipoEvento, ruta: c.ruta, vehiculo_slug: vehiculo, visitante, origen };
}

const ROBOTS = /bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|whatsapp|curl|wget|python|node-fetch/i;

/** Robots de buscadores y de vistas previas: no son personas, no se cuentan. Sin user-agent tampoco. */
export function esRobot(userAgent: string | null): boolean {
  return !userAgent || ROBOTS.test(userAgent);
}

export function dispositivoDe(userAgent: string | null): Dispositivo {
  return /Mobi|Android|iPhone|iPad/i.test(userAgent ?? "") ? "celular" : "compu";
}

/** De dónde llegó la persona a la primera página de su visita; null si venía del propio sitio. */
export function origenDe(referrer: string, hostPropio: string): Origen | null {
  if (referrer.trim() === "") return "directo";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "otro";
  }
  if (host === hostPropio.toLowerCase().split(":")[0]) return null;
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.com|m\.facebook\.com)$/.test(host)) return "facebook";
  if (/(^|\.)google\./.test(host)) return "google";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return "whatsapp";
  return "otro";
}
