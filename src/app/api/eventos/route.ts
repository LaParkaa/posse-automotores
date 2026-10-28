import { dispositivoDe, esRobot, validarEvento } from "@/lib/eventos";
import { createAdminSupabaseClient } from "@/lib/supabase";

// Un evento ocupa menos de 500 bytes: un cuerpo mayor es otra cosa.
const MAX_BYTES = 2000;

/**
 * Recibe las visitas y clics del sitio (ver Rastreador). Siempre contesta 204: a quien mide no le importa si se
 * guardó, y así tampoco se le dice a un curioso qué se acepta y qué no.
 */
export async function POST(request: Request) {
  const sinContenido = () => new Response(null, { status: 204 });

  try {
    const userAgent = request.headers.get("user-agent");
    if (esRobot(userAgent)) return sinContenido();

    const texto = await request.text();
    if (texto.length > MAX_BYTES) return sinContenido();

    const evento = validarEvento(JSON.parse(texto));
    if (!evento) return sinContenido();

    const { error } = await createAdminSupabaseClient()
      .from("eventos")
      .insert({
        tipo: evento.tipo,
        ruta: evento.ruta,
        vehiculo_slug: evento.vehiculo_slug,
        visitante: evento.visitante,
        origen: evento.origen,
        dispositivo: dispositivoDe(userAgent),
      });
    // Sin la tabla creada (supabase/schema-eventos.sql) falla en cada visita: se anota y listo.
    if (error) console.error("[eventos] No se pudo guardar:", error.message);
  } catch (e) {
    console.error("[eventos] Pedido invalido o fallo al guardar:", e instanceof Error ? e.message : e);
  }
  return sinContenido();
}
