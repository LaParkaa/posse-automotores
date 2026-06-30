import { requireAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { createVehiculo } from "../form-actions";
import { VehiculoForm } from "../vehiculo-form";

export const dynamic = "force-dynamic";

export default async function NuevoVehiculoPage() {
  await requireAdminSession();
  return (
    <AdminShell>
      <h1 className="mb-6 font-condensed text-3xl font-black italic text-car-white">
        Agregar vehículo
      </h1>
      <VehiculoForm action={createVehiculo} />
    </AdminShell>
  );
}
