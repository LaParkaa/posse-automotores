import { AdminShell } from "@/components/admin-shell";
import { AnunciosInstagram } from "@/components/anuncios-instagram";
import { EstadisticasVista, PERIODOS } from "@/components/estadisticas-vista";
import { requireAdminSession } from "@/lib/auth";
import { resumir, type EventoGuardado } from "@/lib/estadisticas";
import { createAdminSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const POR_PAGINA = 1000;
// Tope de seguridad: 50.000 eventos por consulta. Con el tráfico de una concesionaria no se llega.
const MAX_PAGINAS = 50;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_POR_DEFECTO = 30;

/** Instante de hace `dias` días (el reloj se lee acá, fuera del render). */
const haceDias = (dias: number) => new Date(Date.now() - dias * DIA_MS).toISOString();

export default async function EstadisticasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireAdminSession();
  const { dias: diasPedidos } = await searchParams;
  const dias = PERIODOS.find((p) => String(p.dias) === diasPedidos)?.dias ?? DIAS_POR_DEFECTO;

  const supabase = createAdminSupabaseClient();
  // Un día de más por delante: el corte se hace después, en hora argentina.
  const desde = haceDias(dias + 1);

  const eventos: EventoGuardado[] = [];
  let falloTabla = false;
  let truncado = false;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const { data, error } = await supabase
      .from("eventos")
      .select("tipo, vehiculo_slug, visitante, origen, dispositivo, creado")
      .gte("creado", desde)
      .order("creado", { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);
    if (error) {
      falloTabla = true;
      break;
    }
    eventos.push(...(data as EventoGuardado[]));
    if (data.length < POR_PAGINA) break;
    if (pagina === MAX_PAGINAS - 1) truncado = true;
  }

  const { data: autos } = await supabase.from("vehiculos_posse").select("slug, nombre").is("deleted_at", null);
  const resumen = resumir(
    eventos,
    (autos ?? []).map((a) => ({ slug: a.slug as string, nombre: String(a.nombre).trim() })),
    dias,
    haceDias(0),
  );

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Estadísticas</h1>
        <p className="mt-1 text-sm text-car-muted">Cuánta gente entra al sitio y con qué autos consulta</p>
      </div>

      {falloTabla ? (
        <div className="rounded-lg border border-car-gold/40 bg-car-gold/10 p-5 text-sm leading-6 text-car-white/90">
          <p className="font-semibold text-car-gold">Falta crear la tabla de estadísticas</p>
          <p className="mt-2">
            Abrí el SQL Editor de Supabase, pegá el contenido del archivo <code className="rounded bg-black/30 px-1">supabase/schema-eventos.sql</code>{" "}
            y tocá Run. Después de eso, el sitio empieza a juntar los datos solo.
          </p>
        </div>
      ) : (
        <>
          {truncado && (
            <p className="mb-4 rounded border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
              Hay más de 50.000 eventos en este período: se muestran los más recientes. Probá con un período más corto.
            </p>
          )}
          <EstadisticasVista resumen={resumen} dias={dias} />
        </>
      )}

      <AnunciosInstagram />
    </AdminShell>
  );
}
