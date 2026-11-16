"use client";
import { useState } from "react";
import { DOCUMENTOS_DISPONIBLES } from "@/lib/creditos/documentos";
import { MEDIOS_PAGO, type MedioPago, type TipoDocumento } from "@/lib/creditos/types";

export function GenerarDocumentoForm({
  action,
}: {
  action: (tipoDocumento: TipoDocumento, monto: number | null, medioPago: MedioPago | null) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoDocumento>("Presupuesto");
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago | "">("");
  const [generando, setGenerando] = useState(false);

  const necesitaMonto = tipo !== "Presupuesto";

  return (
    <form
      action={async () => {
        setGenerando(true);
        await action(tipo, necesitaMonto && monto ? Number(monto) : null, necesitaMonto && medioPago ? medioPago : null);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wide text-car-muted">Documento</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDocumento)}
          className="rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold"
        >
          {DOCUMENTOS_DISPONIBLES.map((d) => (
            <option key={d.slug} value={d.tipo}>
              {d.etiqueta}
            </option>
          ))}
        </select>
      </div>
      {necesitaMonto && (
        <>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-car-muted">Monto</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-32 rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-car-muted">Medio de pago</label>
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as MedioPago)}
              className="rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold"
            >
              <option value="">—</option>
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <button
        type="submit"
        disabled={generando}
        className="rounded bg-car-gold px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50"
      >
        {generando ? "Generando…" : "Generar e imprimir"}
      </button>
    </form>
  );
}
