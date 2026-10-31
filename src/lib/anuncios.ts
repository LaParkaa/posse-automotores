/**
 * Anuncios pagos de Instagram, con los números tal cual los muestra Instagram en "Insights". Se cargan a mano
 * (copiando de la pantalla del anuncio) porque Instagram y el sitio miden distinto: no se suman a las visitas que
 * cuenta el sitio salvo en el KPI "Visitas totales" de Estadísticas. Para sumar otro anuncio, agregar un elemento a la lista.
 */
export type AnuncioInstagram = {
  titulo: string;
  estado: string;
  ubicaciones: string;
  publico: string;
  duracionDias: number;
  /** Pesos gastados y tope del anuncio. */
  gasto: number;
  presupuesto: number;
  /** "Visitas al sitio web" según Instagram. */
  visitasSitio: number;
  clicsEnlace: number;
  reproducciones: number;
  /** Pesos por cada visita al sitio, según Instagram. */
  costoPorVisita: number;
  megusta: number;
  comentarios: number;
  visitasPerfil: number;
  seguidoresNuevos: number;
  conversacionesIniciadas: number;
  /** Provincia donde más se vio y qué parte del total fue ahí. */
  lugarPrincipal: { nombre: string; porcentaje: number };
};

export const ANUNCIOS_INSTAGRAM: AnuncioInstagram[] = [
  {
    titulo: "Anuncio de video en Instagram y Facebook",
    estado: "Finalizada",
    ubicaciones: "Instagram, Facebook",
    publico: "Compradores Córdoba/Zona",
    duracionDias: 1,
    gasto: 7979.4,
    presupuesto: 10000,
    visitasSitio: 143,
    clicsEnlace: 198,
    reproducciones: 6193,
    costoPorVisita: 55.8,
    megusta: 18,
    comentarios: 3,
    visitasPerfil: 92,
    seguidoresNuevos: 2,
    conversacionesIniciadas: 1,
    lugarPrincipal: { nombre: "Córdoba", porcentaje: 100 },
  },
];

/** "$7.979,40" (con centavos) o "$10.000" (sin centavos si es redondo). */
export function pesos(monto: number): string {
  const redondo = Number.isInteger(monto);
  return `$${monto.toLocaleString("es-AR", { minimumFractionDigits: redondo ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Suma de "Visitas al sitio web" de todos los anuncios (para el total de Estadísticas). */
export function visitasDeAnuncios(anuncios: Pick<AnuncioInstagram, "visitasSitio">[] = ANUNCIOS_INSTAGRAM): number {
  return anuncios.reduce((total, a) => total + a.visitasSitio, 0);
}

/** Qué parte del tope se gastó, de 0 a 100. */
export function porcentajeGastado(a: Pick<AnuncioInstagram, "gasto" | "presupuesto">): number {
  return a.presupuesto > 0 ? Math.min(100, Math.round((a.gasto / a.presupuesto) * 100)) : 0;
}
