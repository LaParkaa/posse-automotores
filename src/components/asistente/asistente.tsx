"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ETIQUETAS_OPCION, type OpcionId, type Pagina } from "@/lib/bot/web/tipos";
import { registrarEvento } from "@/lib/rastreo";
import { buildWhatsAppUrlWeb } from "@/lib/utils";
import {
  cargarChatDeSesion,
  estadoInicial,
  globoYaMostrado,
  guardarChatEnSesion,
  leerRespuesta,
  marcarGloboMostrado,
  necesitaSaludo,
  reducirChat,
} from "./estado";
import { AvatarRobot } from "./robot";
import { idAlAzar, idDeVisitanteChat } from "./visitante";

// La ventana se baja recién cuando la persona abre el chat. La cara del robot del botón es una versión chica y
// diferida (sin `priority`), así no demora el primer pintado de la página.
const Ventana = dynamic(() => import("./ventana").then((m) => m.Ventana), { ssr: false });

const ID_VENTANA = "asistente-posse";
const CLAVE_ABRIO = "posse_chat_abrio";
const DEMORA_GLOBO_MS = 6000;
const TOPE_PEDIDO_MS = 15000;
const MAX_TEXTO = 500;

const TEXTO_GLOBO: Record<Pagina, string> = {
  ficha: "¿Querés saber si podés financiarlo? Preguntame",
  catalogo: "¿Buscás algo en particular? Te ayudo a encontrarlo",
};

type Cuerpo = { texto: string } | { opcion: OpcionId } | { inicio: true };

/** sessionStorage / localStorage pueden lanzar con solo nombrarlos (cookies bloqueadas). */
function almacen(cual: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[cual];
  } catch {
    return null;
  }
}

/** `chat_abrio` una sola vez por pestaña. */
function registrarApertura(slug: string | null) {
  const s = almacen("sessionStorage");
  try {
    if (s?.getItem(CLAVE_ABRIO)) return;
    s?.setItem(CLAVE_ABRIO, "1");
  } catch {
    /* sin storage se cuenta igual */
  }
  registrarEvento("chat_abrio", slug);
}

/**
 * Asistente de la web: botón flotante con el robot, globo que invita a preguntar y la ventana del chat.
 * Va en la ficha (con el slug del auto) y en el catálogo, en lugar del botón flotante de WhatsApp.
 */
