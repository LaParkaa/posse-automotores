"use client";
import { useCallback, useSyncExternalStore } from "react";
import { type PanelTab, tabDeHash, urlDeTab } from "./panel-tabs";

// pushState/replaceState no avisan a nadie: este aviso propio hace que la pantalla se entere cuando se navega desde adentro.
const oyentes = new Set<() => void>();

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  window.addEventListener("popstate", avisar); // botón "atrás" del celular
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("popstate", avisar);
  };
}

const actual = (): PanelTab => tabDeHash(window.location.hash);
// En el servidor no hay dirección con hash: siempre se renderiza el menú de inicio y el navegador se corrige al hidratar.
const delServidor = (): PanelTab => "inicio";

/**
 * La pantalla del panel que se está viendo, guardada en la dirección (/panel#llaves). Siempre abre en el inicio, el
 * botón "atrás" vuelve al menú y un acceso directo a una sección también anda.
 */
export function usePanelTab(): [PanelTab, (siguiente: PanelTab) => void] {
  const tab = useSyncExternalStore(suscribir, actual, delServidor);

  const irA = useCallback(
    (siguiente: PanelTab) => {
      if (siguiente === tab) return;
      if (siguiente === "inicio") {
        // Si se llegó desde el menú, "atrás" lo deshace; si se entró directo a una sección, se reemplaza la dirección.
        if (window.history.state?.seccion) {
          window.history.back();
          return;
        }
        window.history.replaceState({}, "", urlDeTab("inicio"));
      } else if (tab === "inicio") {
        window.history.pushState({ seccion: siguiente }, "", urlDeTab(siguiente));
      } else {
        window.history.replaceState({ seccion: siguiente }, "", urlDeTab(siguiente));
      }
      oyentes.forEach((avisar) => avisar());
    },
    [tab],
  );

  return [tab, irA];
}
