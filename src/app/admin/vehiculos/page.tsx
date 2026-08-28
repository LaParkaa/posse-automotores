import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { getAllVehiculos } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";
import { toggleEstado } from "./actions";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

/** Estilo y texto del botón de estado, por cada uno de los tres estados posibles. */
const ESTADO_UI: Record<string, { clases: string; label: string }> = {
  disponible: {
    clases: "bg-emerald-900/50 text-emerald-400 active:bg-emerald-900/70",
    label: "Disponible · tocá para marcar vendido",
  },
  reservado: {
    clases: "bg-amber-900/40 text-amber-400 active:bg-amber-900/60",
    label: "Reservado · tocá para marcar vendido",
  },
  vendido: {
    clases: "bg-car-gold/15 text-car-gold active:bg-car-gold/25",
    label: "Vendido · tocá para reactivar",
  },
};

export default async function AdminVehiculosPage() {
  await requireAdminSession();
  const vehiculos = await getAllVehiculos();

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Vehículos</h1>
        <Link
          href="/admin/vehiculos/nuevo"
          className="rounded bg-car-gold px-4 py-2.5 text-sm font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
        >
          + Agregar
        </Link>
      </div>

      {vehiculos.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-car-gray py-10 text-center text-car-muted">
          No hay vehículos cargados aún.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehiculos.map((v) => (
            <div
              key={v.id}
              className="overflow-hidden rounded-lg border border-white/10 bg-car-gray"
            >
              {v.cover_image_url ? (
                <img
                  src={v.cover_image_url}
                  alt={v.nombre}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-car-gray2 text-xs text-car-muted">
                  Sin foto
                </div>
              )}

              <div className="p-4">
                <p className="font-condensed text-lg font-black italic leading-tight text-car-white">
                  {v.nombre}
                </p>
                <p className="mt-0.5 text-sm text-car-muted">
                  {v.marca} · {v.anio}
                </p>
                <p className="mt-1 font-condensed text-lg font-bold text-car-gold">
                  {v.precio_texto}
                </p>

                <form action={toggleEstado.bind(null, v.id, v.estado)} className="mt-3">
                  <button
                    type="submit"
                    className={`w-full rounded-full px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition ${
                      (ESTADO_UI[v.estado] ?? ESTADO_UI.disponible).clases
                    }`}
                  >
                    {(ESTADO_UI[v.estado] ?? ESTADO_UI.disponible).label}
                  </button>
                </form>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href={`/admin/vehiculos/${v.id}/editar`}
                    className="rounded border border-white/15 py-2.5 text-center text-sm font-semibold text-car-white transition hover:border-car-gold hover:text-car-gold active:bg-white/5"
                  >
                    Editar
                  </Link>
                  <DeleteButton id={v.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
