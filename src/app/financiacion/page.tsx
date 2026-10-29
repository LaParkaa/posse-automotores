import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { SimuladorFinanciacion } from "@/components/simulador-financiacion";
import { usadoDeUrl } from "@/lib/financiacion";
import { getVehiculosDisponibles } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Simulá tu plan de financiación | Posse Automotores",
  description: "Contanos qué auto querés, cuánto querés financiar y en cuántas cuotas, y te armamos una propuesta por WhatsApp.",
};

export default async function FinanciacionPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string; usado?: string; usadoAnio?: string; permuta?: string }>;
}) {
  const { auto, ...paramsUsado } = await searchParams;
  const vehiculos = await getVehiculosDisponibles();
  const autos = vehiculos.map((v) => ({
    slug: v.slug,
    etiqueta: `${v.nombre.trim()} (${v.anio})`,
    nombre: v.nombre.trim(),
    detalle: `${v.anio} · ${v.kilometraje}`,
    precio: v.precio_texto,
    imagen: v.cover_image_url,
  }));

  return (
    <>
      <SiteHeader />
      {/* El espacio de abajo evita que el botón flotante de WhatsApp tape el botón de enviar. */}
      <main className="mx-auto max-w-xl px-5 pb-36 pt-28 lg:max-w-[64rem]">
        <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Financiación</p>
        <h1 className="mt-2 font-condensed text-5xl font-black italic text-car-white [text-shadow:0_0_28px_rgba(201,162,39,0.3)]">
          Simulá tu <span className="text-car-gold">Plan</span>
        </h1>
        <div className="mb-8 mt-4 h-0.5 w-12 bg-car-gold" />
        <SimuladorFinanciacion autos={autos} autoInicial={auto} usadoInicial={usadoDeUrl(paramsUsado)} />
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
