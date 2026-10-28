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
  /** Monto a financiar en pesos. */
  monto: number;
  conPermuta: boolean;
  /** Datos del usado; solo cuentan si `conPermuta`. `conFotos`: la persona avisa que manda las fotos por el chat. */
  permuta: { modelo: string; anio: string; km: string; estado: EstadoUsado | null; conFotos: boolean };
  plazo: Plazo;
  nombre: string;
};

export type ErroresFinanciacion = Partial<Record<"auto" | "monto" | "modelo" | "anio" | "nombre", string>>;

const ANIO_MIN = 1980;
// Un largo máximo por campo: el mensaje viaja en la URL del link de WhatsApp.
const MAX_TEXTO = 60;
const MAX_MONTO = 10_000_000_000;

/** Saca espacios de más y caracteres de control, y corta el largo. */
function limpiar(texto: string): string {
  return texto.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
}

const aMiles = (n: number) => n.toLocaleString("es-AR");

/** "$6.000.000" */
export function formatearMonto(monto: number): string {
  return `$${aMiles(monto)}`;
}

/** Lo que la persona escribe en el campo ("$ 6.000.000", "6000000") pasa a número; vacío o sin cifras es 0. */
export function montoDeTexto(texto: string): number {
  const cifras = texto.replace(/\D/g, "").slice(0, 11);
  return cifras === "" ? 0 : Number(cifras);
}

export function validar(s: SolicitudFinanciacion, anioActual = new Date().getFullYear()): ErroresFinanciacion {
  const errores: ErroresFinanciacion = {};
  if (limpiar(s.auto) === "") errores.auto = "Elegí el auto que te interesa";
  if (!(s.monto > 0) || s.monto > MAX_MONTO) errores.monto = "Escribí el monto que querés financiar";
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

export function armarMensaje(s: SolicitudFinanciacion): string {
  const lineas = [
    "¡Hola Marcos! Quiero solicitar una simulación de financiación:",
    "",
    `🚗 Auto a comprar: ${limpiar(s.auto)}`,
    `💰 Monto a financiar: ${formatearMonto(s.monto)}`,
  ];

  if (s.conPermuta) {
    const { modelo, anio, km, estado } = s.permuta;
    const datos = [
      limpiar(modelo),
      limpiar(anio) !== "" ? `Año ${limpiar(anio)}` : "",
      limpiar(km) !== "" ? kilometrajeDeTexto(km) : "",
      estado ? `Estado: ${estado}` : "",
    ].filter((d) => d !== "");
    lineas.push(`🔄 Entrega usado: Sí (${datos.join(" - ")})`);
  } else {
    lineas.push("🔄 Entrega usado: No");
  }

  lineas.push(`🗓️ Plazo deseado: ${s.plazo} cuotas`, `👤 Nombre: ${limpiar(s.nombre)}`);
  // Un link de WhatsApp no adjunta archivos: la nota avisa que las fotos llegan por el chat.
  if (s.conPermuta && s.permuta.conFotos) lineas.push("", "📸 Nota: Te adjunto las fotos de mi vehículo a continuación en este chat.");
  lineas.push("", "Quedo a la espera de tu respuesta.");
  return lineas.join("\n");
}

export function urlFinanciacion(s: SolicitudFinanciacion): string {
  return `https://wa.me/${WHATSAPP_LOCAL}?text=${encodeURIComponent(armarMensaje(s))}`;
}
