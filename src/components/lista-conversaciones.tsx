import Link from "next/link";
import { FILTROS, fechaHora, type ConversacionResumen, type FiltroConversaciones } from "@/lib/conversaciones";

function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}`}>{texto}</span>;
}

/** Las conversaciones del bot, una tarjeta por persona; cada una abre su chat. */
export function ListaConversaciones({ conversaciones, filtro, dias }: { conversaciones: ConversacionResumen[]; filtro: FiltroConversaciones; dias: number }) {
  return (
    <section className="space-y-4">
      <nav aria-label="Filtro" className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`/admin/conversaciones?dias=${dias}&filtro=${f.valor}`}
            aria-current={f.valor === filtro ? "true" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              f.valor === filtro ? "border-car-gold bg-car-gold/10 text-car-white" : "border-white/15 text-car-white/70 hover:border-car-gold/50"
            }`}
          >
            {f.texto}
          </Link>
        ))}
      </nav>

      {conversaciones.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-car-gray2 p-8 text-center text-sm text-car-muted">
          No hay conversaciones con ese filtro en este período.
        </p>
      ) : (
        <ul className="space-y-2">
          {conversaciones.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/conversaciones/${c.id}`}
                className="block rounded-lg border border-white/10 bg-car-gray2 p-4 transition hover:border-car-gold/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-car-white">{c.nombre}</p>
                  <p className="shrink-0 text-xs text-car-muted">{fechaHora(c.ultimoMensaje)}</p>
                </div>
                <p className="mt-1 truncate text-sm text-car-muted">
                  <span className="text-car-white/60">{c.ultimoEsDelCliente ? "Cliente: " : "Bot: "}</span>
                  {c.ultimoTexto}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-car-muted">{c.mensajes} mensajes</span>
                  {c.dejoDatos && <Etiqueta texto="Dejó sus datos" color="border-[#25D366]/40 text-[#25D366]" />}
                  {c.postulo && <Etiqueta texto="Postulación completa" color="border-car-gold/50 text-car-gold" />}
                  {c.noEntendidos > 0 && (
                    <Etiqueta texto={`El bot no entendió ${c.noEntendidos > 1 ? `${c.noEntendidos} veces` : "1 vez"}`} color="border-red-400/50 text-red-300" />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
