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
        className="rounded border border-red-900 px-3 py-1 text-xs text-red-400 transition hover:bg-red-900/30"
      >
        Eliminar
      </button>
    </form>
  );
}
