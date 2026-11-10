/**
 * Topes de la ruta pública del chat web. El id de visitante lo manda el navegador (se puede cambiar), así que además
 * del tope por visitante hay uno global; no se guarda la IP ni siquiera para limitar.
 */
export const LIMITES = { maxTexto: 500, maxBytes: 2000, porVisitante: 30, global: 300, ventanaMinutos: 10 } as const;

/**
 * Decide si entra un mensaje nuevo según cuántos del cliente hay ya en la ventana (sin contar el nuevo): con 29
 * entra el 30, con 30 no. Si se pasan los dos topes, manda el del visitante.
 */
export function evaluarLimite(c: { visitante: number; global: number }): "ok" | "visitante" | "global" {
  if (c.visitante >= LIMITES.porVisitante) return "visitante";
  if (c.global >= LIMITES.global) return "global";
  return "ok";
}
