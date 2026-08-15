"use client";
import { useState, useTransition } from "react";
import { softDeleteVehiculo } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function eliminar() {
    startTransition(async () => {
      await softDeleteVehiculo(id);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded border border-red-900 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-900/30 active:bg-red-900/40"
      >
        Eliminar
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-white/10 bg-car-gray p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-condensed text-xl font-black italic text-car-white">
              ¿Eliminar este vehículo?
            </p>
            <p className="mt-2 text-sm text-car-muted">
              Va a dejar de verse en la web. No se puede deshacer desde acá.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="rounded border border-white/15 py-3 text-sm font-semibold text-car-white transition hover:border-car-gold hover:text-car-gold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={isPending}
                className="rounded bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
