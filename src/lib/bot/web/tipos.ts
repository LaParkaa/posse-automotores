import type { Boton, EstadoVehiculo } from "../types";

/** Opciones (chips) que el visitante puede tocar en el chat de la web. */
export type OpcionId =
  | "financiar"
  | "usado"
  | "disponible"
  | "marcos"
  | "buscar"
  | "seguir"
  | "ver_financiacion"
  | "confirmar_si"
  | "anticipo_sin"
  | "anticipo_hasta_3"
  | "anticipo_mas_3"
  | "anticipo_solo_usado"
  | "cuotas_12"
  | "cuotas_24"
  | "cuotas_36"
  | "cuotas_48";

export const ETIQUETAS_OPCION: Record<OpcionId, string> = {
  financiar: "Quiero financiarlo",
  usado: "Tengo un usado para entregar",
  disponible: "¿Sigue disponible?",
  marcos: "Hablar con Marcos",
  buscar: "Ver autos por marca o tipo",
  seguir: "Seguir preguntando",
  ver_financiacion: "Mejor veo la financiación",
  confirmar_si: "Sí, quiero",
  anticipo_sin: "Sin anticipo",
  anticipo_hasta_3: "Hasta 3 millones",
  anticipo_mas_3: "Más de 3 millones",
  anticipo_solo_usado: "Solo el usado",
  cuotas_12: "12",
  cuotas_24: "24",
  cuotas_36: "36",
  cuotas_48: "48",
};

export const esOpcionId = (v: unknown): v is OpcionId =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(ETIQUETAS_OPCION, v);

export type TarjetaWeb = {
  slug: string | null;
  titulo: string;
  subtitulo: string;
  imagenUrl: string | null;
  estado: EstadoVehiculo | null;
  botones: Boton[];
};

export type MensajeWeb =
  | { tipo: "texto"; texto: string }
  | { tipo: "tarjetas"; tarjetas: TarjetaWeb[] }
  | { tipo: "cierre"; texto: string; url: string; vehiculoSlug: string | null };

export type RespuestaChat = { mensajes: MensajeWeb[]; sugerencias: OpcionId[] };

export type Pagina = "ficha" | "catalogo";

export type EntradaChat = { pagina: Pagina; slug: string | null; texto?: string; opcion?: OpcionId; inicio?: true };

/** Estado del guion por opciones. Objeto plano: se guarda como jsonb en web_sesiones.guion. */
export type Guion = {
  flujo: "financiar" | "usado" | "disponible" | null;
  paso: "anticipo" | "cuotas" | "usado" | "confirmar" | null;
  datos: { anticipo?: string; cuotas?: string; usado?: string };
};
