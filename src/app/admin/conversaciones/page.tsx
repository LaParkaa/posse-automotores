import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { PERIODOS } from "@/components/estadisticas-vista";
import { ListaConversaciones } from "@/components/lista-conversaciones";
import { ResumenBotVista } from "@/components/resumen-bot";
import { ResumenBotWebVista } from "@/components/resumen-bot-web";
import { requireAdminSession } from "@/lib/auth";
import { armarConversacionesWeb, resumirBotWeb } from "@/lib/bot/web/estadisticas";
import { cargarDatosBot, cargarDatosWeb, haceDias } from "@/lib/bot-datos";
import { armarConversaciones, filtroDeUrl, resumirBot, ventanaDeDias } from "@/lib/conversaciones";
import { canalDeUrl, filtrarConversacionesWeb, filtroParaCanal, hrefConversaciones, type Canal } from "@/lib/conversaciones-canal";
import { createAdminSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DIAS_POR_DEFECTO = 30;

const CANALES: Array<{ valor: Canal; texto: string }> = [
  { valor: "instagram", texto: "Instagram" },
  { valor: "web", texto: "Página web" },
];

export default async function ConversacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; filtro?: string; canal?: string }>;
}) {
  await requireAdminSession();
  const { dias: diasPedidos, filtro: filtroPedido, canal: canalPedido } = await searchParams;
  const dias = PERIODOS.find((p) => String(p.dias) === diasPedidos)?.dias ?? DIAS_POR_DEFECTO;
  const canal = canalDeUrl(canalPedido);
  // Algunos filtros son solo de Instagram (por ejemplo "Postulaciones"): en la página valen como "todas".
  const filtro = filtroParaCanal(filtroDeUrl(filtroPedido), canal);

  const db = createAdminSupabaseClient();
  let datos;
  let datosWeb;
  let nombresAutos: Record<string, string> = {};
  try {
    if (canal === "web") {
      datosWeb = await cargarDatosWeb(db, dias);
    } else {
      datos = await cargarDatosBot(db, dias);
    }
  } catch (e) {
    console.error("[conversaciones]", e instanceof Error ? e.message : e);
  }
  // Solo para mostrar el nombre del auto en vez de su dirección: si falla (o no hay nombre), se muestra la dirección.
  if (datosWeb) {
    try {
      const { data: autos } = await db.from("vehiculos_posse").select("slug, nombre").is("deleted_at", null);
      nombresAutos = Object.fromEntries((autos ?? []).map((a) => [a.slug as string, a.nombre ? String(a.nombre).trim() : (a.slug as string)]));
    } catch (e) {
      console.error("[conversaciones] Nombres de autos:", e instanceof Error ? e.message : e);
    }
  }
  const leido = canal === "web" ? datosWeb : datos;
  const ahora = haceDias(0);
  const enVentana = ventanaDeDias(dias, ahora).enVentana;

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Conversaciones</h1>
        <p className="mt-1 text-sm text-car-muted">
          {canal === "web" ? "Lo que le escriben al asistente de la página y cómo responde" : "Lo que le escriben al bot de Instagram y cómo responde"}
        </p>
      </div>

      <nav aria-label="Canal" className="mb-6 flex gap-6 border-b border-white/10">
        {CANALES.map((c) => (
          <Link
            key={c.valor}
            href={hrefConversaciones({ dias, filtro, canal: c.valor })}
            aria-current={c.valor === canal ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-semibold transition ${
              c.valor === canal ? "border-car-gold text-car-white" : "border-transparent text-car-white/60 hover:text-car-white"
            }`}
          >
            {c.texto}
          </Link>
        ))}
      </nav>

      {!leido ? (
        <p className="rounded-lg border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          No se pudieron leer las conversaciones. Probá recargar la página en un momento.
        </p>
      ) : (
        <div className="space-y-8">
          <nav aria-label="Período" className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <Link
                key={p.dias}
                href={hrefConversaciones({ dias: p.dias, filtro, canal })}
                aria-current={p.dias === dias ? "true" : undefined}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  p.dias === dias ? "border-car-gold bg-car-gold/10 text-car-white" : "border-white/15 text-car-white/70 hover:border-car-gold/50"
                }`}
              >
                Últimos {p.texto}
              </Link>
            ))}
          </nav>

          {datosWeb ? (
            <>
              <ResumenBotWebVista
                resumen={resumirBotWeb({ mensajes: datosWeb.mensajes, eventos: datosWeb.eventos, leadsWeb: datosWeb.leadsWeb, dias, ahora })}
                titulo="Cuánta gente capta el asistente"
                nombresAutos={nombresAutos}
              />

              {datosWeb.truncado && (
                <p className="rounded border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
                  Hay más de 30.000 registros en este período: se muestran los más recientes. Probá con un período más corto.
                </p>
              )}

              <ListaConversaciones
                conversaciones={filtrarConversacionesWeb(
                  armarConversacionesWeb(
                    datosWeb.mensajes.filter((m) => enVentana(m.created_at)),
                    new Set(datosWeb.visitantesConDatos),
                  ),
                  filtro,
                )}
                filtro={filtro}
                dias={dias}
                canal="web"
                nombresAutos={nombresAutos}
              />

              <p className="text-xs leading-5 text-car-muted">
                Se ven los mensajes de los visitantes y las respuestas del asistente. No se guarda la IP ni datos del dispositivo. Esta
                pantalla es solo de lectura: lo que dejan en el chat (nombre y teléfono) está en Leads.
              </p>
            </>
          ) : datos ? (
            <>
              <ResumenBotVista resumen={resumirBot(datos.mensajes, datos.leads, dias, ahora)} titulo="Cuánta gente capta el bot" />

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
            </>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
