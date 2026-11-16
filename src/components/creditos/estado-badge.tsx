import type { EstadoOperacion } from "@/lib/creditos/types";

const COLOR_POR_ESTADO: Record<EstadoOperacion, string> = {
  Simulado: "bg-white/10 text-car-muted",
  "Simulado (Web)": "bg-white/10 text-car-muted",
  "En Evaluación": "bg-amber-900/50 text-amber-400",
  Aprobado: "bg-emerald-900/50 text-emerald-400",
  "Liquidado / Entregado": "bg-car-gold/15 text-car-gold",
  Rechazado: "bg-red-900/50 text-red-400",
};

export function EstadoBadge({ estado }: { estado: EstadoOperacion }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${COLOR_POR_ESTADO[estado]}`}>
      {estado}
    </span>
  );
}
