import { ImprimirButton } from "./imprimir-button";

/**
 * Hoja A4 para presupuestos, recibos y legajos. En pantalla se ve como una hoja blanca
 * flotando sobre el fondo oscuro del admin; al imprimir, todo lo que no sea la hoja
 * desaparece y el tamaño se fuerza a A4 sin márgenes del navegador.
 */
export function HojaImprimible({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-car-black py-10 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white !important; }
        }
      `}</style>
      <div className="mx-auto mb-6 flex max-w-[210mm] justify-end px-4 print:hidden">
        <ImprimirButton />
      </div>
      <div className="relative mx-auto max-w-[210mm] overflow-hidden bg-white px-10 py-10 text-black shadow-2xl print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {/* Marca de agua: el mismo logo, enorme y casi invisible, centrado detrás del contenido. */}
        <img
          src="/logo-posse-print.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.04]"
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

export function Membrete({ validezOferta }: { validezOferta?: string }) {
  return (
    <header className="mb-6 flex items-center justify-between gap-6 border-b-2 border-black pb-4">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo fijo, no amerita next/image en una hoja imprimible */}
        <img src="/logo-posse-print.png" alt="Posse Automotores" className="h-11 w-auto" />
        <p className="mt-1.5 text-xs text-neutral-600">Justiniano Posse, Córdoba — Autos, motos, utilitarios y maquinaria</p>
      </div>
      <div className="shrink-0 text-right text-xs text-neutral-600">
        <p>{new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
        {validezOferta && <p className="mt-1">Oferta válida: {validezOferta}</p>}
      </div>
    </header>
  );
}
