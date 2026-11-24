"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, KeyRound, LoaderCircle, Link2, Pencil, Sparkles, Trash2, X } from "lucide-react";
import {
  buscarLlaveAuto,
  guardarLlaveDesdeUrl,
  guardarPatente,
  quitarLlave,
  subirLlave,
  type ResultadoLlaveAccion,
} from "@/app/panel/llaves-actions";
import type { VehiculoLlave } from "@/lib/llaves/consulta";
import { comprimirFoto } from "@/lib/llaves/comprimir";
import { FONDO_LLAVE, Placa } from "./llave-card";

export type CambioLlave = { key?: string | null; patente?: string | null };
type Ocupado = "buscar" | "link" | "foto" | "quitar" | "patente" | null;
type Modo = "menu" | "link" | "patente";

const TEXTOS_OCUPADO: Record<Exclude<Ocupado, null>, string> = {
  buscar: "Buscando la llave en internet…",
  link: "Bajando la imagen…",
  foto: "Subiendo la foto…",
  quitar: "Quitando…",
  patente: "Guardando…",
};

const BOTON =
  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-car-gray2 px-2 text-[11px] font-bold uppercase tracking-wide text-car-white transition active:scale-[0.97] active:bg-white/10 disabled:opacity-40";

function mensajeDe(r: Extract<ResultadoLlaveAccion, { ok: false }>): string {
  if (r.codigo === "sin_proveedor") {
    return "Falta conectar el buscador de imágenes. Mientras tanto podés pegar un link o sacar una foto.";
  }
  if (r.codigo === "sin_resultados") return "No encontré una imagen buena. Probá pegando un link o sacándole una foto.";
  return r.error;
}

