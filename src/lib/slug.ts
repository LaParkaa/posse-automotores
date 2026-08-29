/**
 * La columna `slug` tiene un unique constraint, y el slug se arma con el nombre
 * y el año del vehículo. Dos unidades del mismo modelo y año chocan, y también
 * choca un vehículo borrado: el borrado es lógico, así que la fila sigue
 * reteniendo su slug aunque ya no aparezca en el listado.
 *
 * Devuelve el primer slug libre de la familia: el base si nadie lo usa, o el
 * primer `base-N` disponible arrancando en 2.
 */
export function siguienteSlugLibre(base: string, ocupados: Iterable<string>): string {
  const usados = new Set(ocupados);

  if (!usados.has(base)) return base;

  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
