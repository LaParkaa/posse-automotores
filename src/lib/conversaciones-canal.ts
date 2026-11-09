import type { MensajeWebFila } from "./bot/web/estadisticas";
import { FILTROS, type ConversacionResumen, type FiltroConversaciones, type MensajeIg } from "./conversaciones";

/**
 * Lo que comparten las pantallas de conversaciones del admin entre los dos canales (Instagram y la página web):
 * cómo se arman las direcciones y cómo se adaptan las filas del chat web para reutilizar `ChatConversacion`.
 * Código puro, para poder probarlo.
 */

export type Canal = "instagram" | "web";

/** `?canal=web` es la página; cualquier otra cosa (o nada) es Instagram, como siempre. */
export function canalDeUrl(valor: string | undefined): Canal {
  return valor === "web" ? "web" : "instagram";
}

/**
 * Los filtros que tiene cada canal. "Postulaciones" es del bot de Instagram; "Dejaron sus datos" tampoco aplica a la
 * página, porque los leads web no guardan qué visitante los dejó (no se guarda nada que identifique a nadie).
 */
export function filtrosDelCanal(canal: Canal): Array<{ valor: FiltroConversaciones; texto: string }> {
  if (canal === "instagram") return FILTROS;
  return FILTROS.filter((f) => f.valor === "todas" || f.valor === "fallas").map((f) =>
    f.valor === "fallas" ? { ...f, texto: "Con fallas del asistente" } : f,
  );
}

/** El filtro pedido en la URL, o "todas" si ese canal no lo tiene. */
export function filtroParaCanal(filtro: FiltroConversaciones, canal: Canal): FiltroConversaciones {
  return filtrosDelCanal(canal).some((f) => f.valor === filtro) ? filtro : "todas";
}

/** Deja solo las conversaciones web que cumplen el filtro (el de Instagram lo aplica `armarConversaciones`). */
export function filtrarConversacionesWeb(filas: ConversacionResumen[], filtro: FiltroConversaciones): ConversacionResumen[] {
  return filtro === "fallas" ? filas.filter((f) => f.noEntendidos > 0) : filas;
}

/** Dirección de la lista de conversaciones; Instagram queda igual que antes (sin `canal`). */
export function hrefConversaciones(a: { dias: number; filtro: FiltroConversaciones; canal?: Canal }): string {
  return `/admin/conversaciones?dias=${a.dias}&filtro=${a.filtro}${a.canal === "web" ? "&canal=web" : ""}`;
}

/** Dirección del detalle de una conversación. */
export function hrefDetalle(id: string, canal: Canal = "instagram"): string {
  return `/admin/conversaciones/${id}${canal === "web" ? "?canal=web" : ""}`;
}

/** Cómo se llama cada lado de la charla en cada canal. */
export const ETIQUETAS_CANAL: Record<Canal, { cliente: string; bot: string }> = {
  instagram: { cliente: "Cliente", bot: "Bot" },
  web: { cliente: "Visitante", bot: "Asistente" },
};

/** Las filas del chat web con la forma que espera `ChatConversacion` (el id del visitante hace de id de la persona). */
export function mensajesWebComoIg(filas: MensajeWebFila[]): MensajeIg[] {
  return filas.map((m) => ({ ig_user_id: m.visitante, role: m.role, content: m.content, created_at: m.created_at, nota: m.nota }));
}

/** El último auto que quedó asociado a la charla (el que miraba o el que se mencionó), o null. */
export function ultimoAutoConsultado(filas: MensajeWebFila[]): string | null {
  for (let i = filas.length - 1; i >= 0; i--) {
    if (filas[i].vehiculo_slug) return filas[i].vehiculo_slug;
  }
  return null;
}

// El id de visitante lo genera el navegador (UUID o parecido): letras, números y guiones.
const ID_VISITANTE = /^[A-Za-z0-9-]{8,64}$/;
export const esIdVisitante = (id: string) => ID_VISITANTE.test(id);
