import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { VehicleCardVendido } from "@/components/vehicle-card";
import { getVehiculosVendidos } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vendidos | Posse Automotores" };

export default async function VendidosPage() {
  const vendidos = await getVehiculosVendidos();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-car-gray px-5 pb-20 pt-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Historial</p>
            <h1 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
              Todos los <span className="text-car-gold">vendidos</span>
            </h1>
            <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
            <p className="mt-4 text-sm text-car-muted">{vendidos.length} autos que ya encontraron dueño.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {vendidos.map((v) => <VehicleCardVendido key={v.id} vehiculo={v} />)}
          </div>
          <div className="mt-10 text-center">
            <Link href="/catalogo" className="text-sm font-semibold text-car-gold underline">
              Ver los autos que están en venta
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
