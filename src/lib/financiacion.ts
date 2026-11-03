import { WHATSAPP_LOCAL } from "@/lib/utils";

/**
 * Simulador de financiación: no calcula cuotas, junta los datos de la persona y arma el mensaje de WhatsApp
 * para Marcos. Todo el armado vive acá (sin React) para poder probarlo.
 */

export const PLAZOS = [12, 24, 36, 48] as const;
export type Plazo = (typeof PLAZOS)[number];

export const ESTADOS = ["Excelente", "Bueno", "Regular"] as const;
export type EstadoUsado = (typeof ESTADOS)[number];

export type SolicitudFinanciacion = {
  /** Auto elegido, ya armado: "Volkswagen Gol Power 1.6 (2010)". */
  auto: string;
  conPermuta: boolean;
  /** Datos del usado; solo cuentan si `conPermuta`. `conFotos`: la persona avisa que manda las fotos por el chat. */
  permuta: { modelo: string; anio: string; km: string; estado: EstadoUsado | null; conFotos: boolean };
  plazo: Plazo;
  nombre: string;
};

export type ErroresFinanciacion = Partial<Record<"auto" | "modelo" | "anio" | "nombre", string>>;

const ANIO_MIN = 1980;
// Un largo máximo por campo: el mensaje viaja en la URL del link de WhatsApp.
const MAX_TEXTO = 60;

/** Saca espacios de más y caracteres de control, y corta el largo. */
function limpiar(texto: string): string {
  return texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
}

const aMiles = (n: number) => n.toLocaleString("es-AR");

/**
 * Los navegadores internos de Instagram y Facebook rompen los emojis al pasar por wa.me (llegan como "?"),
 * así que ahí el mensaje se arma sin ellos.
 */
export function esNavegadorInterno(userAgent: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB/i.test(userAgent);
}

export type UsadoInicial = { modelo: string; anio: string };

/**
 * Lo que el link trae del usado del cliente (?usado=Chevrolet Corsa&usadoAnio=2010, o ?permuta=1 si solo dijo que
 * entrega uno) para abrir el simulador con "entrego mi usado: Sí" ya completado. Todo viene de la dirección, así que
 * se limpia: null si el link no habla de ningún usado.
 */
export function usadoDeUrl(params: { usado?: string; usadoAnio?: string; permuta?: string }): UsadoInicial | null {
  const modelo = limpiar(params.usado ?? "");
  const anio = limpiar(params.usadoAnio ?? "");
  const anioValido = /^\d{4}$/.test(anio) && Number(anio) >= ANIO_MIN && Number(anio) <= new Date().getFullYear() + 1 ? anio : "";
  if (modelo === "" && params.permuta !== "1") return null;
  return { modelo, anio: modelo === "" ? "" : anioValido };
}

export function validar(s: SolicitudFinanciacion, anioActual = new Date().getFullYear()): ErroresFinanciacion {
  const errores: ErroresFinanciacion = {};
  if (limpiar(s.auto) === "") errores.auto = "Elegí el auto que te interesa";
  if (limpiar(s.nombre).length < 2) errores.nombre = "Escribí tu nombre";
  if (s.conPermuta) {
    if (limpiar(s.permuta.modelo).length < 2) errores.modelo = "Contanos la marca y el modelo de tu usado";
    const anio = limpiar(s.permuta.anio);
    if (anio !== "" && !(/^\d{4}$/.test(anio) && Number(anio) >= ANIO_MIN && Number(anio) <= anioActual + 1)) {
      errores.anio = "Escribí el año con 4 números";
    }
  }
  return errores;
}

/** "85000" → "85.000 km"; si ya escribió algo más ("85 mil km") se respeta tal cual. */
function kilometrajeDeTexto(texto: string): string {
  const km = limpiar(texto);
  return /^\d+$/.test(km) ? `${aMiles(Number(km))} km` : km;
}

export function armarMensaje(s: SolicitudFinanciacion, conEmojis = true): string {
  const e = (emoji: string) => (conEmojis ? `${emoji} ` : "");
  const lineas = [
    "¡Hola Marcos! Quiero solicitar una simulación de financiación:",
    "",
    `${e("🚗")}Auto a comprar: ${limpiar(s.auto)}`,
  ];

  if (s.conPermuta) {
    const { modelo, anio, km, estado } = s.permuta;
    const datos = [
      limpiar(modelo),
      limpiar(anio) !== "" ? `Año ${limpiar(anio)}` : "",
      limpiar(km) !== "" ? kilometrajeDeTexto(km) : "",
      estado ? `Estado: ${estado}` : "",
    ].filter((d) => d !== "");
    lineas.push(`${e("🔄")}Entrega usado: Sí (${datos.join(" - ")})`);
  } else {
    lineas.push(`${e("🔄")}Entrega usado: No`);
  }

  lineas.push(`${e("🗓️")}Plazo deseado: ${s.plazo} cuotas`, `${e("👤")}Nombre: ${limpiar(s.nombre)}`);
  // Un link de WhatsApp no adjunta archivos: la nota avisa que las fotos llegan por el chat.
  if (s.conPermuta && s.permuta.conFotos) lineas.push("", `${e("📸")}Nota: Te adjunto las fotos de mi vehículo a continuación en este chat.`);
  lineas.push("", "Quedo a la espera de tu respuesta.");
  return lineas.join("\n");
}

export function urlFinanciacion(s: SolicitudFinanciacion, conEmojis = true): string {
  return `https://wa.me/${WHATSAPP_LOCAL}?text=${encodeURIComponent(armarMensaje(s, conEmojis))}`;
}
