import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadInput } from "./types";

/**
 * Guarda el lead en la tabla que ya lee /admin/leads.
 * Como el modelo no ve sus llamadas a herramientas en el historial, puede volver a
 * llamar a guardar_lead en un mensaje posterior: si el mismo usuario ya dejo ese
 * telefono, no se duplica.
 */
export async function guardarLeadInstagram(
  db: SupabaseClient,
  igUserId: string,
  lead: LeadInput,
): Promise<void> {
  const { data: existentes, error: errorBusqueda } = await db
    .from("leads")
    .select("id")
    .eq("instagram_id", igUserId)
    .eq("telefono", lead.telefono)
    .limit(1);

  if (errorBusqueda) throw new Error(`No se pudo buscar el lead: ${errorBusqueda.message}`);
  if (existentes && existentes.length > 0) return;

  const { error } = await db.from("leads").insert({
    nombre: lead.nombre,
    telefono: lead.telefono,
    vehiculo_interes: lead.vehiculo_interes ?? null,
    mensaje: lead.mensaje ?? null,
    origen: "instagram",
    instagram_id: igUserId,
  });

  if (error) throw new Error(`No se pudo guardar el lead: ${error.message}`);
}
