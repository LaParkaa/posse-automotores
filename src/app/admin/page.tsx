import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { countVehiculos } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminSession();
  const counts = await countVehiculos();

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Dashboard</h1>
        <p className="mt-1 text-sm text-car-muted">
          Panel de administración — Posse Automotores
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          { label: "Total vehículos", value: counts.total, color: "text-car-white" },
          { label: "Disponibles", value: counts.disponibles, color: "text-emerald-400" },
          { label: "Vendidos", value: counts.vendidos, color: "text-car-gold" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-white/10 bg-car-gray2 p-6">
            <p className="text-sm text-car-muted">{label}</p>
            <p className={`mt-2 font-condensed text-5xl font-black italic ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Link
          href="/admin/vehiculos/nuevo"
          className="inline-flex items-center gap-2 rounded bg-car-gold px-5 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
        >
          + Agregar vehículo
        </Link>
      </div>
    </AdminShell>
  );
}
