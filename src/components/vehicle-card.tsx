import Link from "next/link";
import type { Vehiculo } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/utils";
import { VehicleThumbnail } from "@/components/vehicle-thumbnail";

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export function VehicleCard({ vehiculo }: { vehiculo: Vehiculo }) {
  return (
    <article className="overflow-hidden rounded-lg border border-white/5 bg-car-gray transition-all hover:scale-[1.02] hover:border-car-gold/40 hover:shadow-[0_12px_40px_rgba(201,162,39,0.18)]">
      <Link href={`/vehiculos/${vehiculo.slug}`} className="relative block">
        {vehiculo.cover_image_url ? (
          <VehicleThumbnail
            src={vehiculo.cover_image_url}
            alt={vehiculo.nombre}
            className="aspect-video w-full"
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full bg-car-gray2" />
        )}
        {vehiculo.estado === "reservado" ? (
          <span className="absolute left-3 top-3 rounded bg-amber-400 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
            Reservado
          </span>
        ) : (
          vehiculo.badge && (
            <span className="absolute left-3 top-3 rounded bg-car-gold px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
              {vehiculo.badge}
            </span>
          )
        )}
      </Link>
      <div className="p-5 space-y-4">
        <div>
          <p className="font-condensed text-xl font-black italic text-car-white leading-tight">
            {vehiculo.nombre}
          </p>
          <p className="mt-1 text-sm text-car-muted">{vehiculo.anio} · {vehiculo.kilometraje}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[vehiculo.combustible, vehiculo.transmision, vehiculo.tipo].filter(Boolean).map((s) => (
            <span key={s} className="rounded-full bg-car-gray2 px-3 py-1 text-xs text-car-muted">{s}</span>
          ))}
        </div>
        <p className="font-condensed text-2xl font-black text-car-gold">{vehiculo.precio_texto}</p>
        {vehiculo.estado === "reservado" ? (
          <p className="flex w-full items-center justify-center rounded border border-amber-400/40 bg-amber-400/10 py-3 text-center text-sm font-bold uppercase tracking-wide text-amber-400">
            Reservado · consultá por similares
          </p>
        ) : (
          <Link
            href={buildWhatsAppUrl(vehiculo.nombre, vehiculo.anio, "card")}
            target="_blank" rel="noopener"
            className="flex w-full items-center justify-center gap-2 rounded bg-[#25D366] py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1da851]"
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
    <article className="overflow-hidden rounded-lg border border-white/5 bg-car-gray opacity-70 grayscale">
      <div className="relative">
        {vehiculo.cover_image_url ? (
          <VehicleThumbnail
            src={vehiculo.cover_image_url}
            alt={vehiculo.nombre}
            className="aspect-video w-full"
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full bg-car-gray2" />
        )}
        <span className="absolute left-3 top-3 rounded bg-car-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Vendido
        </span>
      </div>
      <div className="p-4">
        <p className="font-condensed text-lg font-black italic text-car-white">{vehiculo.nombre}</p>
        <p className="mt-1 text-sm text-car-muted">{vehiculo.anio}</p>
      </div>
    </article>
  );
}
