"use client";
import { useRef } from "react";

// Lo que hay que mover el mouse antes de tomarlo por un arrastre y no por un clic.
const UMBRAL_ARRASTRE_PX = 5;

/**
 * Lista horizontal que se desliza con el dedo (nativo) y también se arrastra con el mouse en la compu.
 * Después de arrastrar con el mouse se cancela el clic, para que soltar sobre una tarjeta no la abra.
 */
export function CarruselArrastrable({ className, children }: { className: string; children: React.ReactNode }) {
  const lista = useRef<HTMLUListElement>(null);
  const arrastre = useRef({ activo: false, movio: false, inicioX: 0, scrollInicial: 0 });

  const terminar = () => {
    const el = lista.current;
    arrastre.current.activo = false;
    if (el) {
      el.style.scrollSnapType = "";
      el.style.cursor = "";
    }
  };

  return (
    <ul
      ref={lista}
      className={`${className} cursor-grab overscroll-x-contain`}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        const el = lista.current;
        if (!el) return;
        arrastre.current = { activo: true, movio: false, inicioX: e.clientX, scrollInicial: el.scrollLeft };
      }}
      onPointerMove={(e) => {
        const a = arrastre.current;
        const el = lista.current;
        if (!a.activo || !el) return;
        const dx = e.clientX - a.inicioX;
        if (!a.movio && Math.abs(dx) < UMBRAL_ARRASTRE_PX) return;
        if (!a.movio) {
          a.movio = true;
          // El imán del carrusel pelea con el arrastre a mano: se apaga mientras dura.
          el.style.scrollSnapType = "none";
          el.style.cursor = "grabbing";
          el.setPointerCapture(e.pointerId);
        }
        el.scrollLeft = a.scrollInicial - dx;
      }}
      onPointerUp={terminar}
      onPointerCancel={terminar}
      onClickCapture={(e) => {
        if (arrastre.current.movio) {
          e.preventDefault();
          e.stopPropagation();
          arrastre.current.movio = false;
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </ul>
  );
}
