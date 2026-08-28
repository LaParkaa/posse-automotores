import { requireAdminSession } from "@/lib/auth";
import { getAllVehiculos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  await requireAdminSession();
  const vehiculos = await getAllVehiculos();

  return (
    <main className="p-6">
      <p className="text-car-muted">Panel · {vehiculos.length} vehículos cargados</p>
    </main>
  );
}
