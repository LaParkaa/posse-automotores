import { requireAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { getPlanesFinanciacion } from "@/lib/creditos/data";
import { actualizarPlan, crearPlan, eliminarPlan } from "./actions";
import { PlanForm } from "./plan-form";
import { EliminarPlanButton } from "./eliminar-plan-button";

export const dynamic = "force-dynamic";

export default async function TasasPage() {
  await requireAdminSession();
  const planes = await getPlanesFinanciacion();

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Configurador de tasas</h1>
        <p className="mt-1 text-sm text-car-muted">Actualizá las líneas de crédito sin tocar código</p>
      </div>

      <div className="space-y-4">
        {planes.map((plan) => (
          <div key={plan.id} className="rounded-lg border border-white/10 bg-car-gray2/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-condensed text-sm font-bold uppercase tracking-wide text-car-gold">{plan.nombre}</span>
              <EliminarPlanButton action={eliminarPlan.bind(null, plan.id)} />
            </div>
            <PlanForm plan={plan} action={actualizarPlan.bind(null, plan.id)} />
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-white/20 bg-car-gray2/30 p-5">
        <h2 className="mb-4 font-condensed text-sm font-bold uppercase tracking-wide text-car-gold">Nuevo plan</h2>
        <PlanForm action={crearPlan} />
      </div>
    </AdminShell>
  );
}
