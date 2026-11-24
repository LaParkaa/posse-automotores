import { KeyRound } from "lucide-react";
import { formatearPatente, type VehiculoLlave } from "@/lib/llaves/consulta";

const ESTADO: Record<VehiculoLlave["estado"], { texto: string; color: string } | null> = {
  disponible: null,
  reservado: { texto: "Reservado", color: "bg-amber-400 text-car-black" },
  vendido: null,
};

/** La patente con aspecto de chapa: fondo claro, letras de molde y una franja azul arriba. */
export function Placa({ patente, grande = false }: { patente: string; grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-[5px] border-t-[3px] border-t-blue-700 bg-slate-100 font-mono font-bold uppercase leading-none text-slate-900 shadow-sm ${
        grande ? "px-2.5 py-1.5 text-sm tracking-[0.18em]" : "px-1.5 py-1 text-[11px] tracking-wider"
      }`}
    >
      {formatearPatente(patente)}
    </span>
  );
}

/** Fondo de las fotos de llaves: un foco de luz dorado que las separa del negro. */
export const FONDO_LLAVE = "bg-car-gray2 [background-image:radial-gradient(circle_at_50%_38%,rgba(201,162,39,0.24),transparent_64%)]";

export function LlaveCard({ vehiculo, onAbrir }: { vehiculo: VehiculoLlave; onAbrir: () => void }) {
  const etiqueta = ESTADO[vehiculo.estado];

  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Ver la llave de ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`}
        className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-car-gray text-left shadow-lg shadow-black/30 transition duration-150 active:scale-[0.97] hover:border-car-gold/40"
      >
        <div className={`relative aspect-[4/3] ${FONDO_LLAVE}`}>
          {vehiculo.key_image_url ? (
            <img
              src={vehiculo.key_image_url}
              alt={`Llave de ${vehiculo.marca} ${vehiculo.modelo}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-contain p-4 drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)] transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-3 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 text-car-muted">
              <KeyRound size={30} strokeWidth={1.5} className="text-car-gold/70" />
              <span className="text-[11px] font-bold uppercase tracking-wide">Sin foto de llave</span>
            </div>
          )}

          {vehiculo.cover_image_url && (
            <img
              src={vehiculo.cover_image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute left-2 top-2 size-9 rounded-full object-cover ring-2 ring-car-black/90"
            />
          )}

          {etiqueta && (
            <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${etiqueta.color}`}>
              {etiqueta.texto}
            </span>
          )}
        </div>

        <div className="space-y-1.5 p-3">
          <p className="truncate font-condensed text-[17px] font-black italic leading-none text-car-white">
            {vehiculo.marca} {vehiculo.modelo}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-condensed text-sm font-bold text-car-gold">{vehiculo.anio}</span>
            {vehiculo.patente ? (
              <Placa patente={vehiculo.patente} />
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wide text-car-muted/70">Sin patente</span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
