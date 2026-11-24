import { CircleCheck, Info, LoaderCircle, Sparkles } from "lucide-react";

export type EstadoSync = {
  corriendo: boolean;
  total: number;
  hechos: number;
  encontradas: number;
  sinResultado: number;
  /** Nombre del auto que se está buscando ahora. */
  actual: string | null;
  /** La búsqueda no está configurada: no tiene sentido seguir. */
  faltaConfigurar: boolean;
  /** Mensaje de un error que cortó la búsqueda. */
  error: string | null;
  /** Ya terminó una vuelta (para mostrar el resumen). */
  terminado: boolean;
  cancelado: boolean;
};

export const SYNC_INICIAL: EstadoSync = {
  corriendo: false,
  total: 0,
  hechos: 0,
  encontradas: 0,
  sinResultado: 0,
  actual: null,
  faltaConfigurar: false,
  error: null,
  terminado: false,
  cancelado: false,
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Botón mágico: busca solo las fotos de todas las llaves que faltan, con barra de progreso. */
export function SincronizarLlaves({
  faltantes,
  estado,
  onIniciar,
  onCancelar,
}: {
  faltantes: number;
  estado: EstadoSync;
  onIniciar: () => void;
  onCancelar: () => void;
}) {
  const porcentaje = estado.total === 0 ? 0 : Math.round((estado.hechos / estado.total) * 100);

  return (
    <section
      aria-label="Sincronizar llaves faltantes"
      className="overflow-hidden rounded-2xl border border-car-gold/30 bg-gradient-to-br from-car-gold/20 via-car-gray to-car-gray p-4 shadow-lg shadow-black/30"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-car-gold text-car-black shadow-[0_0_20px_rgba(201,162,39,0.45)]">
          {estado.corriendo ? <LoaderCircle size={22} className="animate-spin" /> : <Sparkles size={22} />}
        </span>
        <div className="min-w-0">
          <h2 className="font-condensed text-lg font-black italic uppercase leading-none tracking-wide text-car-white">
            Sincronizar llaves
          </h2>
          <p className="mt-1 text-xs text-car-muted">
            {estado.corriendo
              ? "Buscando las fotos, no cierres esta pantalla"
              : faltantes > 0
                ? `${plural(faltantes, "auto sin foto de llave", "autos sin foto de llave")}`
                : "Todos los autos tienen su llave"}
          </p>
        </div>
      </div>

      {estado.corriendo ? (
        <div className="mt-4">
          <div
            className="h-2.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={estado.total}
            aria-valuenow={estado.hechos}
            aria-label="Progreso de la búsqueda de llaves"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-car-gold to-[#f0d36b] transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(porcentaje, 4)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-car-white/80">
              {estado.hechos} de {estado.total}
              {estado.actual ? ` · ${estado.actual}` : ""}
            </span>
            <button type="button" onClick={onCancelar} className="min-h-9 shrink-0 font-bold uppercase text-car-muted underline active:text-car-white">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          {faltantes > 0 && (
            <button
              type="button"
              onClick={onIniciar}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-car-gold px-4 font-condensed text-base font-black uppercase tracking-wide text-car-black shadow-[0_4px_0_#8a6f14] transition active:translate-y-[2px] active:shadow-[0_2px_0_#8a6f14]"
            >
              <Sparkles size={18} /> Buscar {plural(faltantes, "llave", "llaves")}
            </button>
          )}

          {estado.terminado && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-black/25 px-3 py-2.5 text-sm text-car-white/90" role="status">
              <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              <span>
                {estado.cancelado ? "Búsqueda cancelada. " : ""}
                {plural(estado.encontradas, "llave encontrada", "llaves encontradas")}
                {estado.sinResultado > 0
                  ? `, ${plural(estado.sinResultado, "sin resultado", "sin resultado")}. Para esas, tocá el auto y pegá un link o sacá una foto.`
                  : "."}
              </span>
            </p>
          )}

          {estado.faltaConfigurar && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100" role="alert">
              <Info size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <span>
                Falta conectar el buscador de imágenes. Cargá la clave <b>SERPER_API_KEY</b> en Vercel (la guía está en <b>docs/llaveros.md</b>).
                Mientras tanto podés cargar las fotos a mano tocando cada auto.
              </span>
            </p>
          )}

          {estado.error && !estado.faltaConfigurar && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200" role="alert">
              {estado.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
