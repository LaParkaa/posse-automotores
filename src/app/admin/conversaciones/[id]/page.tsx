import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ChatConversacion } from "@/components/chat-conversacion";
import { EnviarCardAuto } from "@/components/enviar-card-auto";
import { requireAdminSession } from "@/lib/auth";
import { obtenerCatalogo } from "@/lib/bot/catalogo";
import { dejoDatos, traerChat, traerPerfil } from "@/lib/bot-datos";
import { esCierrePostulacion, fechaHora, nombreDeConversacion } from "@/lib/conversaciones";
import { createAdminSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// El id de Instagram es solo números: cualquier otra cosa en la dirección no es una conversación.
const ID_INSTAGRAM = /^\d{5,30}$/;

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
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
