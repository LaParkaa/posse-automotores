import type { Vehiculo } from "@/lib/types";

export function formatPrice(precioTexto: string): string {
  return precioTexto;
}

/** Unica fuente del numero de WhatsApp del local (Nati). */
export const WHATSAPP_LOCAL = "5493537558947";

/** WhatsApp de Marcos, que recibe las postulaciones de vendedor (el de Nati es WHATSAPP_LOCAL). */
export const WHATSAPP_RECLUTADOR = "5493537662444";

export function buildWhatsAppUrl(
  vehiculo: Pick<Vehiculo, "nombre" | "tipo" | "promocionado_reel">
): string {
  const base = `https://wa.me/${WHATSAPP_LOCAL}?text=`;
  const esMoto = vehiculo.tipo === "Moto";
  const articulo = esMoto ? "la" : "el";
  const emoji = esMoto ? "🏍️" : "🚗";
  const msg = vehiculo.promocionado_reel
    ? `Hola, vi el Reel ${esMoto ? "de la" : "del"} ${vehiculo.nombre} ${emoji}🎥 y entré a la web. ¡Quiero más info!`
    : `Hola, vengo desde el catálogo web 💻. Me interesa ${articulo} ${vehiculo.nombre} ${emoji}. ¿Sigue disponible?`;
  return base + encodeURIComponent(msg);
}

/**
 * Link de WhatsApp para el cierre desde Instagram. El mensaje dice de donde viene y por que
 * auto, asi quien atiende el WhatsApp no tiene que preguntar.
 * Sin emojis a proposito: el navegador interno de Instagram los rompe al pasar por wa.me y en el
 * chat aparecian como "?".
 */
export function buildWhatsAppUrlInstagram(
  vehiculo: Pick<Vehiculo, "nombre" | "tipo"> | null,
): string {
  const base = `https://wa.me/${WHATSAPP_LOCAL}?text=`;
  if (!vehiculo) {
    return base + encodeURIComponent("Hola, te escribo desde Instagram. Quiero consultar por un vehículo.");
  }
  const articulo = vehiculo.tipo === "Moto" ? "la" : "el";
  return (
    base +
    encodeURIComponent(`Hola, te escribo desde Instagram. Me interesa ${articulo} ${vehiculo.nombre}. ¿Sigue disponible?`)
  );
}

// Instagram acepta botones con links de hasta unos 2000 caracteres: se deja margen.
const MAX_URL_POSTULACION = 1700;
const LARGO_RESPUESTA_INICIAL = 160;
const LARGO_RESPUESTA_MINIMO = 20;
const PASO_ACHICAR = 20;
const MAX_NOMBRE_EN_LINK = 80;

/**
 * Lo que escribio el candidato, apto para el link: sin emojis de 4 bytes (el navegador de Instagram los
 * rompe al abrir wa.me y salen como "?"), sin invisibles, en una sola linea y con tope de largo.
 */
function limpioParaLink(texto: string | null | undefined, max: number): string {
  const limpio = (texto ?? "")
    .replace(/[\u{10000}-\u{10FFFF}️‍]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(limpio).slice(0, max).join("").trim();
}

export type DatosPostulacionMensaje = {
  nombre?: string | null;
  edad?: number | null;
  localidad?: string | null;
  telefono?: string | null;
  experiencia_ventas?: string | null;
  experiencia_rubro?: string | null;
  financiaciones?: string | null;
  disponibilidad?: string | null;
};

// Solo simbolos del plano basico de Unicode (3 bytes): los emojis "nuevos" se rompen en el link de Instagram.
const LINEAS_POSTULACION: Array<[Exclude<keyof DatosPostulacionMensaje, "edad">, string]> = [
  ["nombre", "✍️ Nombre"],
  ["localidad", "⛳ Localidad"],
  ["telefono", "☎️ Teléfono"],
  ["experiencia_ventas", "⭐ Experiencia en ventas"],
  ["experiencia_rubro", "⚙️ Experiencia en el rubro automotor"],
  ["financiaciones", "✅ Financiaciones"],
  ["disponibilidad", "⏰ Disponibilidad"],
];
const CAMPOS_CORTOS = new Set<string>(["nombre", "localidad", "telefono"]);

function mensajePostulacion(datos: DatosPostulacionMensaje, reclutador: string, largoMax: number): string {
  const lineas: string[] = [];
  const agregar = (etiqueta: string, valor: string) => {
    if (valor !== "") lineas.push(`${etiqueta}: ${valor}`);
  };
  for (const [campo, etiqueta] of LINEAS_POSTULACION) {
    const max = CAMPOS_CORTOS.has(campo) ? Math.min(largoMax, MAX_NOMBRE_EN_LINK) : largoMax;
    agregar(etiqueta, limpioParaLink(datos[campo], max));
    // La edad va entre el nombre y la localidad.
    if (campo === "nombre" && datos.edad) agregar("☺️ Edad", `${datos.edad} años`);
  }
  return [`Hola ${reclutador} ✌️, te escribo desde Instagram por el puesto de vendedor.`, ...lineas, "Te mando mi CV ✉️"].join("\n");
}

/**
 * Link de WhatsApp a Marcos con el mensaje de la postulacion ya armado: un dato por linea y con emojis, asi
 * el candidato solo toca enviar (y adjunta su CV). Si las respuestas largas hacen pasar el link del limite
 * de Instagram, se achican hasta que entre.
 */
export function buildWhatsAppUrlPostulacion(
  datos: DatosPostulacionMensaje,
  reclutador: { nombre: string; whatsappNumero: string },
): string {
  const base = `https://wa.me/${reclutador.whatsappNumero}?text=`;
  let url = "";
  for (let largo = LARGO_RESPUESTA_INICIAL; largo >= LARGO_RESPUESTA_MINIMO; largo -= PASO_ACHICAR) {
    url = base + encodeURIComponent(mensajePostulacion(datos, reclutador.nombre, largo));
    if (url.length <= MAX_URL_POSTULACION) break;
  }
  return url;
}

export function buildSlug(nombre: string, anio: number): string {
  return `${nombre}-${anio}`
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
