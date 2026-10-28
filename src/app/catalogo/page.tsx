import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { CatalogoLive } from "@/components/catalogo-live";
import { ContadorStock } from "@/components/contador-stock";
import { MarcasCarrusel } from "@/components/marcas-carrusel";
import { condicionDeUrl, cumpleCondicion, type Condicion } from "@/lib/condicion";
import { getVehiculosDisponibles } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Campo de formulario con relieve y un resplandor dorado al enfocarlo.
const CAMPO =
  "h-14 rounded-xl border border-white/10 bg-car-gray2 px-4 text-base text-car-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition placeholder:text-car-muted focus:border-car-gold focus:shadow-[0_0_0_1px_rgba(201,162,39,0.6),0_0_18px_rgba(201,162,39,0.3)] sm:h-12 sm:text-sm";

const CONDICIONES: Array<{ valor: Condicion | undefined; texto: string }> = [
  { valor: undefined, texto: "Todos" },
  { valor: "usados", texto: "Usados" },
  { valor: "0km", texto: "0km" },
];

/** "Volkswagen " y "volkswagen" son la misma marca: la base trae mayúsculas y espacios sueltos. */
const claveMarca = (marca: string) => marca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ marca?: string; tipo?: string; combustible?: string; q?: string; condicion?: string }>;
}) {
  const params = await searchParams;
  const condicion = condicionDeUrl(params.condicion);
  const vehiculos = await getVehiculosDisponibles();

  // Las marcas con más autos primero: el carrusel muestra antes lo que más hay.
  const porMarca = new Map<string, { nombre: string; cantidad: number }>();
  for (const v of vehiculos) {
    const clave = claveMarca(v.marca);
    const actual = porMarca.get(clave);
    porMarca.set(clave, { nombre: actual?.nombre ?? v.marca.trim(), cantidad: (actual?.cantidad ?? 0) + 1 });
  }
  const marcas = [...porMarca.values()].sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
  const marcaElegida = params.marca ? marcas.find((m) => claveMarca(m.nombre) === claveMarca(params.marca!))?.nombre : undefined;
  const tipos = [...new Set(vehiculos.map((v) => v.tipo).filter(Boolean))].sort() as string[];
  const combustibles = [...new Set(vehiculos.map((v) => v.combustible))].sort();

  /** Link al catálogo con los filtros de ahora, cambiando solo lo que se indica (null saca ese filtro). */
  const hrefCon = (cambios: { marca?: string | null; condicion?: Condicion | null }) => {
    const query = new URLSearchParams();
    const actuales = {
      q: params.q,
      tipo: params.tipo,
      combustible: params.combustible,
      marca: cambios.marca === undefined ? params.marca : cambios.marca,
      condicion: cambios.condicion === undefined ? condicion : cambios.condicion,
    };
    for (const [clave, valor] of Object.entries(actuales)) if (valor) query.set(clave, valor);
    const texto = query.toString();
    return texto ? `/catalogo?${texto}` : "/catalogo";
  };

  const filtered = vehiculos.filter((v) => {
    const okMarca = params.marca ? claveMarca(v.marca) === claveMarca(params.marca) : true;
    const okTipo = params.tipo ? v.tipo === params.tipo : true;
    const okCombustible = params.combustible ? v.combustible === params.combustible : true;
    const term = params.q?.toLowerCase();
    const okQ = term ? `${v.nombre} ${v.modelo} ${v.marca}`.toLowerCase().includes(term) : true;
    return okMarca && okTipo && okCombustible && okQ && cumpleCondicion(v, condicion);
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 pb-28 pt-28">
        <div className="mb-6">
          <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Catálogo</p>
          <h1 className="mt-2 font-condensed text-5xl font-black italic text-car-white [text-shadow:0_0_28px_rgba(201,162,39,0.3)]">
            Vehículos <span className="text-car-gold">disponibles</span>
          </h1>
          <div className="mt-4 h-0.5 w-12 bg-car-gold" />
        </div>

        <div className="mb-5">
          <ContadorStock cantidad={vehiculos.length} />
        </div>

        {/* CONDICIÓN: un toque y se filtra */}
        <nav aria-label="Condición" className="-mx-5 mb-6">
          <ul className="flex gap-3 overflow-x-auto px-5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CONDICIONES.map(({ valor, texto }) => {
              const activa = condicion === valor;
              return (
                <li key={texto} className="shrink-0">
                  <Link
                    href={hrefCon({ condicion: valor ?? null })}
                    aria-current={activa ? "true" : undefined}
                    className={`block rounded-full border px-6 py-2.5 text-base font-semibold transition active:scale-95 ${
                      activa
                        ? "border-car-gold bg-car-gold/10 text-car-white shadow-[0_0_18px_rgba(201,162,39,0.4)]"
                        : "border-white/15 bg-car-gray text-car-white/80 hover:border-car-gold/50"
                    }`}
                  >
                    {texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* MARCAS */}
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm text-car-muted">Filtrar por marca</p>
          <Link
            href={hrefCon({ marca: null })}
            className="flex items-center gap-1 rounded-xl border border-car-gold/40 bg-car-gray2 px-4 py-2 text-sm text-car-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-car-gold"
          >
            Ver todas <span aria-hidden="true">›</span>
          </Link>
        </div>
        <MarcasCarrusel marcas={marcas} seleccionada={marcaElegida} hrefDe={(marca) => hrefCon({ marca })} />

        {/* FILTROS */}
        <form className="mb-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {params.marca && <input type="hidden" name="marca" value={params.marca} />}
          {condicion && <input type="hidden" name="condicion" value={condicion} />}
          <input name="q" defaultValue={params.q}
            placeholder="Buscar marca o modelo..."
            className={`${CAMPO} col-span-2 sm:w-72`} />
          <select name="tipo" defaultValue={params.tipo ?? ""} className={`${CAMPO} text-sm`}>
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="combustible" defaultValue={params.combustible ?? ""} className={`${CAMPO} text-sm`}>
            <option value="">Combustible</option>
            {combustibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" className="col-span-2 h-14 rounded-xl border border-[#f0d36b]/40 bg-gradient-to-b from-[#ecc94b] to-car-gold px-8 font-condensed text-lg font-black uppercase tracking-wide text-car-black shadow-[0_5px_0_#8a6f14,0_12px_24px_rgba(201,162,39,0.35)] transition active:translate-y-[3px] active:shadow-[0_2px_0_#8a6f14] sm:col-span-1 sm:h-12">
            Filtrar
          </button>
          {(params.marca || params.tipo || params.combustible || params.q || condicion) && (
            <Link href="/catalogo" className="col-span-2 flex h-12 items-center justify-center rounded-xl border border-white/15 px-4 text-sm text-car-muted transition hover:text-car-white sm:col-span-1">
              Limpiar
            </Link>
          )}
        </form>

        {/* En el celular las cards van en un carrusel con la siguiente asomando; desde sm, grilla. */}
        <CatalogoLive
          vehiculos={filtered}
          className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3 [&::-webkit-scrollbar]:hidden"
          itemClassName="w-[86%] shrink-0 snap-center sm:w-auto"
          vacio={
            <div className="py-20 text-center text-car-muted">
              <p className="font-condensed text-2xl font-bold italic">No encontramos vehículos con esos filtros.</p>
              <Link href="/catalogo" className="mt-4 inline-block text-car-gold underline">Ver todos</Link>
            </div>
          }
        />
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
