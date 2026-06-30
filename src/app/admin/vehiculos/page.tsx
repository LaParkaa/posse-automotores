import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { getAllVehiculos } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";
import { toggleEstado, softDeleteVehiculo } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminVehiculosPage() {
  await requireAdminSession();
  const vehiculos = await getAllVehiculos();

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Vehículos</h1>
        <Link
          href="/admin/vehiculos/nuevo"
          className="rounded bg-car-gold px-4 py-2 text-sm font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
        >
          + Agregar
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-car-gray2 text-xs uppercase tracking-wide text-car-muted">
              <th className="px-4 py-3 text-left">Vehículo</th>
              <th className="px-4 py-3 text-left">Año</th>
              <th className="px-4 py-3 text-left">Precio</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.map((v) => (
              <tr
                key={v.id}
                className="border-b border-white/5 bg-car-gray transition hover:bg-car-gray2"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {v.cover_image_url && (
                      <img
                        src={v.cover_image_url}
                        alt={v.nombre}
                        className="size-12 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-car-white">{v.nombre}</p>
                      <p className="text-xs text-car-muted">{v.marca}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-car-muted">{v.anio}</td>
                <td className="px-4 py-3 text-car-gold">{v.precio_texto}</td>
                <td className="px-4 py-3">
                  <form action={toggleEstado.bind(null, v.id, v.estado)}>
                    <button
                      type="submit"
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        v.estado === "disponible"
                          ? "bg-emerald-900/50 text-emerald-400"
                          : "bg-car-gold/15 text-car-gold"
                      }`}
                    >
                      {v.estado}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/vehiculos/${v.id}/editar`}
                      className="rounded border border-white/15 px-3 py-1 text-xs text-car-white transition hover:border-car-gold hover:text-car-gold"
                    >
                      Editar
                    </Link>
                    <form
                      action={softDeleteVehiculo.bind(null, v.id)}
                      onSubmit={(e) => {
                        if (!confirm("¿Eliminar este vehículo?")) e.preventDefault();
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded border border-red-900 px-3 py-1 text-xs text-red-400 transition hover:bg-red-900/30"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vehiculos.length === 0 && (
          <p className="py-10 text-center text-car-muted">No hay vehículos cargados aún.</p>
        )}
      </div>
    </AdminShell>
  );
}
