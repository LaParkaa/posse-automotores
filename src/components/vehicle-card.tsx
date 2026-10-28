import Image from "next/image";
import Link from "next/link";
import type { Vehiculo } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/utils";

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Las fotos del bucket de Supabase y las de /public se sirven achicadas por Next (la portada de un auto llegó a pesar
// 6,7 MB); cualquier otro origen se muestra tal cual para no romper la card.
const HOST_SUPABASE = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

function sePuedeOptimizar(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    return HOST_SUPABASE !== "" && new URL(src).hostname === HOST_SUPABASE;
  } catch {
    return false;
  }
}

// Ancho aproximado de una card según la pantalla: carrusel en el celular, 2 columnas y 3 columnas.
const SIZES_CARD = "(min-width: 1280px) 400px, (min-width: 640px) 50vw, 86vw";

/** Foto a sangre con degradado oscuro abajo: sobre el degradado van el nombre y "año · km", como en la ficha. */
function Portada({ vehiculo, className, children }: { vehiculo: Vehiculo; className: string; children: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden bg-car-gray2 ${className}`}>
      {vehiculo.cover_image_url && (
        <Image
          src={vehiculo.cover_image_url}
          alt={vehiculo.nombre}
          fill
          sizes={SIZES_CARD}
          unoptimized={!sePuedeOptimizar(vehiculo.cover_image_url)}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-car-black via-car-black/45 to-transparent" />
      {children}
    </div>
  );
}

function Etiqueta({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`absolute left-3 top-3 rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export function VehicleCard({ vehiculo }: { vehiculo: Vehiculo }) {
  const specs = [
    ["Combustible", vehiculo.combustible],
    ["Transmisión", vehiculo.transmision],
    ["Tipo", vehiculo.tipo],
  ].filter(([, valor]) => Boolean(valor)) as string[][];

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-car-gray transition-all hover:border-car-gold/40 hover:shadow-[0_12px_40px_rgba(201,162,39,0.18)]">
      <Link href={`/vehiculos/${vehiculo.slug}`} className="block">
        <Portada vehiculo={vehiculo} className="aspect-[4/5]">
          {vehiculo.estado === "reservado" ? (
            <Etiqueta className="bg-amber-400 text-car-black">Reservado</Etiqueta>
          ) : (
            vehiculo.badge && <Etiqueta className="bg-car-gold text-car-black">{vehiculo.badge}</Etiqueta>
          )}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h3 className="font-condensed text-4xl font-black italic leading-[1.05] text-car-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">
              {vehiculo.nombre}
            </h3>
            <p className="mt-2 text-base text-car-white/70">
              {vehiculo.anio} · {vehiculo.kilometraje}
            </p>
          </div>
        </Portada>
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {specs.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            {specs.map(([label, valor]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wide text-car-muted">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-car-white">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-auto font-condensed text-3xl font-black text-car-gold">{vehiculo.precio_texto}</p>
        {vehiculo.estado === "reservado" ? (
          <p className="flex w-full items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/10 py-3 text-center text-sm font-bold uppercase tracking-wide text-amber-400">
            Reservado · consultá por similares
          </p>
        ) : (
          <Link
            href={buildWhatsAppUrl(vehiculo)}
            target="_blank" rel="noopener"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1da851]"
          >
            <WaIcon /> Consultar por WhatsApp
          </Link>
        )}
      </div>
    </article>
  );
}

export function VehicleCardVendido({ vehiculo }: { vehiculo: Vehiculo }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/5 bg-car-gray opacity-70 grayscale">
      <Portada vehiculo={vehiculo} className="aspect-[4/3]">
        <Etiqueta className="bg-car-muted text-white">Vendido</Etiqueta>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-condensed text-2xl font-black italic leading-tight text-car-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">
            {vehiculo.nombre}
          </p>
          <p className="mt-1 text-sm text-car-white/70">{vehiculo.anio}</p>
        </div>
      </Portada>
    </article>
  );
}
