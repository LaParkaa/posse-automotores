import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { getKpisCreditos, getOperacionesCredito } from "@/lib/creditos/data";
import { formatARS, formatMoneda } from "@/lib/creditos/formato";
import { urlWhatsAppOperacion } from "@/lib/creditos/mensajes";
import { ESTADOS_OPERACION, type EstadoOperacion } from "@/lib/creditos/types";
import { EstadoBadge } from "@/components/creditos/estado-badge";

export const dynamic = "force-dynamic";

function Kpi({ etiqueta, valor, color }: { etiqueta: string; valor: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-car-gray2 p-6">
      <p className="text-sm text-car-muted">{etiqueta}</p>
      <p className={`mt-2 font-condensed text-4xl font-black italic ${color}`}>{valor}</p>
    </div>
  );
}

export default async function CreditosDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  await requireAdminSession();
  const { estado, q } = await searchParams;
  const estadoFiltro = ESTADOS_OPERACION.includes(estado as EstadoOperacion) ? (estado as EstadoOperacion) : undefined;

  const [kpis, operaciones] = await Promise.all([
    getKpisCreditos(),
    getOperacionesCredito({ estado: estadoFiltro, busqueda: q }),
  ]);

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-condensed text-3xl font-black italic text-car-white">Créditos</h1>
          <p className="mt-1 text-sm text-car-muted">Simulaciones, financiación y documentación comercial</p>
        </div>
        <Link
          href="/admin/creditos/nuevo"
          className="inline-flex items-center gap-2 rounded bg-car-gold px-5 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
        >
          + Nueva operación
        </Link>
      </div>

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <Kpi etiqueta="Simulaciones del mes" valor={String(kpis.simulacionesDelMes)} color="text-car-white" />
        <Kpi etiqueta="Operaciones aprobadas" valor={String(kpis.aprobadas)} color="text-emerald-400" />
        <Kpi etiqueta="Capital total financiado" valor={formatARS(kpis.capitalTotalFinanciado)} color="text-car-gold" />
      </div>

      <form className="mb-4 flex flex-wrap gap-3" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por cliente, DNI o vehículo…"
          className="flex-1 min-w-[220px] rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold"
        />
        <select
          name="estado"
          defaultValue={estadoFiltro ?? ""}
          className="rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_OPERACION.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border border-white/15 bg-car-gray2 px-5 py-2.5 text-sm font-semibold text-car-white transition hover:border-car-gold hover:text-car-gold"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-car-gray2 text-xs uppercase tracking-wide text-car-muted">
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Vehículo</th>
              <th className="px-4 py-3 text-left">Cuota</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {operaciones.map((op) => (
              <tr key={op.id} className="border-b border-white/5 bg-car-gray transition hover:bg-car-gray2">
                <td className="px-4 py-3">
                  <p className="font-semibold text-car-white">{op.cliente_nombre || "—"}</p>
                  <p className="text-xs text-car-muted">{op.cliente_dni_cuil ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-car-muted">{op.vehiculo_descripcion ?? "—"}</td>
                <td className="px-4 py-3 text-car-white">
                  {op.valor_cuota_final ? `${op.plazo_meses}x ${formatMoneda(op.valor_cuota_final, op.moneda)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <EstadoBadge estado={op.estado} />
                </td>
                <td className="px-4 py-3 text-xs text-car-muted">
                  {new Date(op.created_at).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <Link href={`/admin/creditos/${op.id}`} className="font-semibold text-car-gold hover:underline">
                      Ver / Editar
                    </Link>
                    <a
                      href={urlWhatsAppOperacion(op)}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-emerald-400 hover:underline"
                    >
                      WhatsApp
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {operaciones.length === 0 && (
          <p className="py-10 text-center text-car-muted">No hay operaciones que coincidan con el filtro.</p>
        )}
      </div>
    </AdminShell>
  );
}
