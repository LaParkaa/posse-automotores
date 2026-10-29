import Link from "next/link";
import type { ResumenBot } from "@/lib/conversaciones";

const numero = (n: number) => n.toLocaleString("es-AR");

function Kpi({ titulo, valor, detalle, destacado = false }: { titulo: string; valor: string; detalle?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${destacado ? "border-car-gold/40 bg-car-gold/10" : "border-white/10 bg-car-gray2"}`}>
      <p className="text-xs uppercase tracking-wide text-car-muted">{titulo}</p>
      <p className="mt-1 font-condensed text-4xl font-black text-car-gold">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-car-muted">{detalle}</p>}
    </div>
  );
}

/**
 * Los números del bot de Instagram: cuánta gente capta y qué tan bien responde. Se usa arriba de Conversaciones y
 * dentro de Estadísticas; recibe el resumen ya calculado.
 */
export function ResumenBotVista({ resumen, titulo, verConversaciones = false }: { resumen: ResumenBot; titulo: string; verConversaciones?: boolean }) {
  const r = resumen;
  const maxDia = Math.max(1, ...r.porDia.map((d) => d.personas));
  const cadaCuanto = Math.ceil(r.porDia.length / 10);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-condensed text-xl font-black italic text-car-white">{titulo}</h2>
        {verConversaciones && (
          <Link href="/admin/conversaciones" className="text-sm font-semibold text-car-gold underline">
            Ver las conversaciones
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi titulo="Personas que escribieron" valor={numero(r.personas)} destacado detalle={`${numero(r.mensajesRecibidos)} mensajes recibidos`} />
        <Kpi
          titulo="Mensajes que entendió"
          valor={r.porcentajeEntendido === null ? "—" : `${r.porcentajeEntendido}%`}
          detalle={r.noEntendidos > 0 ? `${numero(r.noEntendidos)} sin entender` : "Sin fallas"}
        />
        <Kpi titulo="Respuestas del bot" valor={numero(r.respuestasDelBot)} />
        <Kpi titulo="Dejaron sus datos" valor={numero(r.dejaronDatos)} detalle="Nombre y teléfono" />
        <Kpi titulo="Postulaciones" valor={numero(r.postulaciones)} detalle="Llegaron hasta el final" />
        <Kpi titulo="Volvieron a escribir" valor={numero(r.volvieron)} detalle="En más de un día" />
      </div>

      <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
        <h3 className="font-condensed text-lg font-black italic text-car-white">Personas por día</h3>
        <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label="Personas que escribieron por día">
          {r.porDia.map((d) => (
            <div key={d.dia} className="flex h-full flex-1 items-end justify-center" title={`${d.etiqueta}: ${d.personas} personas`}>
              <div className="w-full max-w-4 rounded-t bg-[#4c6fff]" style={{ height: `${(d.personas / maxDia) * 100}%`, minHeight: d.personas > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1 text-[10px] text-car-muted">
          {r.porDia.map((d, i) => (
            <span key={d.dia} className="flex-1 text-center">{i % cadaCuanto === 0 ? d.etiqueta : ""}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
