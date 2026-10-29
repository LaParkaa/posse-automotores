import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { PERIODOS } from "@/components/estadisticas-vista";
import { ListaConversaciones } from "@/components/lista-conversaciones";
import { ResumenBotVista } from "@/components/resumen-bot";
import { requireAdminSession } from "@/lib/auth";
import { cargarDatosBot, haceDias } from "@/lib/bot-datos";
import { armarConversaciones, filtroDeUrl, resumirBot } from "@/lib/conversaciones";
import { createAdminSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DIAS_POR_DEFECTO = 30;

export default async function ConversacionesPage({ searchParams }: { searchParams: Promise<{ dias?: string; filtro?: string }> }) {
  await requireAdminSession();
  const { dias: diasPedidos, filtro: filtroPedido } = await searchParams;
  const dias = PERIODOS.find((p) => String(p.dias) === diasPedidos)?.dias ?? DIAS_POR_DEFECTO;
  const filtro = filtroDeUrl(filtroPedido);

  let datos;
  try {
    datos = await cargarDatosBot(createAdminSupabaseClient(), dias);
  } catch (e) {
    console.error("[conversaciones]", e instanceof Error ? e.message : e);
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Conversaciones</h1>
        <p className="mt-1 text-sm text-car-muted">Lo que le escriben al bot de Instagram y cómo responde</p>
      </div>

      {!datos ? (
        <p className="rounded-lg border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          No se pudieron leer las conversaciones. Probá recargar la página en un momento.
        </p>
      ) : (
        <div className="space-y-8">
          <nav aria-label="Período" className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <Link
                key={p.dias}
                href={`/admin/conversaciones?dias=${p.dias}&filtro=${filtro}`}
                aria-current={p.dias === dias ? "true" : undefined}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  p.dias === dias ? "border-car-gold bg-car-gold/10 text-car-white" : "border-white/15 text-car-white/70 hover:border-car-gold/50"
                }`}
              >
                Últimos {p.texto}
              </Link>
            ))}
          </nav>

          <ResumenBotVista resumen={resumirBot(datos.mensajes, datos.leads, dias, haceDias(0))} titulo="Cuánta gente capta el bot" />

          {datos.truncado && (
            <p className="rounded border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
              Hay más de 30.000 mensajes en este período: se muestran los más recientes. Probá con un período más corto.
            </p>
          )}

          <ListaConversaciones
            conversaciones={armarConversaciones(
              datos.mensajes,
              datos.perfiles,
              new Set(datos.leads.map((l) => l.instagram_id).filter((id): id is string => id !== null)),
              filtro,
            )}
            filtro={filtro}
            dias={dias}
          />

          <p className="text-xs leading-5 text-car-muted">
            Se ven los mensajes del cliente y las respuestas del bot. Lo que Marcos escribe a mano desde Instagram no se guarda
            acá, así que en esas charlas puede faltar su parte. Esta pantalla es solo de lectura: para contestar, usá Instagram.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
