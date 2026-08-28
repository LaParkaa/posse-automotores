import type { Kpis } from "@/lib/metrics";

function Tarjeta({ etiqueta, valor, detalle, color }: {
  etiqueta: string;
  valor: string;
  detalle: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-car-gray2 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-car-muted">{etiqueta}</p>
      <p className={`font-condensed text-3xl font-black italic leading-none ${color}`}>{valor}</p>
      <p className="mt-0.5 text-[11px] text-car-muted">{detalle}</p>
    </div>
  );
}

export function KpiHeader({ kpis }: { kpis: Kpis }) {
  const { deltaSemana } = kpis;
  const signo = deltaSemana > 0 ? "▲" : deltaSemana < 0 ? "▼" : "=";
  const colorDelta =
    deltaSemana > 0 ? "text-emerald-400" : deltaSemana < 0 ? "text-red-400" : "text-car-muted";

  return (
    <div className="grid grid-cols-3 gap-2">
      <Tarjeta
        etiqueta="Stock"
        valor={String(kpis.stockActivo)}
        detalle={`${kpis.disponibles} disp · ${kpis.reservados} res`}
        color="text-car-white"
      />
      <Tarjeta
        etiqueta="Semana"
        valor={String(kpis.vendidosSemana)}
        detalle={`${signo} ${Math.abs(deltaSemana)} vs anterior`}
        color={colorDelta}
      />
      <Tarjeta
        etiqueta="Rotación"
        valor={kpis.rotacionDias === null ? "—" : `${kpis.rotacionDias}`}
        detalle={kpis.rotacionDias === null ? "sin datos" : "días promedio"}
        color="text-car-gold"
      />
    </div>
  );
}
