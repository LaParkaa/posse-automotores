import { ANUNCIOS_INSTAGRAM, pesos, porcentajeGastado, type AnuncioInstagram } from "@/lib/anuncios";

const numero = (n: number) => n.toLocaleString("es-AR");

function Dato({ titulo, valor, destacado = false }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-car-gray p-3">
      <p className="text-[11px] uppercase tracking-wide text-car-muted">{titulo}</p>
      <p className={`mt-1 font-condensed text-2xl font-black ${destacado ? "text-car-gold" : "text-car-white"}`}>{valor}</p>
    </div>
  );
}

function Anuncio({ a }: { a: AnuncioInstagram }) {
  const gastado = porcentajeGastado(a);
  return (
    <article className="rounded-lg border border-white/10 bg-car-gray2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-condensed text-lg font-black italic text-car-white">{a.titulo}</h3>
        <span className="rounded-full border border-white/15 px-3 py-0.5 text-xs text-car-white/80">{a.estado}</span>
      </div>
      <p className="mt-1 text-xs text-car-muted">
        {a.ubicaciones} · {a.publico} · {a.duracionDias} {a.duracionDias === 1 ? "día" : "días"}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato titulo="Visitas al sitio web" valor={numero(a.visitasSitio)} destacado />
        <Dato titulo="Clics en el enlace" valor={numero(a.clicsEnlace)} />
        <Dato titulo="Reproducciones" valor={numero(a.reproducciones)} />
        <Dato titulo="Costo por visita" valor={pesos(a.costoPorVisita)} />
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-sm text-car-white/80">
          <span>Gasto</span>
          <span>
            {pesos(a.gasto)} <span className="text-car-muted">de {pesos(a.presupuesto)}</span>
          </span>
        </div>
        <div className="mt-1 h-2 rounded bg-white/5">
          <div className="h-2 rounded bg-car-gold" style={{ width: `${gastado}%` }} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        {[
          ["Visitas al perfil", numero(a.visitasPerfil)],
          ["Seguidores nuevos", numero(a.seguidoresNuevos)],
          ["Conversaciones iniciadas", numero(a.conversacionesIniciadas)],
          ["Me gusta · comentarios", `${numero(a.megusta)} · ${numero(a.comentarios)}`],
        ].map(([titulo, valor]) => (
          <div key={titulo}>
            <dt className="text-[11px] uppercase tracking-wide text-car-muted">{titulo}</dt>
            <dd className="mt-0.5 font-semibold text-car-white">{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-car-muted">
        Se vio {a.lugarPrincipal.porcentaje}% en {a.lugarPrincipal.nombre}.
      </p>
    </article>
  );
}

/** Los anuncios de Instagram cargados a mano; van aparte de las visitas que cuenta el sitio. */
export function AnunciosInstagram() {
  if (ANUNCIOS_INSTAGRAM.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-condensed text-xl font-black italic text-car-white">Anuncios de Instagram</h2>
      <p className="mt-1 text-sm text-car-muted">
        Números copiados de Instagram. Van aparte porque Instagram y el sitio miden distinto: una visita de Instagram es un
        toque al enlace que cargó la página, y las del sitio las cuenta el sitio mismo.
      </p>
      <div className="mt-3 space-y-4">
        {ANUNCIOS_INSTAGRAM.map((a) => (
          <Anuncio key={a.titulo} a={a} />
        ))}
      </div>
    </section>
  );
}
