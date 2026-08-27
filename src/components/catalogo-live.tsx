"use client";
import { VehicleCard } from "@/components/vehicle-card";
import { useVehiculosRealtime } from "@/lib/use-vehiculos-realtime";
import type { Vehiculo } from "@/lib/types";

/**
 * Grilla del catálogo público: recibe lo que renderizó el servidor y vuelve a
 * renderizar cuando cambia el stock. Filtra los vendidos, que tienen su propia
 * sección.
 */
export function CatalogoLive({
  vehiculos,
  className,
  vacio,
}: {
  vehiculos: Vehiculo[];
  className: string;
  vacio?: React.ReactNode;
}) {
  const vivos = useVehiculosRealtime(vehiculos);
  const publicables = vivos.filter((v) => v.estado !== "vendido" && v.deleted_at === null);

  if (publicables.length === 0) return <>{vacio ?? null}</>;

  return (
    <div className={className}>
      {publicables.map((v) => (
        <VehicleCard key={v.id} vehiculo={v} />
      ))}
    </div>
  );
}
