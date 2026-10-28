"use client";
import { useEffect, useState } from "react";

const DURACION_MS = 900;

/** "37 autos disponibles en stock": el número sube desde 0 al cargar (salvo que la persona pida menos movimiento). */
export function ContadorStock({ cantidad }: { cantidad: number }) {
  const [mostrado, setMostrado] = useState(cantidad);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cuadro = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const avance = Math.min(1, (ahora - inicio) / DURACION_MS);
      // Frena al final: 1 - (1 - t)^3.
      setMostrado(Math.round(cantidad * (1 - Math.pow(1 - avance, 3))));
      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [cantidad]);

  return (
    <p
      className="inline-flex items-center gap-2 rounded-full border border-car-gold/40 bg-car-gold/10 px-4 py-1.5 text-sm text-car-white shadow-[0_0_20px_rgba(201,162,39,0.18)]"
      aria-label={`${cantidad} autos disponibles en stock`}
    >
      <span className="relative flex size-2.5" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#25D366] opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-[#25D366]" />
      </span>
      <span aria-hidden="true">
        <strong className="font-bold tabular-nums">{mostrado}</strong> {cantidad === 1 ? "auto disponible" : "autos disponibles"} en stock
      </span>
    </p>
  );
}
