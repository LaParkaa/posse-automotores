import type { Tarjeta, VehiculoCatalogo } from "../types";
import type { TarjetaWeb } from "./tipos";

// ".../vehiculos/<slug>" (absoluto o relativo), con o sin barra final, query o ancla.
const RUTA_FICHA = /\/vehiculos\/([a-z0-9-]+)\/?(?:[?#].*)?$/i;

/** Slug del auto según el botón que lleva a su ficha; null si la tarjeta no tiene ese botón o el auto no está. */
function slugDe(t: Tarjeta, catalogo: VehiculoCatalogo[]): string | null {
  for (const b of t.botones) {
    const slug = RUTA_FICHA.exec(b.url)?.[1];
    if (slug && catalogo.some((v) => v.slug === slug)) return slug;
  }
  return null;
}

/**
 * Pasa las tarjetas del motor al formato del chat web: el slug sale del botón "Ver en la web" (/vehiculos/<slug>)
 * y el estado, del catálogo. Las tarjetas sin ficha (contacto, financiación sin auto) quedan con slug y estado null.
 */
export function tarjetasAWeb(tarjetas: Tarjeta[], catalogo: VehiculoCatalogo[]): TarjetaWeb[] {
  return tarjetas.map((t) => {
    const slug = slugDe(t, catalogo);
    const v = slug ? catalogo.find((x) => x.slug === slug) : undefined;
    return {
      slug,
      titulo: t.titulo,
      subtitulo: t.subtitulo,
      imagenUrl: t.imagenUrl,
      estado: v?.estado ?? null,
      botones: t.botones.map((b) => ({ ...b })),
    };
  });
}
