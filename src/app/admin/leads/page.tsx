import { requireAdminSession } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireAdminSession();
  const supabase = createAdminSupabaseClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Leads</h1>
        <p className="mt-1 text-sm text-car-muted">Clientes captados por el bot de WhatsApp</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-car-gray2 text-xs uppercase tracking-wide text-car-muted">
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Interés</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-white/5 bg-car-gray transition hover:bg-car-gray2"
              >
                <td className="px-4 py-3 font-semibold text-car-white">{lead.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-car-muted">
                  <a
                    href={`https://wa.me/${lead.telefono?.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-car-gold"
                  >
                    {lead.telefono ?? lead.whatsapp}
                  </a>
                </td>
                <td className="px-4 py-3 text-car-muted">{lead.vehiculo_interes ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                      lead.estado === "nuevo"
                        ? "bg-emerald-900/50 text-emerald-400"
                        : lead.estado === "contactado"
                        ? "bg-car-gold/15 text-car-gold"
                        : "bg-white/5 text-car-muted"
                    }`}
                  >
                    {lead.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-car-muted">
                  {new Date(lead.created_at).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!leads || leads.length === 0) && (
          <p className="py-10 text-center text-car-muted">
            Aún no hay leads registrados. El bot los captará automáticamente.
          </p>
        )}
      </div>
    </AdminShell>
  );
}
