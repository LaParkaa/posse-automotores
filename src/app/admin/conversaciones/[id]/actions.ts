"use server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { obtenerCatalogo } from "@/lib/bot/catalogo";
import { guardarSalida } from "@/lib/bot/conversations";
import { NEGOCIO } from "@/lib/bot/negocio";
import { tarjetaDe } from "@/lib/bot/respuestas";
import { enviarTarjetas } from "@/lib/instagram/graph";
import { createAdminSupabaseClient } from "@/lib/supabase";

export type ResultadoEnvio = { ok: true } | { ok: false; error: string };

const ID_INSTAGRAM = /^\d{5,30}$/;

/**
 * Manda a mano la misma tarjeta que arma el bot. Se registra como salida del bot para que el
 * eco de Meta no se confunda con una persona escribiendo (eso pausaría el bot 6 horas).
 */
export async function enviarCardAuto(igUserId: string, vehiculoId: string): Promise<ResultadoEnvio> {
  await requireAdminSession();
  if (!ID_INSTAGRAM.test(igUserId)) return { ok: false, error: "Conversación inválida" };

  const db = createAdminSupabaseClient();
  const catalogo = await obtenerCatalogo(db);
  const vehiculo = catalogo?.find((v) => v.id === vehiculoId && v.estado !== "vendido");
  if (!vehiculo) return { ok: false, error: "Ese auto no está en venta en la web" };

  const tarjeta = tarjetaDe(vehiculo, { negocio: NEGOCIO, siteUrl: process.env.SITE_URL ?? "" });
  let mids: string[];
  try {
    mids = await enviarTarjetas(igUserId, [tarjeta]);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    // Meta solo deja responder dentro de las 24 h desde el último mensaje del cliente.
    const fueraDeVentana = /outside of allowed window|2018278/i.test(detalle);
    return {
      ok: false,
      error: fueraDeVentana
        ? "Pasaron más de 24 h desde el último mensaje del cliente: Instagram no deja mandarle la card."
        : `Instagram rechazó la card: ${detalle}`,
    };
  }

  const texto = `[Card] ${tarjeta.titulo} · ${tarjeta.subtitulo}`;
  await guardarSalida(db, igUserId, mids.length > 0 ? mids.map((mid) => ({ texto, mid })) : [{ texto, mid: null }]).catch(
    (e) => console.error("[admin] No se pudo registrar la card enviada:", e)
  );

  revalidatePath(`/admin/conversaciones/${igUserId}`);
  return { ok: true };
}
