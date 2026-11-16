"use client";
import { useState } from "react";

export function EliminarPlanButton({ action }: { action: () => Promise<void> }) {
  const [eliminando, setEliminando] = useState(false);
  return (
    <button
      type="button"
      disabled={eliminando}
      onClick={async () => {
        if (!window.confirm("¿Eliminar este plan de financiación? No se puede deshacer.")) return;
        setEliminando(true);
        await action();
      }}
      className="text-xs font-semibold text-red-400 hover:underline disabled:opacity-50"
    >
      {eliminando ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
