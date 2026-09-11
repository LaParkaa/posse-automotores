"use client";
import { useRef, useState } from "react";

/** Cuánto amplía la lupa respecto del tamaño real de la imagen. */
const ZOOM = 2.5;

export function GalleryZoom({ imagenes, alt }: { imagenes: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const imageBoxRef = useRef<HTMLDivElement>(null);

  if (imagenes.length === 0) return null;

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = imageBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    setPos({ x, y });
  }

  function close() {
    setOpenIndex(null);
  }

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    setOpenIndex((i) => (i === null ? null : (i - 1 + imagenes.length) % imagenes.length));
  }

  function next(e: React.MouseEvent) {
    e.stopPropagation();
    setOpenIndex((i) => (i === null ? null : (i + 1) % imagenes.length));
  }

  const lensSize = 100 / ZOOM; // porcentaje del lado del recuadro principal
  const lensLeft = Math.min(Math.max(pos.x * 100 - lensSize / 2, 0), 100 - lensSize);
  const lensTop = Math.min(Math.max(pos.y * 100 - lensSize / 2, 0), 100 - lensSize);

  return (
    <div className="grid gap-4 lg:grid-cols-[80px_1fr_1fr]">
      {/* Miniaturas: fila horizontal en mobile, columna en desktop */}
      <div className="flex gap-2 overflow-x-auto lg:max-h-[480px] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
        {imagenes.map((url, i) => (
          <button
            key={url + i}
            type="button"
            onClick={() => setSelected(i)}
            className={`shrink-0 overflow-hidden rounded border-2 transition ${
              i === selected ? "border-car-gold" : "border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            <img src={url} alt="" className="h-16 w-20 object-cover lg:h-14 lg:w-full" />
          </button>
        ))}
      </div>

      {/* Foto principal */}
      <div>
        <div
          ref={imageBoxRef}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseMove={onMouseMove}
          onClick={() => setOpenIndex(selected)}
          className="relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded bg-car-gray2"
        >
          <img
            src={imagenes[selected]}
            alt={`${alt} ${selected + 1}`}
            className="h-full w-full object-contain"
          />
          {hovering && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute hidden border-2 border-car-gold/70 bg-white/10 lg:block"
              style={{
                width: `${lensSize}%`,
                height: `${lensSize}%`,
                left: `${lensLeft}%`,
                top: `${lensTop}%`,
              }}
            />
          )}
        </div>
        <p className="mt-2 hidden text-xs text-car-muted lg:block">
          Pasá el mouse por la foto para ampliar · Tocá para ver a pantalla completa
        </p>
        <p className="mt-2 text-xs text-car-muted lg:hidden">Tocá la foto para ampliarla</p>
      </div>

      {/* Panel de zoom, solo desktop */}
      <div
        className={`relative hidden aspect-[4/3] overflow-hidden rounded border border-white/10 bg-car-gray2 lg:block`}
        style={
          hovering
            ? {
                backgroundImage: `url(${imagenes[selected]})`,
                backgroundSize: `${ZOOM * 100}%`,
                backgroundPosition: `${pos.x * 100}% ${pos.y * 100}%`,
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      />

      {/* Modal a pantalla completa (mobile: tocar la foto; desktop: click en la foto) */}
      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
            aria-label="Cerrar"
          >
            ×
          </button>

          {imagenes.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:left-6"
                aria-label="Anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:right-6"
                aria-label="Siguiente"
              >
                ›
              </button>
            </>
          )}

          <img
            src={imagenes[openIndex]}
            alt={`${alt} ${openIndex + 1}`}
            className="max-h-[85vh] max-w-full rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {imagenes.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {openIndex + 1} / {imagenes.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
