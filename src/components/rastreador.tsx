"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { slugDeHrefSimulador, slugDeRuta } from "@/lib/eventos";
import { registrarEvento } from "@/lib/rastreo";

/**
 * Registra las visitas y los clics del sitio público para las estadísticas del admin. No dibuja nada.
 * Cualquier link a WhatsApp cuenta como consulta y cualquier link al simulador como "simular"; si el link trae
 * `data-vehiculo` se asigna a ese auto y, si no, al auto de la ficha en la que está la persona.
 */
export function Rastreador() {
  const ruta = usePathname();

  useEffect(() => {
    registrarEvento("visita", slugDeRuta(ruta));
  }, [ruta]);

  useEffect(() => {
    const alTocar = (e: MouseEvent) => {
      const enlace = (e.target as Element | null)?.closest?.("a");
      if (!enlace) return;
      const href = enlace.getAttribute("href") ?? "";
      const deEsteAuto = enlace.dataset.vehiculo || slugDeRuta(location.pathname);

      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) registrarEvento("whatsapp", deEsteAuto);
      else if (href.startsWith("/financiacion")) registrarEvento("simular", slugDeHrefSimulador(href) ?? deEsteAuto);
    };
    // En la captura: se mide aunque otro componente frene el evento.
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);

  return null;
}
