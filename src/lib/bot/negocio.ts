import { WHATSAPP_LOCAL } from "../utils";

/**
 * Datos del negocio que el bot puede decir. UNICO archivo a editar para cambiarlos.
 * `null` = pendiente de confirmar: el bot NO inventa, responde que lo confirma la secretaria
 * y manda el boton de WhatsApp.
 */
export type Negocio = {
  nombre: string;
  ciudad: string;
  secretaria: string;
  whatsappNumero: string;
  whatsappVisible: string;
  horarios: string | null;
  direccion: string | null;
  financiacion: string | null;
  permutas: string | null;
  pagos: string | null;
  garantia: string | null;
  documentacion: string | null;
  /** Horas que el bot se calla en un chat cuando contesta una persona desde la cuenta. */
  pausaHumanoHoras: number;
};

export const NEGOCIO: Negocio = {
  nombre: "Posse Automotores",
  ciudad: "Justiniano Posse, Córdoba",
  secretaria: "Nati",
  whatsappNumero: WHATSAPP_LOCAL,
  whatsappVisible: "+54 9 3537 55-8947",

  // Tomado de la seccion Contacto del sitio. Si cambian, editar aca y en el sitio.
  horarios: "Atendemos de lunes a viernes de 9 a 13 y de 16 a 20 hs, y los sábados de 9 a 13 hs. Los domingos estamos cerrados 🕘",
  // PENDIENTE: direccion exacta (hoy solo se sabe la ciudad).
  direccion: null,

  // Tomado de las respuestas del bot de WhatsApp anterior: CONFIRMAR que siguen vigentes.
  financiacion: "Trabajamos con financiación bancaria y propia. Las condiciones dependen del auto, te las pasa Nati.",
  permutas: "Tomamos tu usado como parte de pago: lo tasamos en el local.",
  pagos: "Efectivo, transferencia bancaria y financiación.",
  garantia: "Todos los vehículos tienen garantía legal y verificación previa.",
  documentacion: "Para comprar: DNI. Para financiar, además, comprobante de ingresos.",

  pausaHumanoHoras: 6,
};
