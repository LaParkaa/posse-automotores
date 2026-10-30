"use client";
import { useState, useTransition } from "react";
import { enviarCardAuto } from "@/app/admin/conversaciones/[id]/actions";

type Opcion = { id: string; nombre: string; anio: number };

/** Elegir un auto en venta y mandarle al cliente la misma card que manda el bot. */
export function EnviarCardAuto({ igUserId, autos }: { igUserId: string; autos: Opcion[] }) {
  const [vehiculoId, setVehiculoId] = useState(autos[0]?.id ?? "");
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, startTransition] = useTransition();

  if (autos.length === 0) return null;

  function enviar() {
    setEstado(null);
    startTransition(async () => {
      const r = await enviarCardAuto(igUserId, vehiculoId);
      setEstado(r.ok ? { ok: true, texto: "Card enviada ✓" } : { ok: false, texto: r.error });
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-car-gold/30 bg-car-gray p-4">
      <p className="font-condensed text-sm font-bold uppercase tracking-wide text-car-gold">Mandar la card de un auto</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={vehiculoId}
          onChange={(e) => setVehiculoId(e.target.value)}
          className="w-full rounded border border-white/15 bg-car-gray2 px-3 py-2.5 text-sm text-car-white outline-none focus:border-car-gold"
        >
          {autos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} {a.anio}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || !vehiculoId}
          className="shrink-0 rounded bg-car-gold px-5 py-2.5 text-sm font-bold text-car-black disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar por Instagram"}
        </button>
      </div>
      {estado && <p className={`mt-2 text-sm ${estado.ok ? "text-[#25D366]" : "text-red-300"}`}>{estado.texto}</p>}
    </div>
  );
}
