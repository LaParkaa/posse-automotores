import { buildWhatsAppUrlInstagram, buildWhatsAppUrlPostulacion, type DatosPostulacionMensaje } from "../utils";
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

const PLACEHOLDER = /consult|a convenir|sin dato/i;

/**
 * Un texto de catalogo es un dato real salvo que este vacio o sea un placeholder ("Consultá",
 * "A convenir", "Sin datos"). Si trae una cifra ("$9.500.000 (consultar financiación)") se
 * conserva aunque nombre una palabra de placeholder: ahi hay un precio o km de verdad.
 */
function datoReal(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  if (texto === "") return null;
  if (PLACEHOLDER.test(texto) && !/\d/.test(texto)) return null;
  return texto;
}

/** Precio listo para decir, o null si no esta cargado o es un placeholder (ahi manda Marcos). */
export function precioDe(v: VehiculoCatalogo): string | null {
  return datoReal(v.precio_texto);
}

/** Link publico a la ficha del auto; sin siteUrl queda la ruta relativa. */
export function linkFicha(v: VehiculoCatalogo, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/vehiculos/${v.slug}`;
}

/** True si el link sirve para un boton o texto de Instagram: solo https absoluto. */
function esHttps(url: string): boolean {
  return url.startsWith("https://");
}

/**
 * Foto de portada para la tarjeta. Instagram rechaza TODO el carrusel si una imagen no se puede
 * bajar, asi que solo se devuelve una URL https absoluta, ya codificada (espacios, acentos).
 * Las rutas del propio sitio se completan con siteUrl, y solo si ese siteUrl es https.
 */
export function urlImagen(v: VehiculoCatalogo, siteUrl: string): string | null {
  const crudo = v.cover_image_url?.trim();
  if (!crudo) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(crudo)) {
      const absoluta = new URL(crudo);
      return absoluta.protocol === "https:" ? absoluta.href : null;
    }
    // "//host/x" es protocolo relativo: apunta a un host ajeno, no al sitio.
    if (crudo.startsWith("//")) return null;
    const base = new URL(siteUrl.trim().replace(/\/+$/, "") + "/");
    if (base.protocol !== "https:") return null;
    const resuelta = new URL(crudo.replace(/^\//, ""), base);
    // Defensa extra: si por cualquier razon el origen cambio (otro host), se descarta.
    return resuelta.origin === base.origin ? resuelta.href : null;
  } catch {
    return null;
  }
}

/** El km "Consultá km" o "Sin datos" es un placeholder del catalogo, no un dato: no se muestra. */
function kmDe(v: VehiculoCatalogo): string | null {
  return datoReal(v.kilometraje);
}

/** "2011 · 177.000 km · Nafta · Manual" (sin km si no esta cargado). */
export function datosVehiculo(v: VehiculoCatalogo): string {
  return [String(v.anio), kmDe(v), v.combustible, v.transmision]
    .filter((p): p is string => !!p && p.trim() !== "")
    .join(" · ");
}

/** Boton que abre el WhatsApp de la secretaria con el mensaje del auto (origen Instagram). */
export function botonContacto(v: VehiculoCatalogo | null, negocio: Negocio): Boton {
  return {
    titulo: recortar(`Hablar con ${negocio.secretaria}`, MAX_BOTON),
    url: buildWhatsAppUrlInstagram(v),
  };
}

/**
 * Link al simulador de financiacion del sitio, con el auto elegido. Null si el sitio no es https: Instagram
 * rechaza el boton (y con el, toda la tarjeta) si el link no es absoluto.
 */
export function urlFinanciacion(v: VehiculoCatalogo | null, siteUrl: string): string | null {
  const base = siteUrl.trim().replace(/\/+$/, "");
  if (!esHttps(base)) return null;
  return v ? `${base}/financiacion?auto=${encodeURIComponent(v.slug)}` : `${base}/financiacion`;
}

/** Boton "Simular mi plan" (null si no hay un link valido). */
export function botonFinanciar(v: VehiculoCatalogo | null, ctx: Contexto): Boton | null {
  const url = urlFinanciacion(v, ctx.siteUrl);
  return url ? { titulo: "Simular mi plan", url } : null;
}

/**
 * Subtitulo "km · combustible · precio". Si no entra en 80, lo que se recorta es km y
 * combustible, nunca el precio: un precio cortado a la mitad es peor que no mostrarlo. Al
 * recortar, el precio pasa adelante para que el "…" quede al final del texto sacrificado.
 */
function subtituloDe(v: VehiculoCatalogo, precio: string): string {
  const datos = [kmDe(v), v.combustible].filter((p): p is string => !!p && p.trim() !== "").join(" · ");
  const completo = datos === "" ? precio : `${datos} · ${precio}`;
  if (Array.from(completo).length <= MAX_SUBTITULO) return completo;

  const lugar = MAX_SUBTITULO - Array.from(precio).length - Array.from(" · ").length;
  // Con menos de 2 code points libres el recorte solo dejaria un "…" suelto: queda el precio.
  if (datos === "" || lugar < 2) return recortar(precio, MAX_SUBTITULO);
  return `${precio} · ${recortar(datos, lugar)}`;
}

/**
 * Tarjeta de un auto: foto, datos y precio. El boton "Ver en la web" solo va si el link es
 * https absoluto (Instagram rechaza el carrusel entero con una URL relativa); el de la
 * secretaria siempre va, asi que nunca queda una tarjeta sin botones.
 */
export function tarjetaDe(v: VehiculoCatalogo, ctx: Contexto): Tarjeta {
  const precio = precioDe(v) ?? `precio con ${ctx.negocio.secretaria}`;
  const link = linkFicha(v, ctx.siteUrl);
  const botones: Boton[] = [botonContacto(v, ctx.negocio)];
  // Orden: "Ver en la web", "Simular mi plan", "Hablar con Marcos" (Instagram admite hasta 3 botones).
  const financiar = botonFinanciar(v, ctx);
  if (financiar) botones.unshift(financiar);
  if (esHttps(link)) botones.unshift({ titulo: "Ver en la web", url: link });
  return {
    titulo: recortar(`${v.nombre} ${v.anio}`, MAX_TITULO),
    subtitulo: subtituloDe(v, precio),
    imagenUrl: urlImagen(v, ctx.siteUrl),
    botones,
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
    botones: [botonContacto(v, negocio)],
  };
}

/**
 * Tarjeta de financiacion: el boton lleva al simulador del sitio (con el auto, si lo hay) y el otro a Marcos.
 * Sin link https valido queda solo el de Marcos, como cualquier tarjeta de contacto.
 */
export function tarjetaFinanciacion(v: VehiculoCatalogo | null, ctx: Contexto): Tarjeta {
  const { negocio } = ctx;
  const botones = [botonFinanciar(v, ctx), botonContacto(v, negocio)].filter((b): b is Boton => b !== null);
  return {
    titulo: recortar(v ? `${v.nombre} ${v.anio}` : "Simulá tu financiación", MAX_TITULO),
    subtitulo: recortar(`Armá tu plan sin compromiso y ${negocio.secretaria} te lo confirma`, MAX_SUBTITULO),
    imagenUrl: v ? urlImagen(v, ctx.siteUrl) : null,
    botones,
  };
}

/**
 * Tarjeta del puesto de vendedor: el boton abre el WhatsApp de Marcos con el mensaje ya armado con los datos
 * del candidato, para que solo toque enviar. Instagram no admite tarjetas sin botones, asi que siempre lleva ese.
 */
export function tarjetaPostulacion(datos: DatosPostulacionMensaje, ctx: Contexto): Tarjeta {
  const { reclutador } = ctx.negocio;
  return {
    titulo: recortar("Puesto de vendedor", MAX_TITULO),
    subtitulo: recortar(`Tu mensaje para ${reclutador.nombre} ya está armado`, MAX_SUBTITULO),
    imagenUrl: null,
    botones: [
      {
        titulo: recortar(`Enviar a ${reclutador.nombre}`, MAX_BOTON),
        url: buildWhatsAppUrlPostulacion(datos, reclutador),
      },
    ],
  };
}

const MAX_BYTES_TEXTO = 1000;
const bytesDe = (texto: string) => new TextEncoder().encode(texto).length;

/**
 * Respaldo en texto de las tarjetas (si Instagram las rechaza): una linea por auto, sin
 * encabezado y como maximo 5, para cumplir las reglas de tono (<= 5 lineas, <= 1000 bytes).
 * El link se omite si no es https absoluto, y si el texto pasa de 1000 bytes se descartan
 * autos del final (mejor menos autos que un mensaje que Instagram no acepta).
 */
export function alternativaTexto(vehiculos: VehiculoCatalogo[], ctx: Contexto): string {
  const lineas = vehiculos.slice(0, MAX_AUTOS_EN_TEXTO).map((v) => {
    const precio = precioDe(v) ?? `precio con ${ctx.negocio.secretaria}`;
    const link = linkFicha(v, ctx.siteUrl);
    const base = `• ${v.nombre} ${v.anio} · ${precio}`;
    return esHttps(link) ? `${base} · ${link}` : base;
  });
  while (lineas.length > 0 && bytesDe(lineas.join("\n")) > MAX_BYTES_TEXTO) lineas.pop();
  return lineas.join("\n");
}

const ESTADO_NO_DISPONIBLE = { vendido: "vendido", reservado: "reservado" } as const;

/**
 * Tarjeta de una lista numerada para que el cliente identifique un auto (ej. de que auto era la
 * historia). Un disponible es su tarjeta normal con el numero adelante; uno vendido o reservado
 * NO se ofrece como compra: sin precio ni "Ver en la web", con su estado, y solo el boton de la
 * secretaria (Instagram exige al menos un boton).
 */
export function tarjetaEleccion(v: VehiculoCatalogo, numero: number, ctx: Contexto): Tarjeta {
  if (v.estado === "disponible") {
    const t = tarjetaDe(v, ctx);
    return { ...t, titulo: recortar(`${numero}) ${v.nombre} ${v.anio}`, MAX_TITULO) };
  }
  const estado = v.estado === "vendido" ? "Ya se vendió" : "Reservado";
  const datos = [kmDe(v), v.combustible].filter((p): p is string => !!p && p.trim() !== "").join(" · ");
  return {
    titulo: recortar(`${numero}) ${v.nombre} ${v.anio}`, MAX_TITULO),
    // El estado va primero: si el subtitulo se recorta, se pierde el km y no el aviso de que no esta a la venta.
    subtitulo: recortar(datos === "" ? estado : `${estado} · ${datos}`, MAX_SUBTITULO),
    imagenUrl: urlImagen(v, ctx.siteUrl),
    botones: [botonContacto(v, ctx.negocio)],
  };
}

/**
 * Respaldo en texto de una lista para elegir: "1) Peugeot 206 1.6 2011", una linea por auto y
 * como maximo 5 (regla de tono). Sin precios: solo sirve para reconocer el auto, y un vendido
 * lleva su estado para que nadie lo lea como una oferta.
 */
export function listaNumerada(vehiculos: VehiculoCatalogo[]): string {
  const lineas = vehiculos.slice(0, MAX_AUTOS_EN_TEXTO).map((v, i) => {
    const estado = v.estado === "disponible" ? "" : ` (${ESTADO_NO_DISPONIBLE[v.estado]})`;
    return `${i + 1}) ${v.nombre} ${v.anio}${estado}`;
  });
  while (lineas.length > 0 && bytesDe(lineas.join("\n")) > MAX_BYTES_TEXTO) lineas.pop();
  return lineas.join("\n");
}

/**
 * "Juan Perez" → "Juan"; null si el perfil no trae nombre o la primera palabra no parece uno
 * (un usuario como "juan94" o un emoji suenan raro en un saludo). Los emojis y adornos pegados al nombre
 * ("Anitta🌺🌹") se sacan. Si viene todo en mayusculas
 * ("JUAN") se pasa a "Juan"; los nombres normales no se tocan.
 */
export function primerNombre(perfil: Perfil | null): string | null {
  const nombre = perfil?.nombre?.trim();
  if (!nombre) return null;
  // NFKC pasa las letras "decoradas" de Instagram (𝑪𝒉𝒓𝒊𝒔) a letras comunes; despues se sacan emojis y adornos.
  const cruda = nombre.normalize("NFKC").split(/\s+/)[0];
  if (/\d/.test(cruda)) return null;
  const palabra = cruda.replace(/[^\p{L}\p{M}'’-]/gu, "").replace(/^['’-]+|['’-]+$/g, "");
  if (!/\p{L}/u.test(palabra)) return null;
  if (palabra === palabra.toUpperCase()) {
    const [inicial, ...resto] = Array.from(palabra.toLowerCase());
    return inicial.toUpperCase() + resto.join("");
  }
  return palabra;
}
