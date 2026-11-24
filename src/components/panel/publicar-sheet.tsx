"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, ImageOff, LoaderCircle, Share2, TriangleAlert, X } from "lucide-react";
import { NEGOCIO } from "@/lib/bot/negocio";
import { armarAviso, avisoComoTexto, type Plataforma } from "@/lib/publicar/aviso";
import { compartirFotos, depsDelNavegador, fotosDelAuto } from "@/lib/publicar/fotos";
import { PLATAFORMAS } from "@/lib/publicar/plataformas";
import type { Vehiculo } from "@/lib/types";
import { LogoPlataforma } from "./logos-plataformas";

const ORDEN: Plataforma[] = ["mercadolibre", "marketplace"];
const MAX_TITULO_MERCADOLIBRE = 60;

const BOTON_COPIAR =
  "flex size-11 shrink-0 items-center justify-center rounded-full bg-car-gray2 text-car-muted transition active:scale-95 active:bg-white/10";

/** Copia al portapapeles; si el navegador no deja usar la API moderna (algunos celulares), prueba el método viejo. */
async function escribirPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Sigue con el método de respaldo.
  }
  try {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    campo.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Hoja de abajo hacia arriba con el aviso ya armado para Mercado Libre o Marketplace: se copia cada campo (o todo
 * junto), se comparten las fotos y un botón abre la pantalla de publicar de la plataforma.
 */
export function PublicarSheet({
  vehiculo,
  onCerrar,
  onToast,
}: {
  vehiculo: Vehiculo;
  onCerrar: () => void;
  onToast: (texto: string, tono: "ok" | "error") => void;
}) {
  const [visible, setVisible] = useState(false);
  const [plataforma, setPlataforma] = useState<Plataforma>("mercadolibre");
  // Lo que se edita de la descripción; al cambiar de plataforma se vuelve a armar el texto de esa plataforma.
  const [edicion, setEdicion] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [bajando, setBajando] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  // Entrada suave desde abajo, foco en "cerrar", Esc para salir y fondo quieto mientras está abierta.
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => setVisible(true));
    cerrarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alTeclear);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(cuadro);
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = anterior;
    };
  }, [onCerrar]);

  useEffect(() => {
    if (!copiado) return;
    const id = setTimeout(() => setCopiado(null), 1500);
    return () => clearTimeout(id);
  }, [copiado]);

  const aviso = useMemo(() => armarAviso(vehiculo, plataforma, NEGOCIO), [vehiculo, plataforma]);
  const fotos = useMemo(() => fotosDelAuto(vehiculo), [vehiculo]);
  const descripcion = edicion ?? aviso.descripcion;
  const marca = PLATAFORMAS[plataforma];

  async function copiar(clave: string, texto: string, nombre: string) {
    if (await escribirPortapapeles(texto)) {
      setCopiado(clave);
      onToast(`${nombre} copiado`, "ok");
    } else {
      onToast("No se pudo copiar. Mantené apretado el texto para copiarlo a mano.", "error");
    }
  }

  async function alCompartirFotos() {
    setBajando(true);
    try {
      const r = await compartirFotos(fotos, vehiculo.nombre, depsDelNavegador);
      if (r.estado === "compartido") onToast("Fotos listas para pegar", "ok");
      else if (r.estado === "descargado") onToast("Fotos descargadas", "ok");
      else if (r.estado === "error") onToast(r.mensaje, "error");
    } finally {
      setBajando(false);
    }
  }

  function elegir(siguiente: Plataforma) {
    if (siguiente === plataforma) return;
    setPlataforma(siguiente);
    setEdicion(null);
  }

  const icono = (clave: string) => (copiado === clave ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Publicar ${vehiculo.nombre}`}>
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onCerrar}
        className={`absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />

      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[94dvh] max-w-lg flex-col overflow-y-auto rounded-t-3xl border-t border-white/10 bg-car-gray shadow-2xl transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-car-gray/95 px-4 pb-1 pt-3 backdrop-blur">
          <span className="mx-auto h-1.5 w-12 rounded-full bg-white/20" aria-hidden />
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-3 top-2 flex size-10 items-center justify-center rounded-full bg-car-gray2 text-car-white active:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-2">
          <h2 className="font-condensed text-2xl font-black italic leading-none text-car-white">Publicar aviso</h2>
          <p className="mt-1 truncate text-sm text-car-muted">{vehiculo.nombre}</p>

          {/* Selector: cada plataforma con su logo y su color. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {ORDEN.map((p) => {
              const datos = PLATAFORMAS[p];
              const activa = p === plataforma;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => elegir(p)}
                  aria-pressed={activa}
                  className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl px-2 font-condensed text-base font-black italic leading-tight transition active:scale-[0.97] ${
                    activa ? "opacity-100 shadow-lg ring-2 ring-car-gold ring-offset-2 ring-offset-car-gray" : "opacity-55"
                  }`}
                  style={{ backgroundColor: datos.fondo, color: datos.texto }}
                >
                  <LogoPlataforma plataforma={p} tamano={26} />
                  {datos.nombre}
                </button>
              );
            })}
          </div>

          {/* Título */}
          <section className="mt-5" aria-label="Título">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-car-muted">Título</h3>
              {plataforma === "mercadolibre" && (
                <span className="text-[11px] text-car-muted">
                  {aviso.titulo.length}/{MAX_TITULO_MERCADOLIBRE}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 rounded-xl border border-white/10 bg-car-gray2 px-3 py-2.5 font-condensed text-lg font-bold leading-tight text-car-white [overflow-wrap:anywhere]">
                {aviso.titulo}
              </p>
              <button
                type="button"
                onClick={() => copiar("titulo", aviso.titulo, "Título")}
                aria-label="Copiar el título"
                className={BOTON_COPIAR}
              >
                {icono("titulo")}
              </button>
            </div>
          </section>

          {/* Descripción editable */}
          <section className="mt-4" aria-label="Descripción">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-car-muted">Descripción</h3>
              <button
                type="button"
                onClick={() => copiar("descripcion", descripcion, "Descripción")}
                aria-label="Copiar la descripción"
                className={BOTON_COPIAR}
              >
                {icono("descripcion")}
              </button>
            </div>
            <textarea
              value={descripcion}
              onChange={(e) => setEdicion(e.target.value)}
              rows={9}
              className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-car-gray2 px-3 py-2.5 text-sm leading-relaxed text-car-white focus:border-car-gold focus:outline-none"
            />
          </section>

          {/* Datos */}
          <section className="mt-4" aria-label="Datos">
            <h3 className="text-xs font-bold uppercase tracking-wide text-car-muted">Datos del formulario</h3>
            <ul className="mt-1 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-car-gray2">
              {aviso.datos.map((d) => (
                <li key={d.etiqueta} className="flex items-center gap-2 py-1 pl-3 pr-1">
                  <span className="w-28 shrink-0 text-xs text-car-muted">{d.etiqueta}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-car-white">{d.valor}</span>
                  <button
                    type="button"
                    onClick={() => copiar(d.etiqueta, d.valor, d.etiqueta)}
                    aria-label={`Copiar ${d.etiqueta}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-car-muted active:bg-white/10"
                  >
                    {icono(d.etiqueta)}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={() => copiar("todo", avisoComoTexto({ ...aviso, descripcion }), "Aviso")}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-car-gold/50 bg-car-gold/10 font-condensed text-base font-black italic uppercase tracking-wide text-car-gold transition active:scale-[0.98]"
          >
            {copiado === "todo" ? <Check size={18} /> : <Copy size={18} />} Copiar todo
          </button>

          {/* Faltantes */}
          {aviso.faltantes.length > 0 && (
            <section className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3" aria-label="Completar a mano">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-300">
                <TriangleAlert size={16} /> Completar a mano en el formulario
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {aviso.faltantes.map((f) => (
                  <li key={f} className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100">
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Fotos */}
          <section className="mt-4" aria-label="Fotos">
            <h3 className="text-xs font-bold uppercase tracking-wide text-car-muted">Fotos ({fotos.length})</h3>
            {fotos.length === 0 ? (
              <div className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-6 text-sm text-car-muted">
                <ImageOff size={18} /> Sin fotos
              </div>
            ) : (
              <ul className="mt-1 grid grid-cols-3 gap-2">
                {fotos.map((url, i) => (
                  <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-car-gray2">
                    <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-car-black/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-car-gold">
                        Portada
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              data-accion="compartir-fotos"
              disabled={fotos.length === 0 || bajando}
              onClick={alCompartirFotos}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-car-gray2 text-sm font-bold uppercase tracking-wide text-car-white transition active:scale-[0.98] disabled:opacity-40"
            >
              {bajando ? <LoaderCircle size={18} className="animate-spin" /> : <Share2 size={18} />} Compartir fotos
            </button>
          </section>

          {/* Abrir la plataforma */}
          <a
            href={marca.urlPublicar}
            target="_blank"
            rel="noopener"
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-3 font-condensed text-base font-black italic leading-tight shadow-lg transition active:scale-[0.98]"
            style={{ backgroundColor: marca.fondo, color: marca.texto }}
          >
            <LogoPlataforma plataforma={plataforma} tamano={26} />
            {`Abrir ${marca.nombre} para publicar`}
            <ExternalLink size={18} />
          </a>
        </div>
      </div>
    </div>
  );
}
