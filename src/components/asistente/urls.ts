/**
 * Links e imágenes del chat. Todo lo que viene de la API o del sessionStorage se trata como no confiable: antes de
 * ponerlo en un `href` o un `src` pasa por acá. Puro (sin DOM) para poder probarlo.
 */

export type TipoUrl = "whatsapp" | "boton" | "imagen";

// Espacios, controles y barra invertida: los navegadores "arreglan" `/\evil.com` como `//evil.com`.
const RARO = /[\s\\\u0000-\u001f\u007f]/;

function esHttps(url: string): boolean {
  if (!url.startsWith("https://")) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname !== "";
  } catch {
    return false;
  }
}

/** Ruta del propio sitio: "/algo", nunca "//host" (que apunta a otro sitio). */
const esRutaRelativa = (url: string) => url.startsWith("/") && !url.startsWith("//");

/**
 * Devuelve la url tal cual si es segura para su uso, o null:
 * - whatsapp: solo `https://wa.me/…`.
 * - boton: ruta relativa del sitio o `https://…`.
 * - imagen: igual que boton (null = sin foto).
 */
export function urlSegura(url: unknown, tipo: TipoUrl): string | null {
  if (typeof url !== "string" || url === "" || RARO.test(url)) return null;
  if (tipo === "whatsapp") return url.startsWith("https://wa.me/") && esHttps(url) ? url : null;
  return esRutaRelativa(url) || esHttps(url) ? url : null;
}

export type Enlace = { href: string; tipo: "interno" | "whatsapp" | "externo" };

/**
 * Cómo se abre el botón de una tarjeta: WhatsApp en otra pestaña (y se mide), lo del propio sitio como navegación
 * interna (un https al mismo origen pasa a ruta relativa) y cualquier otro https en otra pestaña.
 */
export function enlaceBoton(url: unknown, origen: string | null): Enlace | null {
  const segura = urlSegura(url, "boton");
  if (!segura) return null;
  if (urlSegura(segura, "whatsapp")) return { href: segura, tipo: "whatsapp" };
  if (esRutaRelativa(segura)) return { href: segura, tipo: "interno" };
  if (origen) {
    const u = new URL(segura);
    if (u.origin === origen) return { href: `${u.pathname}${u.search}${u.hash}`, tipo: "interno" };
  }
  return { href: segura, tipo: "externo" };
}

/** En la web, el "Ver en la web" del bot de Instagram se lee mejor como "Ver ficha". */
export function etiquetaBoton(titulo: string, enlace: Enlace): string {
  return enlace.tipo === "interno" && enlace.href.startsWith("/vehiculos/") ? "Ver ficha" : titulo;
}