export function Asistente({ pagina, slug = null }: { pagina: Pagina; slug?: string | null }) {
  const [estado, despachar] = useReducer(reducirChat, estadoInicial);
  const [globo, setGlobo] = useState(false);
  const lanzador = useRef<HTMLButtonElement>(null);
  const visitante = useRef<string | null>(null);
  const enVuelo = useRef(false);
  const abierto = useRef(false);
  const restaurado = useRef(false);
  const slugDeFicha = pagina === "ficha" ? slug : null;

  // Guarda la charla en la pestaña. Va antes que la restauración y saltea el estado inicial: nunca pisa lo guardado
  // con una charla vacía (tampoco con el doble montaje de React en desarrollo).
  useEffect(() => {
    if (!restaurado.current || estado === estadoInicial) return;
    const s = almacen("sessionStorage");
    if (s) guardarChatEnSesion(s, estado);
  }, [estado]);

  // Al montar: retoma la charla de esta pestaña (recargar o ir y volver de otra página) y programa el globo.
  useEffect(() => {
    const s = almacen("sessionStorage");
    const guardado = s ? cargarChatDeSesion(s) : null;
    restaurado.current = true;
    if (guardado) despachar({ tipo: "restaurar", guardado });
    if (!s || (guardado && guardado.burbujas.length > 0) || globoYaMostrado(s)) return;
    const t = setTimeout(() => {
      if (abierto.current) return;
      setGlobo(true);
      marcarGloboMostrado(s);
    }, DEMORA_GLOBO_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    abierto.current = estado.abierto;
  }, [estado.abierto]);

  const idVisitante = useCallback(() => {
    visitante.current ??= idDeVisitanteChat({
      local: almacen("localStorage"),
      sesion: almacen("sessionStorage"),
      crear: navigator.doNotTrack !== "1",
      nuevo: () => idAlAzar(),
    });
    return visitante.current;
  }, []);

  const pedir = useCallback(
    async (cuerpo: Cuerpo) => {
      enVuelo.current = true;
      const corte = new AbortController();
      const reloj = setTimeout(() => corte.abort(), TOPE_PEDIDO_MS);
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            visitante: idVisitante(),
            pagina,
            ...(pagina === "ficha" ? { slug: slugDeFicha } : {}),
            ...cuerpo,
          }),
          signal: corte.signal,
        });
        const respuesta = r.status === 200 ? leerRespuesta(await r.json()) : null;
        if (!respuesta) throw new Error("respuesta inválida");
        despachar({ tipo: "recibir", respuesta });
      } catch {
        despachar({ tipo: "fallo", negocio: { whatsappUrl: buildWhatsAppUrlWeb(null) } });
      } finally {
        clearTimeout(reloj);
        enVuelo.current = false;
      }
    },
    [idVisitante, pagina, slugDeFicha],
  );

  const abrir = () => {
    setGlobo(false);
    const s = almacen("sessionStorage");
    if (s) marcarGloboMostrado(s);
    if (estado.abierto) return;
    despachar({ tipo: "abrir" });
    registrarApertura(slugDeFicha);
    // El saludo (con la tarjeta del auto) sale la primera vez que se abre en la pestaña, nunca a mitad de una charla.
    if (necesitaSaludo(estado) && !enVuelo.current) {
      despachar({ tipo: "iniciar" });
      void pedir({ inicio: true });
    }
  };

  const cerrar = useCallback(() => {
    despachar({ tipo: "cerrar" });
    lanzador.current?.focus();
  }, []);

  const enviar = useCallback(
    (cuerpo: { texto: string } | { opcion: OpcionId }) => {
      if (enVuelo.current) return;
      const texto = "texto" in cuerpo ? cuerpo.texto.trim().slice(0, MAX_TEXTO) : ETIQUETAS_OPCION[cuerpo.opcion];
      if (texto === "") return;
      despachar({ tipo: "enviar", texto });
      void pedir("texto" in cuerpo ? { texto } : cuerpo);
    },
    [pedir],
  );

  return (
    <>
      {globo && !estado.abierto && (
        <div className="fixed bottom-26 right-5 z-50 flex max-w-60 items-start gap-1 rounded-2xl rounded-br-sm border border-car-gold/30 bg-car-gray2 py-2 pl-3.5 pr-1.5 text-sm text-car-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] sm:bottom-28 sm:right-7">
          <button type="button" onClick={abrir} className="py-1 text-left leading-snug">
            {TEXTO_GLOBO[pagina]}
          </button>
          <button
            type="button"
            onClick={() => setGlobo(false)}
            aria-label="Cerrar el aviso"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-car-muted hover:text-car-white"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <button
        ref={lanzador}
        type="button"
        onClick={estado.abierto ? cerrar : abrir}
        aria-label={estado.abierto ? "Cerrar el asistente" : "Abrir el asistente de Posse Automotores"}
        aria-expanded={estado.abierto}
        aria-controls={estado.abierto ? ID_VENTANA : undefined}
        className="fixed bottom-5 right-5 z-50 flex size-15 items-center justify-center rounded-full bg-gradient-to-b from-[#24365e] to-[#0f1729] shadow-[0_4px_20px_rgba(201,162,39,0.35)] ring-2 ring-car-gold/70 transition-transform hover:scale-105 sm:bottom-7 sm:right-7"
      >
        <AvatarRobot tam={56} className="ring-0" />
        <span className="absolute right-0.5 top-0.5 size-3.5 rounded-full border-2 border-car-black bg-[#25D366]" aria-hidden="true" />
      </button>

      {estado.abierto && (
        <Ventana
          id={ID_VENTANA}
          estado={estado}
          onCerrar={cerrar}
          onEnviar={enviar}
        />
      )}
    </>
  );
}
