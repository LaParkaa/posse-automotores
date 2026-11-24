/**
 * El servidor descarga imágenes de direcciones que no controla (resultados de búsqueda o links que pega el vendedor).
 * Antes de pedirlas hay que asegurarse de que no apunten a la red interna del servidor.
 */

const PUERTOS_PERMITIDOS = new Set(["", "80", "443"]);

function ipv4Privada(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local y metadatos de la nube
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 0 && m[3] === "0") return true;
  return a >= 224; // multicast y reservadas
}

function ipv6Privada(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (/^fe[89ab]/.test(h)) return true; // link-local
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (mapeada) return ipv4Privada(mapeada[1]);
  // ::ffff:7f00:1 (forma hexadecimal que normaliza URL): se trata como privada por las dudas.
  if (h.startsWith("::ffff:")) return true;
  return false;
}

/** True si el host es una dirección interna o un nombre que no puede ser de internet. */
export function hostEsPrivado(hostCrudo: string): boolean {
  const host = hostCrudo.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "") return true;
  if (host.includes(":")) return ipv6Privada(host);
  if (/^[\d.]+$/.test(host)) return ipv4Privada(host) || !/^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (/\.(local|internal|lan|home|corp|intranet)$/.test(host)) return true;
  return !host.includes("."); // "servidor", "db": nombres sin punto son internos
}

/** Dirección que sí se puede descargar: http(s), sin usuario ni clave, puerto normal y host público. Si no, null. */
export function urlDescargable(crudo: string): URL | null {
  let url: URL;
  try {
    url = new URL(crudo.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (!PUERTOS_PERMITIDOS.has(url.port)) return null;
  if (hostEsPrivado(url.hostname)) return null;
  return url;
}
