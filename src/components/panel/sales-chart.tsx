"use client";
import { useMemo, useState } from "react";
import { getSerieVentas, type Rango } from "@/lib/metrics";
import type { Vehiculo } from "@/lib/types";

const RANGOS: { valor: Rango; texto: string }[] = [
  { valor: "dia", texto: "30 días" },
  { valor: "semana", texto: "12 sem" },
  { valor: "mes", texto: "12 meses" },
];

// Coordenadas del viewBox. El SVG escala solo al ancho del teléfono.
const ANCHO = 320;
const ALTO = 140;
const BASE = 118; // línea del eje X

export function SalesChart({ vehiculos, ahora }: { vehiculos: Vehiculo[]; ahora: string }) {
  const [rango, setRango] = useState<Rango>("semana");
  const [seleccion, setSeleccion] = useState<number | null>(null);

  const serie = useMemo(() => getSerieVentas(vehiculos, rango, ahora), [vehiculos, rango, ahora]);
  const total = serie.reduce((s, b) => s + b.total, 0);
  const maximo = Math.max(1, ...serie.map((b) => b.total));

  const paso = ANCHO / serie.length;
  const anchoBarra = Math.max(3, paso * 0.6);
  const activo = seleccion === null ? null : serie[seleccion];

  return (
    <section className="rounded-lg border border-white/10 bg-car-gray p-4">
      <div className="flex items-center justify-between">
        <p className="font-condensed text-lg font-black italic text-car-white">Ventas</p>
        <div className="flex gap-1">
          {RANGOS.map(({ valor, texto }) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setRango(valor);
                setSeleccion(null);
              }}
              className={`min-h-11 rounded-full px-3 text-xs font-bold uppercase tracking-wide transition ${
                rango === valor ? "bg-car-gold text-car-black" : "bg-car-gray2 text-car-muted"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-sm text-car-muted">
        {activo
          ? `${activo.label}: ${activo.total} ${activo.total === 1 ? "venta" : "ventas"}`
          : `${total} ${total === 1 ? "venta" : "ventas"} en el período`}
      </p>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-car-muted">
          Sin ventas registradas en este período.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Ventas por período: ${total} en total`}
        >
          <line x1="0" y1={BASE} x2={ANCHO} y2={BASE} stroke="#ffffff" strokeOpacity="0.15" />

          {serie.map((bucket, i) => {
            const altura = (bucket.total / maximo) * (BASE - 12);
            const x = i * paso + (paso - anchoBarra) / 2;
            const seleccionado = seleccion === i;
            return (
              <g key={bucket.key}>
                {/* Zona táctil de toda la columna: la barra sola sería muy fina. */}
                <rect
                  x={i * paso}
                  y="0"
                  width={paso}
                  height={BASE}
                  fill="transparent"
                  onClick={() => setSeleccion(seleccionado ? null : i)}
                />
                <rect
                  x={x}
                  y={BASE - altura}
                  width={anchoBarra}
                  height={altura}
                  rx="1.5"
                  fill={seleccionado ? "#C9A227" : "#34d399"}
                  pointerEvents="none"
                />
              </g>
            );
          })}

          {serie.map((bucket, i) =>
            // Solo algunas etiquetas: 30 no entran en el ancho de un teléfono.
            // Se cuenta desde la más nueva para que el período actual —el que
            // más se mira— siempre quede rotulado.
            (serie.length - 1 - i) % Math.ceil(serie.length / 6) === 0 ? (
              <text
                key={bucket.key}
                x={i * paso + paso / 2}
                y={ALTO - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#7a8aaa"
              >
                {bucket.label}
              </text>
            ) : null
          )}
        </svg>
      )}
    </section>
  );
}
