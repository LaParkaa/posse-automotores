import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { VehicleCard } from "@/components/vehicle-card";
import { getVehiculosDisponibles } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ marca?: string; tipo?: string; combustible?: string; q?: string }>;
}) {
  const params = await searchParams;
  const vehiculos = await getVehiculosDisponibles();

  const marcas = [...new Set(vehiculos.map((v) => v.marca))].sort();
  const tipos = [...new Set(vehiculos.map((v) => v.tipo).filter(Boolean))].sort() as string[];
  const combustibles = [...new Set(vehiculos.map((v) => v.combustible))].sort();

  const filtered = vehiculos.filter((v) => {
    const okMarca = params.marca ? v.marca === params.marca : true;
    const okTipo = params.tipo ? v.tipo === params.tipo : true;
    const okCombustible = params.combustible ? v.combustible === params.combustible : true;
    const term = params.q?.toLowerCase();
    const okQ = term ? `${v.nombre} ${v.modelo} ${v.marca}`.toLowerCase().includes(term) : true;
    return okMarca && okTipo && okCombustible && okQ;
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-28">
        <div className="mb-10">
          <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Catálogo</p>
          <h1 className="mt-2 font-condensed text-5xl font-black italic text-car-white">
            Vehículos <span className="text-car-gold">disponibles</span>
          </h1>
          <div className="mt-4 h-0.5 w-12 bg-car-gold" />
        </div>

        {/* FILTROS */}
        <form className="mb-8 flex flex-wrap gap-3">
          <input name="q" defaultValue={params.q}
            placeholder="Buscar marca o modelo..."
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white placeholder:text-car-muted outline-none focus:border-car-gold" />
          <select name="marca" defaultValue={params.marca ?? ""}
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white outline-none focus:border-car-gold">
            <option value="">Todas las marcas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select name="tipo" defaultValue={params.tipo ?? ""}
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white outline-none focus:border-car-gold">
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="combustible" defaultValue={params.combustible ?? ""}
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white outline-none focus:border-car-gold">
            <option value="">Todos los combustibles</option>
            {combustibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" className="h-11 rounded bg-car-gold px-6 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark">
            Filtrar
          </button>
          {(params.marca || params.tipo || params.combustible || params.q) && (
            <Link href="/catalogo" className="flex h-11 items-center rounded border border-white/15 px-4 text-sm text-car-muted transition hover:text-car-white">
              Limpiar
            </Link>
          )}
        </form>

        {filtered.length === 0 ? (
          <div className="py-20 text-center text-car-muted">
            <p className="font-condensed text-2xl font-bold italic">No encontramos vehículos con esos filtros.</p>
            <Link href="/catalogo" className="mt-4 inline-block text-car-gold underline">Ver todos</Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => <VehicleCard key={v.id} vehiculo={v} />)}
          </div>
        )}
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
