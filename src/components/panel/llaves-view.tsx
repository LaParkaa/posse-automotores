"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { KeyRound, Search, X } from "lucide-react";
import { buscarLlaveAuto } from "@/app/panel/llaves-actions";
import { autosConLlave, filtrarLlaves, type VehiculoLlave } from "@/lib/llaves/consulta";
import type { Vehiculo } from "@/lib/types";
import { LlaveCard } from "./llave-card";
import { LlaveSheet, type CambioLlave } from "./llave-sheet";
import { SincronizarLlaves, SYNC_INICIAL, type EstadoSync } from "./sincronizar-llaves";

type Filtro = "todas" | "sin" | "con";

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todas", texto: "Todas" },
  { valor: "sin", texto: "Sin llave" },
  { valor: "con", texto: "Con llave" },
];

/**
 * Pestaña "Llaves" del panel: la foto de la llave física de cada auto, con buscador instantáneo, para agarrar la
 * correcta del tablero sin dudar. Desde acá también se buscan solas las fotos que faltan o se corrigen a mano.
 */
export function LlavesView({
  vehiculos,
  onToast,
}: {
  vehiculos: Vehiculo[];
  onToast: (texto: string, tono: "ok" | "error") => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  // Lo que se cambió en esta sesión se ve al instante, sin esperar a que el servidor y el tiempo real devuelvan la fila.
  const [cambios, setCambios] = useState<Record<string, CambioLlave>>({});
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [sync, setSync] = useState<EstadoSync>(SYNC_INICIAL);
  const cancelarRef = useRef(false);

  const autos: VehiculoLlave[] = useMemo(
    () =>
      autosConLlave(vehiculos).map((v) => {
        const c = cambios[v.id];
        return {
          ...v,
          key_image_url: c && c.key !== undefined ? c.key : v.key_image_url,
          patente: c && c.patente !== undefined ? c.patente : v.patente,
        };
      }),
    [vehiculos, cambios],
  );

  const sinLlave = useMemo(() => autos.filter((a) => !a.key_image_url), [autos]);
  const visibles = useMemo(() => {
    const porFiltro = autos.filter((a) => (filtro === "sin" ? !a.key_image_url : filtro === "con" ? a.key_image_url : true));
    return filtrarLlaves(porFiltro, busqueda);
  }, [autos, filtro, busqueda]);

  const abierto = abiertoId ? (autos.find((a) => a.id === abiertoId) ?? null) : null;
  const cerrar = useCallback(() => setAbiertoId(null), []);
  const alCambiar = useCallback((id: string, cambio: CambioLlave) => {
    setCambios((previos) => ({ ...previos, [id]: { ...previos[id], ...cambio } }));
  }, []);

  async function sincronizar() {
    const pendientes = sinLlave;
    if (pendientes.length === 0) return;
    cancelarRef.current = false;
    let estado: EstadoSync = { ...SYNC_INICIAL, corriendo: true, total: pendientes.length };
    setSync(estado);

    for (const auto of pendientes) {
      if (cancelarRef.current) break;
      estado = { ...estado, actual: `${auto.marca} ${auto.modelo}` };
      setSync(estado);

      try {
        const r = await buscarLlaveAuto(auto.id);
        if (r.ok) {
          alCambiar(auto.id, { key: r.url ?? null });
          estado = { ...estado, encontradas: estado.encontradas + 1 };
        } else if (r.codigo === "sin_proveedor") {
          estado = { ...estado, faltaConfigurar: true };
          break;
        } else {
          estado = { ...estado, sinResultado: estado.sinResultado + 1 };
        }
      } catch {
        estado = { ...estado, error: "Se cortó la conexión. Podés volver a tocar el botón: sigue con las que faltan." };
        break;
      }
      estado = { ...estado, hechos: estado.hechos + 1 };
      setSync(estado);
    }

    setSync({ ...estado, corriendo: false, actual: null, terminado: !estado.faltaConfigurar && !estado.error, cancelado: cancelarRef.current });
    if (estado.encontradas > 0) {
      onToast(`${estado.encontradas} ${estado.encontradas === 1 ? "llave nueva" : "llaves nuevas"}`, "ok");
    }
  }

  return (
    <div className="space-y-4">
      <SincronizarLlaves
        faltantes={sinLlave.length}
        estado={sync}
        onIniciar={() => void sincronizar()}
        onCancelar={() => {
          cancelarRef.current = true;
        }}
      />

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-car-muted" aria-hidden />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Marca, modelo, año o patente…"
          aria-label="Buscar una llave"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-12 w-full rounded-full border border-white/15 bg-car-gray2 pl-11 pr-11 text-base text-car-white placeholder:text-car-muted/60 focus:border-car-gold focus:outline-none"
        />
        {busqueda !== "" && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
            aria-label="Borrar la búsqueda"
            className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-car-muted active:bg-white/10"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {FILTROS.map(({ valor, texto }) => {
          const cantidad = valor === "todas" ? autos.length : valor === "sin" ? sinLlave.length : autos.length - sinLlave.length;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              aria-pressed={filtro === valor}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-bold uppercase tracking-wide transition ${
                filtro === valor ? "bg-car-gold text-car-black" : "bg-car-gray2 text-car-muted active:bg-white/10"
              }`}
            >
              {texto}
              <span className={`rounded-full px-1.5 text-xs ${filtro === valor ? "bg-car-black/15" : "bg-white/10"}`}>{cantidad}</span>
            </button>
          );
        })}
      </div>

      {autos.length === 0 ? (
        <Vacio titulo="No hay autos en venta" texto="Cuando cargues autos van a aparecer acá con su llave." />
      ) : visibles.length === 0 ? (
        <Vacio titulo="No hay llaves que coincidan" texto="Probá con otra marca, modelo o patente." />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {visibles.map((v) => (
            <LlaveCard key={v.id} vehiculo={v} onAbrir={() => setAbiertoId(v.id)} />
          ))}
        </ul>
      )}

      {abierto && <LlaveSheet key={abierto.id} vehiculo={abierto} onCerrar={cerrar} onCambio={alCambiar} onToast={onToast} />}
    </div>
  );
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <KeyRound size={36} strokeWidth={1.4} className="text-car-gold/60" />
      <p className="font-condensed text-lg font-black italic text-car-white">{titulo}</p>
      <p className="max-w-xs text-sm text-car-muted">{texto}</p>
    </div>
  );
}
