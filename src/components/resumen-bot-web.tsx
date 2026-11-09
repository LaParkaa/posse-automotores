import Link from "next/link";
import type { ResumenBotWeb } from "@/lib/bot/web/estadisticas";

const numero = (n: number) => n.toLocaleString("es-AR");
const decimal = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

function Kpi({ titulo, valor, detalle, destacado = false }: { titulo: string; valor: string; detalle?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${destacado ? "border-car-gold/40 bg-car-gold/10" : "border-white/10 bg-car-gray2"}`}>
      <p className="text-xs uppercase tracking-wide text-car-muted">{titulo}</p>
      <p className="mt-1 font-condensed text-4xl font-black text-car-gold">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-car-muted">{detalle}</p>}
    </div>
  );
}

/** Los pasos del embudo, en el orden en que la gente los va dando. */
export function pasosDelEmbudo(e: ResumenBotWeb["embudo"]): Array<{ clave: string; texto: string; personas: number }> {
  return [
    { clave: "vieronPagina", texto: "Vieron la página", personas: e.vieronPagina },
    { clave: "abrieron", texto: "Abrieron el chat", personas: e.abrieron },
    { clave: "interactuaron", texto: "Escribieron o tocaron una opción", personas: e.interactuaron },
    { clave: "armaronMensaje", texto: "Armaron el mensaje para Marcos", personas: e.armaronMensaje },
    { clave: "tocaronWhatsapp", texto: 'Tocaron "Enviar por WhatsApp"', personas: e.tocaronWhatsapp },
  ];
}

/**
 * Los números del asistente de la página: el embudo hasta WhatsApp, las conversaciones, los autos por los que más
 * preguntan y lo que no entendió. Se usa arriba de Conversaciones (pestaña "Página web") y dentro de Estadísticas;
 * recibe el resumen ya calculado. `nombresAutos` (slug a nombre) es opcional: sin él se muestra el slug.
 */
export function ResumenBotWebVista({
  resumen,
  titulo,
  verConversaciones = false,
  nombresAutos,
  compacto = false,
}: {
  resumen: ResumenBotWeb;
  titulo: string;
  verConversaciones?: boolean;
  nombresAutos?: Record<string, string>;
  /** Solo los números principales y el embudo (para Estadísticas); sin autos, fallas, comparación ni días. */
  compacto?: boolean;
}) {
  const r = resumen;
  const pasos = pasosDelEmbudo(r.embudo);
  const maxEmbudo = Math.max(1, ...pasos.map((p) => p.personas));
  const maxDia = Math.max(1, ...r.porDia.map((d) => d.personas));
  const cadaCuanto = Math.max(1, Math.ceil(r.porDia.length / 10));
  const maxAuto = Math.max(1, ...r.autosMasConsultados.map((a) => a.conversaciones));
  const autos = r.autosMasConsultados.slice(0, 5);
  const c = r.comparacion;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-condensed text-xl font-black italic text-car-white">{titulo}</h2>
        {verConversaciones && (
          <Link href="/admin/conversaciones?canal=web" className="text-sm font-semibold text-car-gold underline">
            Ver las conversaciones
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi titulo="Conversaciones" valor={numero(r.conversaciones)} destacado detalle="Escribieron o tocaron una opción" />
        <Kpi
          titulo="Mensajes por conversación"
          valor={r.mensajesPorConversacion === null ? "—" : decimal(r.mensajesPorConversacion)}
          detalle="Lo que escribe cada persona, en promedio"
        />
        <Kpi titulo="Dejaron sus datos" valor={numero(r.dejaronDatos)} detalle="Nombre y teléfono, desde la página" />
      </div>

      <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
        <h3 className="font-condensed text-lg font-black italic text-car-white">De mirar un auto a tocar WhatsApp</h3>
        <ol className="mt-3 space-y-3" aria-label="Embudo del asistente">
          {pasos.map((p) => (
            <li key={p.clave} className="text-sm">
              <div className="flex justify-between gap-3 text-car-white/80">
                <span>{p.texto}</span>
                <span className="shrink-0 text-car-muted">{numero(p.personas)}</span>
              </div>
              <div className="mt-1 h-2 rounded bg-white/5">
                <div className="h-2 rounded bg-car-gold" style={{ width: `${(p.personas / maxEmbudo) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-car-muted">Cada paso cuenta personas distintas.</p>
      </div>

      {!compacto && (
        <>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
            <h3 className="font-condensed text-lg font-black italic text-car-white">Autos por los que más preguntan</h3>
            {autos.length === 0 ? (
              <p className="mt-3 text-sm text-car-muted">Todavía no hay consultas por un auto en este período.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {autos.map((a) => (
                  <li key={a.slug} className="text-sm">
                    <div className="flex justify-between gap-3 text-car-white/80">
                      <span className="truncate">{nombresAutos?.[a.slug] ?? a.slug}</span>
                      <span className="shrink-0 text-car-muted">{numero(a.conversaciones)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-white/5">
                      <div className="h-2 rounded bg-[#4c6fff]" style={{ width: `${(a.conversaciones / maxAuto) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
            <h3 className="font-condensed text-lg font-black italic text-car-white">Lo que el asistente no entendió</h3>
            {r.noEntendidos.length === 0 ? (
              <p className="mt-3 text-sm text-car-muted">Sin fallas en este período.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {r.noEntendidos.map((n) => (
                  <li key={n.texto} className="flex justify-between gap-3 text-sm text-car-white/80">
                    <span className="min-w-0 break-words">&ldquo;{n.texto}&rdquo;</span>
                    <span className="shrink-0 text-car-muted">{n.veces === 1 ? "1 vez" : `${numero(n.veces)} veces`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
          <h3 className="font-condensed text-lg font-black italic text-car-white">Chat y simulador</h3>
          <p className="mt-2 text-sm leading-6 text-car-white/80">
            En este período hubo {numero(c.simulaciones)} {c.simulaciones === 1 ? "simulación" : "simulaciones"} de financiación, el chat armó{" "}
            {numero(c.mensajesArmados)} {c.mensajesArmados === 1 ? "mensaje" : "mensajes"} para Marcos y se tocó &ldquo;Enviar por WhatsApp&rdquo;{" "}
            {numero(c.toquesWhatsappChat)} {c.toquesWhatsappChat === 1 ? "vez" : "veces"} desde el chat.
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
          <h3 className="font-condensed text-lg font-black italic text-car-white">Personas por día</h3>
          <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label="Personas que escribieron en el chat por día">
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
        </>
      )}
    </section>
  );
}
