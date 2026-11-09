"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ETIQUETAS_OPCION, type OpcionId } from "@/lib/bot/web/tipos";
import { BurbujaChat, Escribiendo } from "./burbujas";
import type { EstadoChat } from "./estado";
import { AvatarRobot } from "./robot";

type Props = {
  id: string;
  estado: EstadoChat;
  onCerrar: () => void;
  onEnviar: (cuerpo: { texto: string } | { opcion: OpcionId }) => void;
};

const MAX_TEXTO = 500;

/**
 * Ventana del chat. En el celular es una hoja que tapa casi toda la pantalla (con "cerrar" siempre a la vista);
 * en la compu, una ventana de ~380 px abajo a la derecha, arriba del botón.
 */
export function Ventana({ id, estado, onCerrar, onEnviar }: Props) {
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const { burbujas, sugerencias, pendiente } = estado;

  // Foco al campo al abrir; Esc cierra desde cualquier lado de la página.
  useEffect(() => {
    campo.current?.focus({ preventScroll: true });
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  // En el celular la hoja tapa la página: que no se mueva lo de atrás.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  // Siempre a la vista lo último.
  useEffect(() => {
    const l = lista.current;
    if (l) l.scrollTop = l.scrollHeight;
  }, [burbujas.length, pendiente]);

  const mandar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || pendiente) return;
    onEnviar({ texto: t });
    setTexto("");
    campo.current?.focus();
  };

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Asistente de Posse Automotores"
      data-asistente=""
      className="fixed inset-x-0 bottom-0 top-3 z-[60] flex flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-car-gray text-car-white shadow-[0_-8px_40px_rgba(0,0,0,0.6)] sm:inset-auto sm:bottom-26 sm:right-7 sm:h-[min(640px,calc(100dvh-8.5rem))] sm:w-[380px] sm:rounded-2xl sm:shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
    >
      <header className="flex items-center gap-3 border-b border-white/10 bg-car-black/60 px-4 py-3">
        <span className="relative">
          <AvatarRobot tam={42} />
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-car-gray bg-[#25D366]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-condensed text-base font-bold leading-tight sm:text-lg">Asistente de Posse Automotores</p>
          <p className="flex items-center gap-1.5 text-xs text-[#4ade80]">
            <span className="size-1.5 rounded-full bg-[#25D366]" aria-hidden="true" />
            En línea
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el chat"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-car-white/70 transition hover:bg-white/10 hover:text-car-white"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div
        ref={lista}
        role="log"
        aria-live="polite"
        aria-label="Conversación"
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4"
      >
        {burbujas.map((b) => (
          <BurbujaChat key={b.id} burbuja={b} />
        ))}
        {pendiente && <Escribiendo />}
        {sugerencias.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-9">
            {sugerencias.map((op) => (
              <button
                key={op}
                type="button"
                disabled={pendiente}
                onClick={() => onEnviar({ opcion: op })}
                className="rounded-full border border-car-gold/50 px-3 py-1.5 text-sm text-car-gold transition hover:bg-car-gold hover:text-car-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-car-gold"
              >
                {ETIQUETAS_OPCION[op]}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={mandar} className="flex items-center gap-2 border-t border-white/10 bg-car-black/40 px-3 py-2">
        <input
          ref={campo}
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAX_TEXTO}
          placeholder="Escribí tu consulta…"
          aria-label="Tu mensaje"
          autoComplete="off"
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-car-gray2 px-4 py-2.5 text-base text-car-white placeholder:text-car-muted focus:border-car-gold focus:outline-none sm:text-sm"
        />
        <button
          type="submit"
          disabled={pendiente || texto.trim() === ""}
          aria-label="Enviar"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-car-gold text-car-black transition hover:bg-car-gold-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39 1.17L4.2 12l-2.19 7.23a1 1 0 001.39 1.17z" />
          </svg>
        </button>
      </form>
      <p className="bg-car-black/40 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-[11px] text-car-muted">
        <Link href="/privacidad" className="underline-offset-2 hover:text-car-gold hover:underline">
          Guardamos esta conversación para atenderte mejor
        </Link>
      </p>
    </div>
  );
}
