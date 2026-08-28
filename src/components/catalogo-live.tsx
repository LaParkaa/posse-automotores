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
  // Esta grilla puede venir recortada (destacados) o filtrada (marca, tipo), y
  // el criterio vive en el servidor. Un auto que llega por realtime no sabe si
  // entra en ese recorte, así que solo seguimos los que el servidor mandó: los
  // cambios de estado se ven en vivo, y un auto nuevo aparece al recargar.
  const delServidor = new Set(vehiculos.map((v) => v.id));
  const publicables = vivos.filter(
    (v) => delServidor.has(v.id) && v.estado !== "vendido" && v.deleted_at === null
  );

  if (publicables.length === 0) return <>{vacio ?? null}</>;

  return (
    <div className={className}>
      {publicables.map((v) => (
        <VehicleCard key={v.id} vehiculo={v} />
      ))}
    </div>
  );
}
