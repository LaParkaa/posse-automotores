"use client";
import { useState } from "react";
import type { Vehiculo } from "@/lib/types";

/** Hora exacta que se va a registrar, en formato argentino legible. */
function horaAhora(): string {
  return new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function SaleSheet({
  vehiculo,
  onCerrar,
  onConfirmar,
}: {
  vehiculo: Vehiculo | null;
  onCerrar: () => void;
  onConfirmar: (datos: { precio: number | null; nota: string | null }) => void;
}) {
  const [precio, setPrecio] = useState("");
  const [nota, setNota] = useState("");

  if (!vehiculo) return null;

  function confirmar() {
    const limpio = precio.replace(/[^\d]/g, "");
    onConfirmar({
      precio: limpio ? Number(limpio) : null,
      nota: nota.trim() || null,
    });
    setPrecio("");
    setNota("");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Cancelar"
        className="absolute inset-0 bg-black/70"
        onClick={onCerrar}
      />
      <div
        className="relative rounded-t-2xl border-t border-car-gold/30 bg-car-gray p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <p className="font-condensed text-xl font-black italic text-car-white">{vehiculo.nombre}</p>
        <p className="mt-1 text-sm text-car-muted">Se registra la venta el {horaAhora()}</p>

        <label className="mt-4 block text-xs uppercase tracking-wide text-car-muted">
          Precio de venta <span className="normal-case">(opcional)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="Ej: 32000"
          className="mt-1 min-h-11 w-full rounded border border-white/15 bg-car-gray2 px-3 text-car-white placeholder:text-car-muted/60 focus:border-car-gold focus:outline-none"
        />

        <label className="mt-3 block text-xs uppercase tracking-wide text-car-muted">
          Nota <span className="normal-case">(opcional)</span>
        </label>
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: entregó usado en parte de pago"
          className="mt-1 min-h-11 w-full rounded border border-white/15 bg-car-gray2 px-3 text-car-white placeholder:text-car-muted/60 focus:border-car-gold focus:outline-none"
        />

        <button
          type="button"
          onClick={confirmar}
          className="mt-5 min-h-14 w-full rounded bg-car-gold font-condensed text-lg font-black uppercase tracking-wide text-car-black transition active:bg-car-gold-dark"
        >
          Confirmar venta
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="mt-2 min-h-11 w-full text-sm font-semibold text-car-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
