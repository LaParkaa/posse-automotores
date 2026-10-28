"use client";
import { useRef, useState } from "react";
import {
  ESTADOS,
  PLAZOS,
  formatearMonto,
  montoDeTexto,
  urlFinanciacion,
  validar,
  type EstadoUsado,
  type Plazo,
  type SolicitudFinanciacion,
} from "@/lib/financiacion";

export type AutoParaFinanciar = { slug: string; etiqueta: string };

const OTRO_AUTO = "otro";

const TARJETA =
  "rounded-2xl border border-[#4c6fff]/35 bg-gradient-to-b from-[#1b2547] to-[#10172b] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_26px_rgba(76,111,255,0.18),0_12px_28px_rgba(0,0,0,0.45)]";
const CAMPO =
  "h-14 w-full rounded-xl border border-white/10 bg-car-gray2 px-4 text-base text-car-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition placeholder:text-car-muted focus:border-car-gold focus:shadow-[0_0_0_1px_rgba(201,162,39,0.6),0_0_18px_rgba(201,162,39,0.3)]";
const CAMPO_ERROR = "border-red-400/70";

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={`min-h-12 rounded-full border px-5 text-base font-semibold transition active:scale-95 ${
        activo
          ? "border-[#D4AF37] bg-[#D4AF37]/10 text-car-white shadow-[0_0_18px_rgba(212,175,55,0.45)]"
          : "border-white/15 bg-car-gray text-car-white/80 hover:border-[#D4AF37]/50"
      }`}
    >
      {children}
    </button>
  );
}

