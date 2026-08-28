"use client";
import { useMemo, useState } from "react";
import type { EstadoVehiculo, Vehiculo } from "@/lib/types";
import { VehicleRow } from "./vehicle-row";

type Filtro = "todos" | EstadoVehiculo;

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "disponible", texto: "Disponibles" },
  { valor: "reservado", texto: "Reservados" },
  { valor: "vendido", texto: "Vendidos" },
];

export function StockList({
  vehiculos,
  onEstado,
  pendientes,
}: {
  vehiculos: Vehiculo[];
  onEstado: (id: string, estado: EstadoVehiculo) => void;
  pendientes: Set<string>;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return vehiculos.filter((v) => {
      const okFiltro = filtro === "todos" || v.estado === filtro;
      const okBusqueda =
        !termino ||
        `${v.nombre} ${v.marca} ${v.modelo} ${v.anio}`.toLowerCase().includes(termino);
      return okFiltro && okBusqueda;
    });
  }, [vehiculos, filtro, busqueda]);

  return (
    <div>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, marca o año…"
        className="min-h-11 w-full rounded-full border border-white/15 bg-car-gray2 px-4 text-sm text-car-white placeholder:text-car-muted/60 focus:border-car-gold focus:outline-none"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map(({ valor, texto }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            aria-pressed={filtro === valor}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold uppercase tracking-wide transition ${
              filtro === valor
                ? "bg-car-gold text-car-black"
                : "bg-car-gray2 text-car-muted active:bg-white/10"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="py-12 text-center text-sm text-car-muted">
          No hay vehículos que coincidan.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visibles.map((v) => (
            <VehicleRow
              key={v.id}
              vehiculo={v}
              pendiente={pendientes.has(v.id)}
              onEstado={(estado) => onEstado(v.id, estado)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
