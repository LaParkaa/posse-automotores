/** Las pantallas del panel del celular. "inicio" es el menú con todas las opciones; el resto son las secciones. */
export type PanelTab = "inicio" | "stock" | "llaves" | "metricas";

const SECCIONES: readonly PanelTab[] = ["stock", "llaves", "metricas"];

export const TITULOS_PANEL: Record<PanelTab, string> = {
  inicio: "Inicio",
  stock: "Stock",
  llaves: "Llaves",
  metricas: "Métricas",
};

/** "#llaves" → "llaves". Cualquier otra cosa (o nada) es el inicio: así el panel siempre abre en el menú. */
export function tabDeHash(hash: string): PanelTab {
  const valor = hash.replace(/^#/, "").trim().toLowerCase();
  return SECCIONES.find((s) => s === valor) ?? "inicio";
}

/** La dirección de cada pantalla: el inicio es /panel y las secciones /panel#seccion (el botón "atrás" vuelve al menú). */
export function urlDeTab(tab: PanelTab): string {
  return tab === "inicio" ? "/panel" : `/panel#${tab}`;
}