function Error({ texto }: { texto: string | undefined }) {
  return texto ? <p className="mt-1.5 text-sm text-red-300" role="alert">{texto}</p> : null;
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/**
 * Formulario de tres pasos que no calcula cuotas: junta los datos y abre WhatsApp con el mensaje armado para
 * Marcos. Las fotos del usado no se pueden adjuntar desde un link de WhatsApp, así que se piden en el chat.
 */
export function SimuladorFinanciacion({ autos, autoInicial }: { autos: AutoParaFinanciar[]; autoInicial?: string }) {
  const [autoSlug, setAutoSlug] = useState(autos.some((a) => a.slug === autoInicial) ? (autoInicial as string) : "");
  const [monto, setMonto] = useState(0);
  const [conPermuta, setConPermuta] = useState(false);
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [km, setKm] = useState("");
  const [estado, setEstado] = useState<EstadoUsado | null>(null);
  const [conFotos, setConFotos] = useState(false);
  const [nombre, setNombre] = useState("");
  const [plazo, setPlazo] = useState<Plazo>(24);
  const [intentado, setIntentado] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  const etiquetaAuto =
    autoSlug === OTRO_AUTO ? "Todavía no elegí un auto" : (autos.find((a) => a.slug === autoSlug)?.etiqueta ?? "");
  const solicitud: SolicitudFinanciacion = {
    auto: etiquetaAuto,
    monto,
    conPermuta,
    permuta: { modelo, anio, km, estado, conFotos },
    plazo,
    nombre,
  };
  const errores = intentado ? validar(solicitud) : {};

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    const pendientes = validar(solicitud);
    if (Object.keys(pendientes).length > 0) {
      // Lleva a la primera pregunta con problema, para no dejarla escondida más abajo.
      requestAnimationFrame(() => formulario.current?.querySelector<HTMLElement>("[data-error=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    const url = urlFinanciacion(solicitud);
    setEnlace(url);
    window.open(url, "_blank", "noopener");
  };

  return (
    <form ref={formulario} onSubmit={enviar} noValidate className="space-y-5">
      {/* 1. AUTO */}
      <section className={TARJETA} aria-labelledby="paso-1">
        <h2 id="paso-1" className="font-condensed text-xl font-black text-car-white">1. ¿Qué auto querés comprar?</h2>
        <div className="mt-4" data-error={Boolean(errores.auto)}>
          <select
            value={autoSlug}
            onChange={(e) => setAutoSlug(e.target.value)}
            aria-label="Auto que querés comprar"
            aria-invalid={Boolean(errores.auto)}
            className={`${CAMPO} ${errores.auto ? CAMPO_ERROR : ""} ${autoSlug === "" ? "text-car-muted" : ""}`}
          >
            <option value="" disabled>Elegir del catálogo…</option>
            {autos.map((a) => <option key={a.slug} value={a.slug}>{a.etiqueta}</option>)}
            <option value={OTRO_AUTO}>Otro / todavía no elegí</option>
          </select>
          <Error texto={errores.auto} />
        </div>
        <div className="mt-4" data-error={Boolean(errores.monto)}>
          <label htmlFor="monto" className="mb-2 block text-base text-car-white/90">Monto que querés financiar (ARS)</label>
          <input
            id="monto"
            inputMode="numeric"
            autoComplete="off"
            placeholder="$6.000.000"
            value={monto > 0 ? formatearMonto(monto) : ""}
            onChange={(e) => setMonto(montoDeTexto(e.target.value))}
            aria-invalid={Boolean(errores.monto)}
            className={`${CAMPO} ${errores.monto ? CAMPO_ERROR : ""}`}
          />
          <Error texto={errores.monto} />
        </div>
      </section>

      {/* 2. PERMUTA */}
      <section className={TARJETA} aria-labelledby="paso-2">
        <h2 id="paso-2" className="font-condensed text-xl font-black text-car-white">2. ¿Entregás tu usado como parte de pago?</h2>
        <div className="mt-4 flex gap-3" role="radiogroup" aria-labelledby="paso-2">
          <Chip activo={conPermuta} onClick={() => setConPermuta(true)}>Sí</Chip>
          <Chip activo={!conPermuta} onClick={() => setConPermuta(false)}>No</Chip>
        </div>

        {conPermuta && (
          <div className="mt-5 space-y-4">
            <div data-error={Boolean(errores.modelo)}>
              <input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Marca y modelo (ej: Peugeot 208)"
                aria-label="Marca y modelo de tu usado"
                aria-invalid={Boolean(errores.modelo)}
                maxLength={60}
                className={`${CAMPO} ${errores.modelo ? CAMPO_ERROR : ""}`}
              />
              <Error texto={errores.modelo} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div data-error={Boolean(errores.anio)}>
                <input
                  value={anio}
                  onChange={(e) => setAnio(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="Año (ej: 2018)"
                  aria-label="Año de tu usado"
                  aria-invalid={Boolean(errores.anio)}
                  className={`${CAMPO} ${errores.anio ? CAMPO_ERROR : ""}`}
                />
                <Error texto={errores.anio} />
              </div>
              <input
                value={km}
                onChange={(e) => setKm(e.target.value)}
                inputMode="numeric"
                placeholder="Kilómetros"
                aria-label="Kilómetros de tu usado"
                maxLength={30}
                className={CAMPO}
              />
            </div>
            <div>
              <p className="mb-2 text-base text-car-white/90">Estado del vehículo</p>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Estado del vehículo">
                {ESTADOS.map((e) => (
                  <Chip key={e} activo={estado === e} onClick={() => setEstado(estado === e ? null : e)}>{e}</Chip>
                ))}
              </div>
            </div>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                conFotos ? "border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_0_18px_rgba(212,175,55,0.3)]" : "border-dashed border-white/20 bg-white/[0.03]"
              }`}
            >
              <input
                type="checkbox"
                checked={conFotos}
                onChange={(e) => setConFotos(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-[#D4AF37]"
              />
              <span className="text-base leading-6 text-car-white/90">
                <span aria-hidden="true">📸 </span>Tengo fotos de mi usado para enviar por chat
                <span className="mt-1 block text-sm text-car-muted">
                  Las adjuntás en WhatsApp después de confirmar: desde la web no se pueden subir.
                </span>
              </span>
            </label>
          </div>
        )}
      </section>

      {/* 3. DATOS Y PLAZO */}
      <section className={TARJETA} aria-labelledby="paso-3">
        <h2 id="paso-3" className="font-condensed text-xl font-black text-car-white">3. Tus datos y preferencias</h2>
        <div className="mt-4" data-error={Boolean(errores.nombre)}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            aria-label="Tu nombre"
            autoComplete="given-name"
            aria-invalid={Boolean(errores.nombre)}
            maxLength={60}
            className={`${CAMPO} ${errores.nombre ? CAMPO_ERROR : ""}`}
          />
          <Error texto={errores.nombre} />
        </div>
        <div className="mt-5">
          <p className="mb-2 text-base text-car-white/90">Plazo deseado (cuotas)</p>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Plazo deseado en cuotas">
            {PLAZOS.map((p) => (
              <Chip key={p} activo={plazo === p} onClick={() => setPlazo(p)}>{p}</Chip>
            ))}
          </div>
        </div>
      </section>

      <div className="pt-2">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#f0d36b]/40 bg-gradient-to-b from-[#ecc94b] to-[#D4AF37] px-4 py-4 font-condensed text-base font-black uppercase tracking-wide text-car-black shadow-[0_5px_0_#8a6f14,0_12px_24px_rgba(201,162,39,0.35)] transition active:translate-y-[3px] active:shadow-[0_2px_0_#8a6f14]"
        >
          <WaIcon /> Confirmar y enviar a Marcos
        </button>
        <p className="mt-4 text-center text-sm leading-6 text-car-muted">
          Se armará tu propuesta y se enviará por WhatsApp para la confirmación final, sin compromiso.
        </p>
        {enlace && (
          <p className="mt-3 text-center text-sm text-car-white/80" role="status">
            Se abrió WhatsApp. Si no pasó nada,{" "}
            <a href={enlace} target="_blank" rel="noopener" className="font-semibold text-car-gold underline">tocá acá</a>.
          </p>
        )}
      </div>
    </form>
  );
}