export function LlaveSheet({
  vehiculo,
  onCerrar,
  onCambio,
  onToast,
}: {
  vehiculo: VehiculoLlave;
  onCerrar: () => void;
  onCambio: (id: string, cambio: CambioLlave) => void;
  onToast: (texto: string, tono: "ok" | "error") => void;
}) {
  const [visible, setVisible] = useState(false);
  const [modo, setModo] = useState<Modo>("menu");
  const [ocupado, setOcupado] = useState<Ocupado>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [patente, setPatente] = useState(vehiculo.patente ?? "");
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

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

  async function correr(tipo: Exclude<Ocupado, null>, accion: () => Promise<ResultadoLlaveAccion>, exito: string) {
    setOcupado(tipo);
    setError(null);
    try {
      const r = await accion();
      if (r.ok) {
        const cambio: CambioLlave = {};
        if (r.url !== undefined) cambio.key = r.url;
        if (r.patente !== undefined) cambio.patente = r.patente;
        onCambio(vehiculo.id, cambio);
        onToast(exito, "ok");
        setModo("menu");
        setLink("");
      } else {
        setError(mensajeDe(r));
      }
    } catch {
      setError("No se pudo conectar. Revisá la señal y probá de nuevo.");
    } finally {
      setOcupado(null);
    }
  }

  async function alElegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    await correr(
      "foto",
      async () => {
        let foto: Blob;
        try {
          foto = await comprimirFoto(archivo);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "No se pudo preparar la foto" };
        }
        const datos = new FormData();
        datos.append("archivo", new File([foto], "llave.jpg", { type: "image/jpeg" }));
        return subirLlave(vehiculo.id, datos);
      },
      "Foto de la llave guardada",
    );
    if (archivoRef.current) archivoRef.current.value = "";
  }

  const trabajando = ocupado !== null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Llave de ${vehiculo.marca} ${vehiculo.modelo}`}>
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

        <div className={`relative mx-4 mt-2 aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 ${FONDO_LLAVE}`}>
          {vehiculo.key_image_url ? (
            <img
              src={vehiculo.key_image_url}
              alt={`Llave de ${vehiculo.marca} ${vehiculo.modelo}`}
              className="absolute inset-0 size-full object-contain p-5 drop-shadow-[0_14px_18px_rgba(0,0,0,0.65)]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-car-muted">
              <KeyRound size={44} strokeWidth={1.4} className="text-car-gold/70" />
              <span className="text-xs font-bold uppercase tracking-wide">Todavía no tiene foto de llave</span>
            </div>
          )}

          {trabajando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-car-black/70 backdrop-blur-sm" role="status">
              <LoaderCircle size={30} className="animate-spin text-car-gold" />
              <span className="text-xs font-bold uppercase tracking-wide text-car-white">{TEXTOS_OCUPADO[ocupado]}</span>
            </div>
          )}
        </div>

        <div className="px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-condensed text-2xl font-black italic leading-none text-car-white">
                {vehiculo.marca} {vehiculo.modelo}
              </h2>
              <p className="mt-1 text-sm text-car-muted">
                <span className="font-condensed font-bold text-car-gold">{vehiculo.anio}</span> · {vehiculo.nombre}
              </p>
            </div>
            {modo !== "patente" && (
              <button
                type="button"
                onClick={() => setModo("patente")}
                disabled={trabajando}
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-1 transition active:opacity-60 disabled:opacity-40"
                aria-label={vehiculo.patente ? "Cambiar la patente" : "Agregar la patente"}
              >
                {vehiculo.patente ? (
                  <Placa patente={vehiculo.patente} grande />
                ) : (
                  <span className="rounded-lg border border-dashed border-white/25 px-3 py-2 text-xs font-bold uppercase text-car-muted">
                    + Patente
                  </span>
                )}
                {vehiculo.patente && <Pencil size={14} className="text-car-muted" />}
              </button>
            )}
          </div>

          {modo === "patente" && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void correr("patente", () => guardarPatente(vehiculo.id, patente), "Patente guardada");
              }}
            >
              <input
                autoFocus
                value={patente}
                onChange={(e) => setPatente(e.target.value.toUpperCase())}
                placeholder="AB123CD"
                maxLength={12}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Patente"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-car-gray2 px-4 font-mono text-base uppercase tracking-widest text-car-white placeholder:text-car-muted/50 focus:border-car-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={trabajando}
                className="flex min-h-12 items-center gap-1 rounded-xl bg-car-gold px-4 text-sm font-black uppercase text-car-black active:scale-[0.97] disabled:opacity-50"
              >
                <Check size={18} /> Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo("menu");
                  setPatente(vehiculo.patente ?? "");
                  setError(null);
                }}
                aria-label="Cancelar"
                className="flex min-h-12 items-center rounded-xl bg-car-gray2 px-3 text-car-muted active:bg-white/10"
              >
                <X size={18} />
              </button>
            </form>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" className={BOTON} disabled={trabajando} onClick={() => void correr("buscar", () => buscarLlaveAuto(vehiculo.id), "Llave encontrada")}>
              <Sparkles size={20} className="text-car-gold" />
              {vehiculo.key_image_url ? "Buscar otra" : "Buscar sola"}
            </button>
            <button type="button" className={BOTON} disabled={trabajando} onClick={() => { setModo(modo === "link" ? "menu" : "link"); setError(null); }}>
              <Link2 size={20} className="text-car-gold" />
              Pegar link
            </button>
            <button type="button" className={BOTON} disabled={trabajando} onClick={() => archivoRef.current?.click()}>
              <Camera size={20} className="text-car-gold" />
              Foto
            </button>
          </div>

          {/* Sin "capture": en el celular ofrece sacar la foto o elegir una de la galería. */}
          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void alElegirFoto(e.target.files?.[0])}
          />

          {modo === "link" && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (link.trim() === "") return setError("Pegá el link de una imagen");
                void correr("link", () => guardarLlaveDesdeUrl(vehiculo.id, link), "Foto de la llave guardada");
              }}
            >
              <input
                autoFocus
                type="url"
                inputMode="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
                placeholder="https://… (link de la imagen)"
                aria-label="Link de la imagen"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-car-gray2 px-4 text-sm text-car-white placeholder:text-car-muted/50 focus:border-car-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={trabajando}
                className="flex min-h-12 items-center gap-1 rounded-xl bg-car-gold px-4 text-sm font-black uppercase text-car-black active:scale-[0.97] disabled:opacity-50"
              >
                Usar
              </button>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
              {error}
            </p>
          )}

          {vehiculo.key_image_url && (
            <button
              type="button"
              disabled={trabajando}
              onClick={() => {
                if (window.confirm("¿Quitar la foto de esta llave?")) {
                  void correr("quitar", () => quitarLlave(vehiculo.id), "Foto de la llave quitada");
                }
              }}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide text-car-muted transition active:text-red-300 disabled:opacity-40"
            >
              <Trash2 size={15} /> Quitar la foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
