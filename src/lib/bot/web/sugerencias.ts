import type { Sesion } from "../sesion";
import type { OpcionId, Pagina } from "./tipos";

/**
 * Chips que se muestran después de una respuesta libre (fuera de un guion). Puro.
 * - Si el motor ofreció avisar cuando entre un auto, el chip "Sí, quiero" lo acepta.
 * - En la ficha, con su auto: financiar, usado, disponible y Marcos (spec 4.2).
 * - En el catálogo, hablando ya de un auto: financiar, disponible, seguir buscando y Marcos.
 * - Sin auto: los del catálogo (financiar, buscar, usado y Marcos).
 */
export function sugerenciasPara(a: { pagina: Pagina; tieneAuto: boolean; ofrecio: Sesion["ofrecio"] }): OpcionId[] {
  if (a.ofrecio === "aviso") return ["confirmar_si", "buscar", "marcos"];
  if (a.tieneAuto) {
    return a.pagina === "ficha" ? ["financiar", "usado", "disponible", "marcos"] : ["financiar", "disponible", "buscar", "marcos"];
  }
  return ["financiar", "buscar", "usado", "marcos"];
}
