import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { EstadoBadge } from "@/components/creditos/estado-badge";
import { getCatalogoVehiculosRef, getOperacionCreditoById, getPlanesFinanciacion, getRecibosDeOperacion } from "@/lib/creditos/data";
import { slugDeTipoDocumento } from "@/lib/creditos/documentos";
import type { MedioPago, TipoDocumento } from "@/lib/creditos/types";
import { actualizarOperacion, generarDocumento } from "./actions";
import { OperacionEditor } from "./editor";
import { GenerarDocumentoForm } from "./generar-documento";

export const dynamic = "force-dynamic";

export default async function OperacionCreditoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const [operacion, planes, recibos, catalogoRef] = await Promise.all([
    getOperacionCreditoById(id),
    getPlanesFinanciacion(),
    getRecibosDeOperacion(id),
    getCatalogoVehiculosRef(),
  ]);

  if (!operacion) notFound();

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-condensed text-3xl font-black italic text-car-white">{operacion.cliente_nombre}</h1>
            <EstadoBadge estado={operacion.estado} />
          </div>
          <p className="mt-1 text-sm text-car-muted">{operacion.vehiculo_descripcion ?? "Sin vehículo asignado"}</p>
        </div>
        <Link href="/admin/creditos" className="text-sm font-semibold text-car-gold hover:underline">
          ← Volver a Créditos
        </Link>
      </div>

      <div className="mb-8">
        <OperacionEditor operacion={operacion} planes={planes} catalogoRef={catalogoRef} action={actualizarOperacion.bind(null, id)} />
      </div>

      <div className="rounded-lg border border-white/10 bg-car-gray2/60 p-5">
        <h2 className="mb-4 font-condensed text-sm font-bold uppercase tracking-wide text-car-gold">
          Documentación comercial
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          <GenerarDocumentoForm
            action={async (tipoDocumento: TipoDocumento, monto: number | null, medioPago: MedioPago | null) => {
              "use server";
              await generarDocumento(id, tipoDocumento, monto, medioPago);
            }}
          />
          <Link
            href={`/admin/creditos/${id}/imprimir/legajo`}
            target="_blank"
            className="rounded border border-white/15 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-car-white transition hover:border-car-gold hover:text-car-gold"
          >
            Solicitud de crédito / Legajo
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto rounded border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-car-muted">
                <th className="px-4 py-2 text-left">Nº Comprobante</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Monto</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recibos.map((r) => (
                <tr key={r.id} className="border-b border-white/5 text-car-white/90">
                  <td className="px-4 py-2 font-mono text-xs">{r.numero_comprobante}</td>
                  <td className="px-4 py-2">{r.tipo_documento}</td>
                  <td className="px-4 py-2">{r.monto != null ? r.monto.toLocaleString("es-AR") : "—"}</td>
                  <td className="px-4 py-2 text-xs text-car-muted">{new Date(r.fecha).toLocaleDateString("es-AR")}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/creditos/${id}/imprimir/${slugDeTipoDocumento(r.tipo_documento)}?recibo=${r.id}`}
                      target="_blank"
                      className="font-semibold text-car-gold hover:underline"
                    >
                      Ver / Imprimir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recibos.length === 0 && (
            <p className="py-6 text-center text-sm text-car-muted">Todavía no se generó ningún documento.</p>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
