import type { TipoDocumento } from "./types";

export const SLUG_A_TIPO_DOCUMENTO: Record<string, TipoDocumento> = {
  presupuesto: "Presupuesto",
  "recibo-sena": "Recibo de Seña",
  "recibo-entrega": "Recibo de Entrega",
  "recibo-cuota": "Recibo de Cuota",
  boleto: "Boleto de Compraventa",
};

export const DOCUMENTOS_DISPONIBLES: Array<{ slug: string; tipo: TipoDocumento; etiqueta: string }> = [
  { slug: "presupuesto", tipo: "Presupuesto", etiqueta: "Presupuesto / Cotización" },
  { slug: "recibo-sena", tipo: "Recibo de Seña", etiqueta: "Recibo de Seña" },
  { slug: "recibo-entrega", tipo: "Recibo de Entrega", etiqueta: "Recibo de Entrega" },
  { slug: "recibo-cuota", tipo: "Recibo de Cuota", etiqueta: "Recibo de Cuota" },
  { slug: "boleto", tipo: "Boleto de Compraventa", etiqueta: "Boleto de Compraventa" },
];

export function slugDeTipoDocumento(tipo: TipoDocumento): string {
  return DOCUMENTOS_DISPONIBLES.find((d) => d.tipo === tipo)?.slug ?? "presupuesto";
}
