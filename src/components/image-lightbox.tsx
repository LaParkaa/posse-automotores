"use client";
import { useState } from "react";

export function ImageLightbox({ imagenes, alt }: { imagenes: string[]; alt: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (imagenes.length === 0) return null;

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

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {imagenes.map((url, i) => (
          <button
            key={url + i}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="group relative cursor-zoom-in overflow-hidden rounded"
          >
            <img
              src={url}
              alt={`${alt} ${i + 1}`}
              className="aspect-video w-full object-cover transition group-hover:scale-105"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
              <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                Ampliar
              </span>
            </span>
          </button>
        ))}
      </div>

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
    </>
  );
}
