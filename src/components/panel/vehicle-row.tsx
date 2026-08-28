import type { EstadoVehiculo, Vehiculo } from "@/lib/types";

const OPCIONES: { estado: EstadoVehiculo; texto: string; activo: string }[] = [
  { estado: "disponible", texto: "Disp", activo: "bg-emerald-500 text-car-black" },
  { estado: "reservado", texto: "Res", activo: "bg-amber-400 text-car-black" },
  { estado: "vendido", texto: "Vend", activo: "bg-car-gold text-car-black" },
];

export function VehicleRow({
  vehiculo,
  onEstado,
  pendiente,
}: {
  vehiculo: Vehiculo;
  onEstado: (estado: EstadoVehiculo) => void;
  pendiente: boolean;
}) {
  return (
    <li
      className={`overflow-hidden rounded-lg border border-white/10 bg-car-gray transition-opacity ${
        pendiente ? "opacity-50" : ""
      }`}
    >
      <div className="flex gap-3 p-3">
        {vehiculo.cover_image_url ? (
          <img
            src={vehiculo.cover_image_url}
            alt=""
            className="size-16 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded bg-car-gray2 text-[10px] text-car-muted">
            Sin foto
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-condensed text-base font-black italic leading-tight text-car-white">
            {vehiculo.nombre}
          </p>
          <p className="text-xs text-car-muted">
            {vehiculo.marca} · {vehiculo.anio}
          </p>
          <p className="font-condensed text-base font-bold text-car-gold">{vehiculo.precio_texto}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/10">
        {OPCIONES.map(({ estado, texto, activo }) => {
          const seleccionado = vehiculo.estado === estado;
          return (
            <button
              key={estado}
              type="button"
              disabled={pendiente}
              onClick={() => onEstado(estado)}
              aria-pressed={seleccionado}
              className={`min-h-11 text-sm font-bold uppercase tracking-wide transition ${
                seleccionado ? activo : "bg-car-gray text-car-muted active:bg-car-gray2"
              }`}
            >
              {texto}
            </button>
          );
        })}
      </div>
    </li>
  );
}
