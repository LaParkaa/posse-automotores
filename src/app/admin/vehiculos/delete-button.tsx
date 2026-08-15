"use client";
import { softDeleteVehiculo } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={softDeleteVehiculo.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar este vehículo?")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="w-full rounded border border-red-900 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-900/30 active:bg-red-900/40"
      >
        Eliminar
      </button>
    </form>
  );
}
