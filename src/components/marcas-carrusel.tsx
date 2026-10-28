import Image from "next/image";
import Link from "next/link";
import { CarruselArrastrable } from "@/components/carrusel-arrastrable";

// Logos en public/marcas/<clave>.png (ya recortados y livianos). Una marca sin archivo se muestra con su nombre.
const LOGOS = new Set([
  "audi", "bmw", "chevrolet", "fiat", "ford", "honda", "ktm", "mini", "peugeot", "renault", "toyota", "volkswagen",
]);
const ALIAS: Record<string, string> = { vw: "volkswagen" };

function claveMarca(marca: string): string {
  const clave = marca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().split(/\s+/)[0] ?? "";
  return ALIAS[clave] ?? clave;
}

export type MarcaDelStock = { nombre: string; cantidad: number };

/**
 * Carrusel horizontal de marcas: cada una es una tarjeta con relieve que filtra el catálogo. Tocar la marca
 * ya elegida la quita. `hrefDe(null)` es el catálogo sin marca.
 */
export function MarcasCarrusel({
  marcas,
  seleccionada,
  hrefDe,
}: {
  marcas: MarcaDelStock[];
  seleccionada: string | undefined;
  hrefDe: (marca: string | null) => string;
}) {
  return (
    <nav aria-label="Filtrar por marca" className="relative -mx-5 -mt-2 mb-3">
      <CarruselArrastrable className="flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-5 pt-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {marcas.map(({ nombre, cantidad }) => {
          const clave = claveMarca(nombre);
          const activa = seleccionada === nombre;
          return (
            <li key={nombre} className="shrink-0 snap-start">
              <Link
                href={hrefDe(activa ? null : nombre)}
                aria-label={`${nombre} (${cantidad})`}
                aria-current={activa ? "true" : undefined}
                title={`${nombre} · ${cantidad}`}
                className={`group flex h-[68px] w-[84px] items-center justify-center rounded-2xl border bg-gradient-to-b from-[#252c42] to-car-gray p-3 transition active:scale-95 ${
                  activa
                    ? "border-car-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_20px_rgba(201,162,39,0.45)]"
                    : "border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_16px_rgba(0,0,0,0.45)] hover:border-car-gold/50"
                }`}
              >
                {LOGOS.has(clave) ? (
                  <Image
                    src={`/marcas/${clave}.png`}
                    alt=""
                    width={128}
                    height={128}
                    draggable={false}
                    unoptimized
                    className={`max-h-full max-w-full object-contain transition group-hover:scale-105 ${
                      activa
                        ? "drop-shadow-[0_0_8px_rgba(201,162,39,0.75)]"
                        : "drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                    }`}
                  />
                ) : (
                  <span className="text-center font-condensed text-[11px] font-bold uppercase leading-tight tracking-wide text-car-white">
                    {nombre}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </CarruselArrastrable>
      {/* Degradado en el borde derecho: avisa que hay más marcas para deslizar. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-car-black to-transparent" />
    </nav>
  );
}
