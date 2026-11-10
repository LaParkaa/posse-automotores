/** Cómo se rotula en /admin/leads el canal por el que llegó un lead. Sin origen (leads viejos) es WhatsApp. */
export function origenDeLead(origen: string | null | undefined): string {
  if (origen === "instagram") return "Instagram";
  if (origen === "web") return "Página web";
  return "WhatsApp";
}
