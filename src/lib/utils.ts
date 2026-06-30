export function formatPrice(precioTexto: string): string {
  return precioTexto;
}

export function buildWhatsAppUrl(nombre: string, anio: number, context: "card" | "ficha" = "card"): string {
  const base = "https://wa.me/5493537662444?text=";
  const msg =
    context === "ficha"
      ? `Hola, me interesa el ${nombre} ${anio}, ¿está disponible?`
      : `Hola, quiero consultar el ${nombre} ${anio}`;
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
