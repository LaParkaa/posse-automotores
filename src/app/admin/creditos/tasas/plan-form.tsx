"use client";
import { useRef, useState } from "react";
import type { PlanFinanciacion } from "@/lib/creditos/types";

const PLAZOS_POSIBLES = [12, 24, 36, 48, 60];

const inputClass =
  "w-full rounded border border-white/15 bg-car-gray2 px-3 py-2 text-sm text-car-white outline-none focus:border-car-gold";
const labelClass = "mb-1 block text-xs uppercase tracking-wide text-car-muted";

export function PlanForm({
  plan,
  action,
  onGuardado,
}: {
  plan?: PlanFinanciacion;
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  onGuardado?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [plazos, setPlazos] = useState<number[]>(plan?.plazos_habilitados ?? [12, 24, 36]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const formData = new FormData(formRef.current!);
    const resultado = await action(formData);
    setSubmitting(false);
    if (resultado && resultado.ok === false) {
      setError(resultado.error);
    } else {
      onGuardado?.();
      if (!plan) formRef.current?.reset();
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <label className={labelClass}>Nombre del plan</label>
        <input name="nombre" defaultValue={plan?.nombre} className={inputClass} required />
      </div>
      <div>
        <label className={labelClass}>TNA %</label>
        <input name="tna_pct" type="number" step="0.01" defaultValue={plan?.tna_pct} className={inputClass} required />
      </div>
      <div>
        <label className={labelClass}>Gastos %</label>
        <input name="gastos_otorgamiento_pct" type="number" step="0.01" defaultValue={plan?.gastos_otorgamiento_pct ?? 0} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Máx. financiable %</label>
        <input name="max_financiable_pct" type="number" step="0.01" defaultValue={plan?.max_financiable_pct ?? 100} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Antigüedad máx. (años)</label>
        <input name="antiguedad_max_anios" type="number" defaultValue={plan?.antiguedad_max_anios ?? ""} className={inputClass} />
      </div>

      <div className="sm:col-span-6">
        <label className={labelClass}>Plazos habilitados</label>
        <div className="flex flex-wrap gap-2">
          {PLAZOS_POSIBLES.map((p) => {
            const activo = plazos.includes(p);
            return (
              <label key={p} className={`flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold ${activo ? "bg-car-gold text-car-black" : "bg-white/5 text-car-white"}`}>
                <input
                  type="checkbox"
                  name="plazos_habilitados"
                  value={p}
                  checked={activo}
                  onChange={(e) =>
                    setPlazos((prev) => (e.target.checked ? [...prev, p].sort((a, b) => a - b) : prev.filter((x) => x !== p)))
                  }
                  className="hidden"
                />
                {p}x
              </label>
            );
          })}
        </div>
      </div>

      {plan && (
        <div className="sm:col-span-6">
          <label className="flex items-center gap-2 text-sm text-car-white">
            <input type="checkbox" name="activo" value="true" defaultChecked={plan.activo} className="size-4" />
            Plan activo (visible para cotizar)
          </label>
        </div>
      )}

      {error && <p className="sm:col-span-6 text-sm text-red-400">{error}</p>}

      <div className="sm:col-span-6">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-car-gold px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50"
        >
          {submitting ? "Guardando…" : plan ? "Guardar cambios" : "+ Agregar plan"}
        </button>
      </div>
    </form>
  );
}
