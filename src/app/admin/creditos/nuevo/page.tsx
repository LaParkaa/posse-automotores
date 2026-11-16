import { requireAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { getAllVehiculos } from "@/lib/data";
import { getCatalogoVehiculosRef, getPlanesFinanciacion } from "@/lib/creditos/data";
import { NuevaOperacionWizard } from "./wizard";
import { crearOperacion } from "./actions";

export const dynamic = "force-dynamic";

export default async function NuevaOperacionPage() {
  await requireAdminSession();

  const [vehiculosStock, catalogoRef, planes] = await Promise.all([
    getAllVehiculos(),
    getCatalogoVehiculosRef(),
    getPlanesFinanciacion(),
  ]);

  const stockDisponible = vehiculosStock.filter((v) => v.estado !== "vendido");

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Nueva operación</h1>
        <p className="mt-1 text-sm text-car-muted">Armá la cotización y cargá los datos del cliente</p>
      </div>
      <NuevaOperacionWizard
        vehiculosStock={stockDisponible}
        catalogoRef={catalogoRef}
        planes={planes.filter((p) => p.activo)}
        action={crearOperacion}
      />
    </AdminShell>
  );
}
