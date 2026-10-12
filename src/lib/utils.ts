import type { Vehiculo } from "@/lib/types";

export function formatPrice(precioTexto: string): string {
  return precioTexto;
}

/** Unica fuente del numero de WhatsApp del local (Nati). */
export const WHATSAPP_LOCAL = "5493537558947";

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
 */
export function buildWhatsAppUrlInstagram(
  vehiculo: Pick<Vehiculo, "nombre" | "tipo"> | null,
): string {
  const base = `https://wa.me/${WHATSAPP_LOCAL}?text=`;
  if (!vehiculo) {
    return base + encodeURIComponent("Hola, te escribo desde Instagram 📲. Quiero consultar por un vehículo.");
  }
  const esMoto = vehiculo.tipo === "Moto";
  const articulo = esMoto ? "la" : "el";
  const emoji = esMoto ? "🏍️" : "🚗";
  return (
    base +
    encodeURIComponent(
      `Hola, te escribo desde Instagram 📲. Me interesa ${articulo} ${vehiculo.nombre} ${emoji}. ¿Sigue disponible?`,
    )
  );
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
