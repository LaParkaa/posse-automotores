import { requireAdminSession } from "@/lib/auth";
import { getAllVehiculos } from "@/lib/data";
import { PanelApp } from "@/components/panel/panel-app";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  await requireAdminSession();
  const vehiculos = await getAllVehiculos();

  // La hora se fija en el servidor para que los KPIs no cambien entre el
  // render del servidor y el del cliente.
  return <PanelApp vehiculos={vehiculos} ahora={new Date().toISOString()} />;
}
