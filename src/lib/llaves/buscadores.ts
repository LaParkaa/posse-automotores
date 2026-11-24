/**
 * Búsqueda de imágenes de llaves. Funciona con Serper (google.serper.dev, el más fácil: 2.500 búsquedas gratis) o con
 * la Custom Search JSON API de Google. Las claves se cargan como variables de entorno (ver .env.example).
 */

export type ConfigBusqueda = { serperKey?: string; googleKey?: string; googleCx?: string };

export type MotivoBusqueda = "sin_proveedor" | "proveedor";

export class ErrorBusqueda extends Error {
  constructor(
    public readonly motivo: MotivoBusqueda,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorBusqueda";
  }
}

const MAX_CANDIDATAS = 8;
const TIMEOUT_MS = 8000;

export function configDesdeEnv(env: Record<string, string | undefined> = process.env): ConfigBusqueda {
  const limpio = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);
  return {
    serperKey: limpio(env.SERPER_API_KEY),
    googleKey: limpio(env.GOOGLE_CSE_API_KEY),
    googleCx: limpio(env.GOOGLE_CSE_ID),
  };
}

export function hayProveedor(c: ConfigBusqueda): boolean {
  return Boolean(c.serperKey) || Boolean(c.googleKey && c.googleCx);
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Solo links http(s) a imágenes que no sean SVG ni GIF, sin repetidos y como máximo 8. */
function depurar(urls: unknown[]): string[] {
  const vistas = new Set<string>();
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const url = u.trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (/\.(svg|gif)(\?|#|$)/i.test(url)) continue;
    vistas.add(url);
    if (vistas.size >= MAX_CANDIDATAS) break;
  }
  return [...vistas];
}

/** Respuesta de Serper: { images: [{ imageUrl, ... }] }. */
export function parsearSerper(json: unknown): string[] {
  if (!esObjeto(json) || !Array.isArray(json.images)) return [];
  return depurar(json.images.map((i) => (esObjeto(i) ? i.imageUrl : null)));
}

/** Respuesta de Google Custom Search (searchType=image): { items: [{ link, ... }] }. */
export function parsearGoogle(json: unknown): string[] {
  if (!esObjeto(json) || !Array.isArray(json.items)) return [];
  return depurar(json.items.map((i) => (esObjeto(i) ? i.link : null)));
}

async function pedir(fetchFn: typeof fetch, url: string, init: RequestInit, proveedor: string): Promise<unknown> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetchFn(url, { ...init, signal: control.signal });
    if (!respuesta.ok) {
      // Nunca se copia el cuerpo ni la URL (puede llevar la clave): solo el código.
      throw new ErrorBusqueda("proveedor", `${proveedor} respondió ${respuesta.status}`);
    }
    return await respuesta.json();
  } catch (e) {
    if (e instanceof ErrorBusqueda) throw e;
    throw new ErrorBusqueda("proveedor", `No se pudo consultar ${proveedor}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Devuelve hasta 8 direcciones de imágenes candidatas, la mejor primero. */
export async function buscarImagenes(
  consulta: string,
  config: ConfigBusqueda,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  if (config.serperKey) {
    const json = await pedir(
      fetchFn,
      "https://google.serper.dev/images",
      {
        method: "POST",
        headers: { "X-API-KEY": config.serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: consulta, gl: "ar", hl: "es", num: 10 }),
      },
      "Serper",
    );
    return parsearSerper(json);
  }

  if (config.googleKey && config.googleCx) {
    const params = new URLSearchParams({
      key: config.googleKey,
      cx: config.googleCx,
      q: consulta,
      searchType: "image",
      num: "8",
      gl: "ar",
      lr: "lang_es",
    });
    const json = await pedir(fetchFn, `https://www.googleapis.com/customsearch/v1?${params}`, { method: "GET" }, "Google");
    return parsearGoogle(json);
  }

  throw new ErrorBusqueda(
    "sin_proveedor",
    "Falta configurar la búsqueda de imágenes (SERPER_API_KEY, o GOOGLE_CSE_API_KEY y GOOGLE_CSE_ID).",
  );
}
