import Link from "next/link";
import { visitasDeAnuncios } from "@/lib/anuncios";
import type { Resumen } from "@/lib/estadisticas";

export const PERIODOS = [
  { dias: 1, texto: "Últimas 24 horas" },
  { dias: 7, texto: "Últimos 7 días" },
  { dias: 30, texto: "Últimos 30 días" },
  { dias: 90, texto: "Últimos 90 días" },
] as const;

const NOMBRE_ORIGEN: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", google: "Google", whatsapp: "WhatsApp", directo: "Directo (link, favoritos)", otro: "Otro sitio",
};

const porcentaje = (parte: number, total: number) => (total === 0 ? 0 : Math.round((parte / total) * 100));

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: number | string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
      <p className="text-xs uppercase tracking-wide text-car-muted">{titulo}</p>
      <p className="mt-1 font-condensed text-4xl font-black text-car-gold">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-car-muted">{detalle}</p>}
    </div>
  );
}

function Barras({ items, color }: { items: Array<{ texto: string; cantidad: number }>; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.cantidad));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.texto} className="text-sm">
          <div className="flex justify-between text-car-white/80">
            <span>{i.texto}</span>
            <span className="text-car-muted">{i.cantidad}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-white/5">
            <div className={`h-2 rounded ${color}`} style={{ width: `${(i.cantidad / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Las últimas 24 horas: cuánta gente entró en cada hora (sirve para ver el efecto de una historia de Instagram). */
function HoraPorHora({ horas }: { horas: Resumen["porHora"] }) {
  const max = Math.max(1, ...horas.map((h) => Math.max(h.visitas, h.consultas, h.simulaciones)));
  const series = [
    { clave: "visitas", color: "bg-car-gold" },
    { clave: "simulaciones", color: "bg-[#4c6fff]" },
    { clave: "consultas", color: "bg-[#25D366]" },
  ] as const;

  return (
    <section className="rounded-lg border border-white/10 bg-car-gray2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-condensed text-xl font-black italic text-car-white">Hora por hora</h2>
        <p className="flex gap-4 text-xs text-car-muted">
          <span><span className="mr-1 inline-block size-2 rounded-sm bg-car-gold" />Visitas</span>
          <span><span className="mr-1 inline-block size-2 rounded-sm bg-[#4c6fff]" />Simulaciones</span>
          <span><span className="mr-1 inline-block size-2 rounded-sm bg-[#25D366]" />Consultas</span>
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="flex h-44 items-end gap-1" role="img" aria-label="Visitas, simulaciones y consultas por hora">
            {horas.map((h) => (
              <div
                key={h.hora}
                className="flex h-full flex-1 flex-col justify-end"
                title={`${h.etiqueta.replace(" h", "")}:00 a ${h.etiqueta.replace(" h", "")}:59 · ${h.visitas} visitas, ${h.simulaciones} simulaciones, ${h.consultas} consultas`}
              >
                <span className="mb-0.5 text-center text-[10px] font-semibold text-car-gold">{h.visitas > 0 ? h.visitas : ""}</span>
                <div className="flex flex-1 items-end justify-center gap-px">
                  {series.map((s) => (
                    <div
                      key={s.clave}
                      className={`w-full max-w-2 rounded-t ${s.color}`}
                      style={{ height: `${(h[s.clave] / max) * 100}%`, minHeight: h[s.clave] > 0 ? 2 : 0 }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1 text-[10px] text-car-muted">
            {horas.map((h) => (
              <span key={h.hora} className="flex-1 text-center">{h.etiqueta.replace(" h", "")}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-car-muted">Hora argentina. La última barra es la hora en curso. El número de arriba son las visitas de esa hora.</p>
    </section>
  );
}

/** El tablero de estadísticas (sin pedir datos: recibe el resumen ya armado). */
export function EstadisticasVista({ resumen, dias }: { resumen: Resumen; dias: number }) {
  const r = resumen;
  const deAnuncios = visitasDeAnuncios();
  const maxDia = Math.max(1, ...r.porDia.map((d) => Math.max(d.visitas, d.consultas)));
  const totalDispositivos = r.dispositivos.celular + r.dispositivos.compu;
  // En muchos días las etiquetas no entran: se muestra una cada tanto.
  const cadaCuanto = Math.ceil(r.porDia.length / 10);

  return (
    <div className="space-y-8">
      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.dias}
            href={`/admin/estadisticas?dias=${p.dias}`}
            aria-current={p.dias === dias ? "true" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              p.dias === dias ? "border-car-gold bg-car-gold/10 text-car-white" : "border-white/15 text-car-white/70 hover:border-car-gold/50"
            }`}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          titulo="Visitas totales"
          valor={r.visitas + deAnuncios}
          detalle={deAnuncios > 0 ? `${r.visitas} del sitio + ${deAnuncios} de anuncios de Instagram` : "Páginas vistas"}
        />
        <Kpi titulo="Visitantes" valor={r.visitantes} detalle="Personas distintas" />
        <Kpi
          titulo="Consultas por WhatsApp"
          valor={r.consultas}
          detalle={r.visitantes > 0 ? `${porcentaje(r.consultas, r.visitantes)}% de los visitantes` : undefined}
        />
        <Kpi titulo="Simulaciones" valor={r.simulaciones} detalle="Financiación" />
      </section>

      {dias === 1 ? <HoraPorHora horas={r.porHora} /> : (
      <section className="rounded-lg border border-white/10 bg-car-gray2 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-condensed text-xl font-black italic text-car-white">Día por día</h2>
          <p className="flex gap-4 text-xs text-car-muted">
            <span><span className="mr-1 inline-block size-2 rounded-sm bg-car-gold" />Visitas</span>
            <span><span className="mr-1 inline-block size-2 rounded-sm bg-[#25D366]" />Consultas</span>
          </p>
        </div>
        <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label="Visitas y consultas por día">
          {r.porDia.map((d) => (
            <div key={d.dia} className="flex h-full flex-1 items-end justify-center gap-px" title={`${d.etiqueta}: ${d.visitas} visitas, ${d.consultas} consultas`}>
              <div className="w-full max-w-3 rounded-t bg-car-gold" style={{ height: `${(d.visitas / maxDia) * 100}%`, minHeight: d.visitas > 0 ? 2 : 0 }} />
              <div className="w-full max-w-3 rounded-t bg-[#25D366]" style={{ height: `${(d.consultas / maxDia) * 100}%`, minHeight: d.consultas > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1 text-[10px] text-car-muted">
          {r.porDia.map((d, i) => (
            <span key={d.dia} className="flex-1 text-center">{i % cadaCuanto === 0 ? d.etiqueta : ""}</span>
          ))}
        </div>
      </section>
      )}

      <section>
        <h2 className="font-condensed text-xl font-black italic text-car-white">Autos más consultados</h2>
        <p className="mt-1 text-sm text-car-muted">
          Ordenados por toques al botón de WhatsApp de cada auto. {r.consultasSinAuto > 0 && `Otras ${r.consultasSinAuto} consultas fueron desde botones generales (menú, inicio).`}
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-car-gray2 text-xs uppercase tracking-wide text-car-muted">
                <th className="px-4 py-3 text-left">Auto</th>
                <th className="px-4 py-3 text-right">Visitas</th>
                <th className="px-4 py-3 text-right">WhatsApp</th>
                <th className="px-4 py-3 text-right">Simulaciones</th>
              </tr>
            </thead>
            <tbody>
              {r.autos.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-car-muted">Todavía no hay datos en este período.</td></tr>
              )}
              {r.autos.map((a) => (
                <tr key={a.slug} className="border-b border-white/5 bg-car-gray transition hover:bg-car-gray2">
                  <td className="px-4 py-3 font-semibold text-car-white">
                    <Link href={`/vehiculos/${a.slug}`} target="_blank" className="hover:text-car-gold">{a.nombre}</Link>
                  </td>
                  <td className="px-4 py-3 text-right text-car-muted">{a.visitas}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#25D366]">{a.consultas}</td>
                  <td className="px-4 py-3 text-right text-car-muted">{a.simulaciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
          <h2 className="mb-3 font-condensed text-xl font-black italic text-car-white">De dónde llegan</h2>
          {r.origenes.length === 0 ? (
            <p className="text-sm text-car-muted">Sin datos todavía.</p>
          ) : (
            <Barras items={r.origenes.map((o) => ({ texto: NOMBRE_ORIGEN[o.origen] ?? o.origen, cantidad: o.cantidad }))} color="bg-car-gold" />
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-car-gray2 p-4">
          <h2 className="mb-3 font-condensed text-xl font-black italic text-car-white">Desde qué dispositivo</h2>
          {totalDispositivos === 0 ? (
            <p className="text-sm text-car-muted">Sin datos todavía.</p>
          ) : (
            <Barras
              items={[
                { texto: `Celular (${porcentaje(r.dispositivos.celular, totalDispositivos)}%)`, cantidad: r.dispositivos.celular },
                { texto: `Compu (${porcentaje(r.dispositivos.compu, totalDispositivos)}%)`, cantidad: r.dispositivos.compu },
              ]}
              color="bg-[#4c6fff]"
            />
          )}
        </div>
      </section>

      <p className="text-xs leading-5 text-car-muted">
        Se cuentan las visitas y los toques a botones de WhatsApp del sitio público. No se guardan nombres, teléfonos ni IP, y no se
        cuentan robots, el panel ni a quienes tienen activado &quot;No rastrear&quot;. Un toque a WhatsApp es una consulta iniciada: no
        asegura que la persona haya enviado el mensaje. Los datos se guardan hasta 120 días.
      </p>
    </div>
  );
}
