import type { Vehiculo } from "@/lib/types";

export function formatPrice(precioTexto: string): string {
  return precioTexto;
}

export function buildWhatsAppUrl(
  vehiculo: Pick<Vehiculo, "nombre" | "tipo" | "promocionado_reel">
): string {
  const base = "https://wa.me/5493537662444?text=";
  const esMoto = vehiculo.tipo === "Moto";
  const articulo = esMoto ? "la" : "el";
  const emoji = esMoto ? "🏍️" : "🚗";
  const msg = vehiculo.promocionado_reel
    ? `Hola, vi el Reel de ${articulo} ${vehiculo.nombre} ${emoji}🎥 y entré a la web. ¡Quiero más info!`
    : `Hola, vengo desde el catálogo web 💻. Me interesa ${articulo} ${vehiculo.nombre} ${emoji}. ¿Sigue disponible?`;
  return base + encodeURIComponent(msg);
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
