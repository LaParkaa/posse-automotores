"use client";
import { useEffect, useRef, useState } from "react";

export type AutocompleteOption = { value: string; label: string };

const inputClass =
  "w-full rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Campo de texto con búsqueda en vivo: escribís y filtra, clickeás una opción y queda elegida.
 * Reemplaza un <select> nativo cuando hay demasiadas opciones para scrollear a mano
 * (stock propio, catálogo de referencia de vehículos).
 */
export function Autocomplete({
  options,
  value,
  onSelect,
  placeholder,
}: {
  options: AutocompleteOption[];
  /** Id de la opción ya elegida (si la hay). No hace falta si este campo solo sirve para autocompletar otros. */
  value?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}) {
  const seleccionado = options.find((o) => o.value === value) ?? null;
  const [texto, setTexto] = useState(seleccionado?.label ?? "");
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTexto(seleccionado?.label ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la opción elegida desde afuera
  }, [seleccionado?.label]);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  const mostrandoSeleccionActual = seleccionado !== null && texto === seleccionado.label;
  const coincidencias =
    texto.trim() === "" || mostrandoSeleccionActual
      ? options
      : options.filter((o) => normalizar(o.label).includes(normalizar(texto)));

  return (
    <div ref={contenedorRef} className="relative">
      <input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          if (value) onSelect("");
        }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        className={inputClass}
      />
      {abierto && coincidencias.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded border border-white/15 bg-car-gray2 shadow-xl">
          {coincidencias.slice(0, 50).map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  onSelect(o.value);
                  setTexto(o.label);
                  setAbierto(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-car-white hover:bg-car-gold/15 hover:text-car-gold"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto && texto.trim() !== "" && !mostrandoSeleccionActual && coincidencias.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-muted">
          Sin resultados
        </div>
      )}
    </div>
  );
}
