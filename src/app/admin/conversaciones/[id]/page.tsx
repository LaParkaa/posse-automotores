import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ChatConversacion } from "@/components/chat-conversacion";
import { EnviarCardAuto } from "@/components/enviar-card-auto";
import { requireAdminSession } from "@/lib/auth";
import { obtenerCatalogo } from "@/lib/bot/catalogo";
import { dejoDatos, dejoDatosWeb, traerChat, traerChatWeb, traerPerfil } from "@/lib/bot-datos";
import { esCierrePostulacion, fechaHora, nombreDeConversacion } from "@/lib/conversaciones";
import { canalDeUrl, esIdVisitante, mensajesWebComoIg, ultimoAutoConsultado } from "@/lib/conversaciones-canal";
import { createAdminSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// El id de Instagram es solo números: cualquier otra cosa en la dirección no es una conversación.
const ID_INSTAGRAM = /^\d{5,30}$/;

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ canal?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const { canal } = await searchParams;
  if (canalDeUrl(canal) === "web") return <ChatWeb id={id} />;
  if (!ID_INSTAGRAM.test(id)) notFound();

  const db = createAdminSupabaseClient();
  const [mensajes, perfil, conDatos, catalogo] = await Promise.all([
    traerChat(db, id),
    traerPerfil(db, id),
    dejoDatos(db, id),
    obtenerCatalogo(db),
  ]);
  const enVenta = (catalogo ?? [])
    .filter((v) => v.estado !== "vendido")
    .map((v) => ({ id: v.id, nombre: v.nombre, anio: v.anio }));
  if (mensajes.length === 0) notFound();

  const nombre = nombreDeConversacion(id, perfil);
  const noEntendidos = mensajes.filter((m) => m.role === "user" && m.nota === "no_entendido").length;
  const postulo = mensajes.some((m) => m.role === "assistant" && esCierrePostulacion(m.content));

  return (
    <AdminShell>
      <Link href="/admin/conversaciones" className="text-sm font-semibold text-car-gold underline">
        ← Todas las conversaciones
      </Link>

      <div className="mb-6 mt-3">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">{nombre}</h1>
        <p className="mt-1 text-sm text-car-muted">
          {perfil?.usuario ? `@${perfil.usuario} · ` : ""}
          {mensajes.length} mensajes · del {fechaHora(mensajes[0].created_at)} al {fechaHora(mensajes[mensajes.length - 1].created_at)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
          {conDatos && <span className="rounded-full border border-[#25D366]/40 px-2 py-0.5 text-[#25D366]">Dejó sus datos (ver en Leads)</span>}
          {postulo && <span className="rounded-full border border-car-gold/50 px-2 py-0.5 text-car-gold">Postulación completa</span>}
          {noEntendidos > 0 && (
            <span className="rounded-full border border-red-400/50 px-2 py-0.5 text-red-300">
              El bot no entendió {noEntendidos > 1 ? `${noEntendidos} veces` : "1 vez"}
            </span>
          )}
        </div>
      </div>

      <EnviarCardAuto igUserId={id} autos={enVenta} />

      <div className="rounded-lg border border-white/10 bg-car-black p-4 sm:p-6">
        <ChatConversacion mensajes={mensajes} />
      </div>
      <p className="mt-4 text-xs leading-5 text-car-muted">
        Lo que Marcos escribe a mano desde Instagram no se guarda acá: si contestó, esa parte no aparece.
      </p>
    </AdminShell>
  );
}

/** El chat de un visitante de la página: sin nombre ni @usuario, y sin enviar tarjetas (no hay a quién). */
async function ChatWeb({ id }: { id: string }) {
  if (!esIdVisitante(id)) notFound();

  const db = createAdminSupabaseClient();
  let filas;
  try {
    filas = await traerChatWeb(db, id);
  } catch (e) {
    console.error("[conversaciones] Web:", e instanceof Error ? e.message : e);
    return (
      <AdminShell>
        <Link href="/admin/conversaciones?canal=web" className="text-sm font-semibold text-car-gold underline">
          ← Todas las conversaciones
        </Link>
        <p className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          No se pudo leer la conversación. Probá recargar la página en un momento.
        </p>
      </AdminShell>
    );
  }
  if (filas.length === 0) notFound();

  const mensajes = mensajesWebComoIg(filas);
  const slug = ultimoAutoConsultado(filas);
  // El nombre del auto es solo un adorno: si no se puede leer, se muestra la dirección y la página sigue.
  let auto: string | null = slug;
  if (slug) {
    try {
      const { data } = await db.from("vehiculos_posse").select("nombre").eq("slug", slug).maybeSingle();
      if (data?.nombre) auto = String(data.nombre).trim() || slug;
    } catch (e) {
      console.error("[conversaciones] Nombre del auto:", e instanceof Error ? e.message : e);
    }
  }
  // Si no se puede saber, la etiqueta simplemente no se muestra.
  const conDatos = await dejoDatosWeb(db, id).catch((e: unknown) => {
    console.error("[conversaciones] Leads:", e instanceof Error ? e.message : e);
    return false;
  });
  const noEntendidos = filas.filter((m) => m.role === "user" && m.nota === "no_entendido").length;
  const armoMensaje = filas.some((m) => m.tipo === "cierre");

  return (
    <AdminShell>
      <Link href="/admin/conversaciones?canal=web" className="text-sm font-semibold text-car-gold underline">
        ← Todas las conversaciones
      </Link>

      <div className="mb-6 mt-3">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Visitante</h1>
        <p className="mt-1 text-sm text-car-muted">
          {auto ? `Consultó: ${auto} · ` : ""}
          {mensajes.length} mensajes · del {fechaHora(mensajes[0].created_at)} al {fechaHora(mensajes[mensajes.length - 1].created_at)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
          {conDatos && <span className="rounded-full border border-[#25D366]/40 px-2 py-0.5 text-[#25D366]">Dejó sus datos (ver en Leads)</span>}
          {armoMensaje && (
            <span className="rounded-full border border-car-gold/50 px-2 py-0.5 text-car-gold">Armó el mensaje para Marcos</span>
          )}
          {noEntendidos > 0 && (
            <span className="rounded-full border border-red-400/50 px-2 py-0.5 text-red-300">
              El asistente no entendió {noEntendidos > 1 ? `${noEntendidos} veces` : "1 vez"}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-car-black p-4 sm:p-6">
        <ChatConversacion mensajes={mensajes} canal="web" />
      </div>
      <p className="mt-4 text-xs leading-5 text-car-muted">
        Esta pantalla es solo de lectura. Lo que dejó el visitante (nombre y teléfono) está en Leads.
      </p>
    </AdminShell>
  );
}
