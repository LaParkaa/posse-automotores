"use client";

export function ImprimirButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded bg-car-gold px-6 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark print:hidden"
    >
      Imprimir
    </button>
  );
}
