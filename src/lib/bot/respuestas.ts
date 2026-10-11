import { buildWhatsAppUrlInstagram } from "../utils";
import type { Negocio } from "./negocio";
import type { Boton, Perfil, Tarjeta, VehiculoCatalogo } from "./types";

export type Contexto = { negocio: Negocio; siteUrl: string };

// Limites de Instagram para las tarjetas (plantilla generica).
const MAX_TITULO = 80;
const MAX_SUBTITULO = 80;
const MAX_BOTON = 20;
// Mas de 5 lineas rompe la regla de tono (mensajes cortos), asi que la lista no pasa de 5 autos.
const MAX_AUTOS_EN_TEXTO = 5;

/**
 * Recorta por code points (no por unidades UTF-16) para no partir un emoji a la mitad, que
 * Instagram rechaza. Si recorta, el ultimo caracter es "…" y el total sigue siendo <= max.
 */
function recortar(texto: string, max: number): string {
  const cps = Array.from(texto);
  if (cps.length <= max) return texto;
  return cps.slice(0, max - 1).join("") + "…";
}

/**
 * Elige una variante de forma determinista: misma semilla, misma variante. Asi los tests son
 * estables y un mismo mensaje no cambia de redaccion si se reprocesa, sin usar Math.random.
 */
export function elegir(variantes: readonly string[], semilla: string): string {
  if (variantes.length === 0) throw new Error("elegir: la lista de variantes esta vacia");
  let suma = 0;
  for (let i = 0; i < semilla.length; i++) suma += semilla.charCodeAt(i);
  return variantes[suma % variantes.length];
}

/** Precio listo para decir, o null si no esta cargado o dice "Consulta..." (ahi manda Nati). */
export function precioDe(v: VehiculoCatalogo): string | null {
  const texto = (v.precio_texto ?? "").trim();
  if (texto === "" || /consult/i.test(texto)) return null;
  return texto;
}

/** Link publico a la ficha del auto; sin siteUrl queda la ruta relativa. */
export function linkFicha(v: VehiculoCatalogo, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/vehiculos/${v.slug}`;
}

/**
 * Foto de portada para la tarjeta. Instagram solo acepta URLs https absolutas: las rutas del
 * propio sitio se completan con siteUrl (si es https) y todo lo demas devuelve null.
 */
export function urlImagen(v: VehiculoCatalogo, siteUrl: string): string | null {
  const url = v.cover_image_url?.trim();
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  const base = siteUrl.replace(/\/+$/, "");
  if (url.startsWith("/") && base.startsWith("https://")) return base + url;
  return null;
}

/** El km "Consultá km" es un placeholder del catalogo, no un dato: no se muestra. */
function kmDe(v: VehiculoCatalogo): string | null {
  const km = (v.kilometraje ?? "").trim();
  return km === "" || /consult/i.test(km) ? null : km;
}

/** "2011 · 177.000 km · Nafta · Manual" (sin km si no esta cargado). */
export function datosVehiculo(v: VehiculoCatalogo): string {
  return [String(v.anio), kmDe(v), v.combustible, v.transmision]
    .filter((p): p is string => !!p && p.trim() !== "")
    .join(" · ");
}

/** Boton que abre el WhatsApp de la secretaria con el mensaje del auto (origen Instagram). */
export function botonNati(v: VehiculoCatalogo | null, negocio: Negocio): Boton {
  return {
    titulo: recortar(`Hablar con ${negocio.secretaria}`, MAX_BOTON),
    url: buildWhatsAppUrlInstagram(v),
  };
}

/** Tarjeta de un auto: foto, datos y precio, con link a la web y a la secretaria. */
export function tarjetaDe(v: VehiculoCatalogo, ctx: Contexto): Tarjeta {
  const precio = precioDe(v) ?? `precio con ${ctx.negocio.secretaria}`;
  const subtitulo = [kmDe(v), v.combustible, precio].filter((p): p is string => !!p && p.trim() !== "").join(" · ");
  return {
    titulo: recortar(`${v.nombre} ${v.anio}`, MAX_TITULO),
    subtitulo: recortar(subtitulo, MAX_SUBTITULO),
    imagenUrl: urlImagen(v, ctx.siteUrl),
    botones: [
      { titulo: "Ver en la web", url: linkFicha(v, ctx.siteUrl) },
      botonNati(v, ctx.negocio),
    ],
  };
}

/**
 * Tarjeta solo de contacto. Instagram no admite tarjetas sin botones, asi que siempre lleva
 * el de la secretaria (con el auto si lo hay, o una consulta general).
 */
export function tarjetaContacto(v: VehiculoCatalogo | null, ctx: Contexto): Tarjeta {
  const { negocio } = ctx;
  return {
    titulo: recortar(v ? `${v.nombre} ${v.anio}` : negocio.nombre, MAX_TITULO),
    subtitulo: recortar(`Escribile a ${negocio.secretaria} y te cuenta todo`, MAX_SUBTITULO),
    imagenUrl: null,
    botones: [botonNati(v, negocio)],
  };
}

/**
 * Respaldo en texto de las tarjetas (si Instagram las rechaza): una linea por auto, sin
 * encabezado y como maximo 5, para cumplir las reglas de tono (<= 5 lineas, <= 1000 bytes).
 */
export function alternativaTexto(vehiculos: VehiculoCatalogo[], ctx: Contexto): string {
  return vehiculos
    .slice(0, MAX_AUTOS_EN_TEXTO)
    .map((v) => {
      const precio = precioDe(v) ?? `precio con ${ctx.negocio.secretaria}`;
      return `• ${v.nombre} ${v.anio} · ${precio} · ${linkFicha(v, ctx.siteUrl)}`;
    })
    .join("\n");
}

/** "Juan Perez" → "Juan"; null si el perfil no trae nombre. */
export function primerNombre(perfil: Perfil | null): string | null {
  const nombre = perfil?.nombre?.trim();
  if (!nombre) return null;
  return nombre.split(/\s+/)[0];
}
