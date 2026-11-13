import { WHATSAPP_LOCAL, WHATSAPP_RECLUTADOR } from "../utils";

/** Quien recibe las postulaciones de vendedor el candidato le escribe por WhatsApp. */
export type Reclutador = {
  nombre: string;
  whatsappNumero: string;
  whatsappVisible: string;
};

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
  reclutador: Reclutador;
  horarios: string | null;
  direccion: string | null;
  financiacion: string | null;
  permutas: string | null;
  pagos: string | null;
  garantia: string | null;
  documentacion: string | null;
  /** Horas que el bot se calla en un chat cuando contesta una persona desde la cuenta. */
  pausaHumanoHoras: number;
  /**
   * Franja horaria (hora argentina) en que el bot contesta; el resto del dia los mensajes
   * los atiende una persona a mano y el bot no responde. Cruza la medianoche: activo si la
   * hora es >= horarioBotDesde o < horarioBotHasta.
   */
  horarioBotDesde: number;
  horarioBotHasta: number;
  /**
   * Frases de las respuestas automaticas de Instagram (mensaje de ausencia, respuesta instantanea).
   * Salen desde la cuenta como si las escribiera una persona; si el eco las contiene, no se pausa el chat.
   * Se comparan sin tildes ni mayusculas. Si se cambia el texto automatico en Instagram, actualizar aca.
   */
  mensajesAutomaticos: string[];
};

export const NEGOCIO: Negocio = {
  nombre: "Posse Automotores",
  ciudad: "Justiniano Posse, Córdoba",
  secretaria: "Marcos",
  whatsappNumero: WHATSAPP_LOCAL,
  whatsappVisible: "+54 9 3537 66-2444",

  // Las postulaciones de vendedor tambien van a Marcos (numero del flyer).
  reclutador: { nombre: "Marcos", whatsappNumero: WHATSAPP_RECLUTADOR, whatsappVisible: "+54 9 3537 66-2444" },

  // Tomado de la seccion Contacto del sitio. Si cambian, editar aca y en el sitio.
  horarios: "Atendemos de lunes a viernes de 9 a 13 y de 16 a 20 hs, y los sábados de 9 a 13 hs. Los domingos estamos cerrados 🕘",
  // PENDIENTE: direccion exacta (hoy solo se sabe la ciudad).
  direccion: null,

  // Tomado de las respuestas del bot de WhatsApp anterior: CONFIRMAR que siguen vigentes.
  financiacion: "Trabajamos con financiación bancaria y propia. Las condiciones dependen del auto, te las pasa Marcos.",
  permutas: "Tomamos tu usado como parte de pago: lo tasamos en el local.",
  pagos: "Efectivo, transferencia bancaria y financiación.",
  garantia: "Todos los vehículos tienen garantía legal y verificación previa.",
  documentacion: "Para comprar: DNI. Para financiar, además, comprobante de ingresos.",

  pausaHumanoHoras: 6,

  // Acordado con Marcos: el bot contesta de 22 a 9; en el resto del dia atendemos nosotros a mano.
  horarioBotDesde: 22,
  horarioBotHasta: 9,

  mensajesAutomaticos: ["recibio tu mensaje", "horarios de atencion no se encuentran disponibles"],
};
