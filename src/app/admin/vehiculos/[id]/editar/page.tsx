import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { getVehiculoById } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";
import { updateVehiculo } from "../../form-actions";
import { VehiculoForm } from "../../vehiculo-form";

export const dynamic = "force-dynamic";

export default async function EditarVehiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const vehiculo = await getVehiculoById(id);
  if (!vehiculo) notFound();

  const updateWithId = updateVehiculo.bind(null, id);

  return (
    <AdminShell>
      <h1 className="mb-6 font-condensed text-3xl font-black italic text-car-white">
        Editar vehículo
      </h1>
      <VehiculoForm action={updateWithId} vehiculo={vehiculo} />
    </AdminShell>
  );
}
