import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { getVehiculoBySlug, getVehiculosDisponibles } from "@/lib/data";
import { buildWhatsAppUrl } from "@/lib/utils";
import { ImageLightbox } from "@/components/image-lightbox";

export async function generateStaticParams() {
  const vehiculos = await getVehiculosDisponibles();
  return vehiculos.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const v = await getVehiculoBySlug(slug);
  if (!v) return { title: "Vehículo no encontrado" };
  return {
    title: `${v.nombre} ${v.anio} | Posse Automotores`,
    description: v.descripcion ?? `${v.nombre} ${v.anio} en Posse Automotores. ${v.precio_texto}.`,
  };
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default async function VehiculoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getVehiculoBySlug(slug);
  if (!v) notFound();

  const whatsappUrl = buildWhatsAppUrl(v.nombre, v.anio, "ficha");
  const specs = [
    ["Año", String(v.anio)],
    ["Kilometraje", v.kilometraje],
    ["Combustible", v.combustible],
    ["Transmisión", v.transmision],
    v.motor ? ["Motor", v.motor] : null,
    v.tipo ? ["Tipo", v.tipo] : null,
  ].filter(Boolean) as string[][];

  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative min-h-[480px] bg-car-black">
          {v.cover_image_url && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center opacity-50"
                style={{ backgroundImage: `url(${v.cover_image_url})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-car-black via-black/50 to-transparent" />
            </>
          )}
          <div className="relative mx-auto flex min-h-[480px] max-w-7xl flex-col justify-end px-5 pb-12 pt-28">
            {v.badge && (
              <span className="mb-4 w-fit rounded bg-car-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
                {v.badge}
              </span>
            )}
            <h1 className="font-condensed text-5xl font-black italic text-car-white sm:text-7xl">
              {v.nombre}
            </h1>
            <p className="mt-3 text-lg text-car-white/70">
              {v.anio} · {v.kilometraje}
            </p>
          </div>
        </section>

        {/* SPECS STRIP */}
        <section className="border-b border-white/10 bg-car-gray">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-3 lg:grid-cols-6">
            {specs.map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-car-muted">{label}</span>
                <strong className="mt-1 text-sm text-car-white">{value}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* CONTENIDO */}
        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_340px]">
          <div className="space-y-10">
            {v.descripcion && (
              <div>
                <h2 className="font-condensed text-2xl font-black italic text-car-white">
                  Descripción
                </h2>
                <p className="mt-4 leading-8 text-car-white/70">{v.descripcion}</p>
              </div>
            )}
            {v.imagenes && v.imagenes.length > 0 && (
              <div>
                <h2 className="font-condensed text-2xl font-black italic text-car-white">
                  Galería
                </h2>
                <p className="mt-1 text-sm text-car-muted">Tocá una foto para ampliarla</p>
                <div className="mt-5">
                  <ImageLightbox imagenes={v.imagenes} alt={v.nombre} />
                </div>
              </div>
            )}
            {v.videos && v.videos.length > 0 && (
              <div>
                <h2 className="font-condensed text-2xl font-black italic text-car-white">
                  Video
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {v.videos.map((url, i) => (
                    <video
                      key={url + i}
                      src={url}
                      controls
                      preload="metadata"
                      className="aspect-video w-full rounded bg-black object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="h-fit rounded-lg border border-car-gold/20 bg-car-gray p-6 shadow-lg lg:sticky lg:top-24">
            <p className="text-xs uppercase tracking-wide text-car-muted">Precio</p>
            <p className="mt-1 font-condensed text-4xl font-black text-car-gold">{v.precio_texto}</p>
            <p className="mt-1 text-sm text-car-muted">Consultar financiación disponible</p>
            <Link
              href={whatsappUrl}
              target="_blank"
              rel="noopener"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-[#25D366] py-4 font-condensed text-base font-bold uppercase tracking-wide text-white transition hover:bg-[#1da851]"
            >
              <WaIcon /> Consultar por WhatsApp
            </Link>
            <Link
              href="/catalogo"
              className="mt-3 flex w-full items-center justify-center rounded border border-white/15 py-3 text-sm text-car-white/70 transition hover:border-car-gold hover:text-car-gold"
            >
              ← Ver más vehículos
            </Link>
          </aside>
        </section>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
