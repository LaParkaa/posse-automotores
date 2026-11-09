import { limpioParaLink, WHATSAPP_LOCAL } from "../../utils";
import type { VehiculoCatalogo } from "../types";

// Los links de WhatsApp tienen que entrar en los botones de Instagram (unos 2000 caracteres): se deja margen.
const MAX_URL = 1700;
const MAX_FRAGMENTO = 300;
const PASO_ACHICAR = 40;
const MAX_NOMBRE = 80;

type Vehiculo = Pick<VehiculoCatalogo, "nombre" | "anio" | "tipo" | "slug">;

function armar(vehiculo: Vehiculo | null, detalle: string[], maxFragmento: number): { texto: string; url: string } {
  const partes = ["Hola Marcos, te escribo desde la web."];
  if (vehiculo) {
    const articulo = vehiculo.tipo === "Moto" ? "la" : "el";
    partes.push(`Me interesa ${articulo} ${limpioParaLink(vehiculo.nombre, MAX_NOMBRE)} ${vehiculo.anio}.`);
  } else {
    partes.push("Quiero consultar por un vehículo.");
  }
  for (const d of detalle) {
    const limpio = limpioParaLink(d, maxFragmento);
    if (limpio) partes.push(limpio);
  }
  if (vehiculo) partes.push("¿Sigue disponible?");
  const texto = partes.join(" ");
  return { texto, url: `https://wa.me/${WHATSAPP_LOCAL}?text=${encodeURIComponent(texto)}` };
}

/**
 * Mensaje prearmado para Marcos y su link de WhatsApp. Sin emojis ni invisibles (el navegador de Instagram los rompe).
 * Si lo que escribió la persona hace pasar el link del tope, se achica cada fragmento del detalle (siempre sobre el
 * texto, antes de codificar: nunca queda cortado un %XX) y, en última instancia, se descartan los fragmentos del
 * final. El saludo, el auto y el "¿Sigue disponible?" no se tocan.
 */
export function armarMensajeMarcos(a: { vehiculo: Vehiculo | null; detalle: string[] }): { texto: string; url: string } {
  let max = MAX_FRAGMENTO;
  let resultado = armar(a.vehiculo, a.detalle, max);
  while (resultado.url.length > MAX_URL && max > PASO_ACHICAR) {
    max -= PASO_ACHICAR;
    resultado = armar(a.vehiculo, a.detalle, max);
  }
  const detalle = [...a.detalle];
  while (resultado.url.length > MAX_URL && detalle.length > 0) {
    detalle.pop();
    resultado = armar(a.vehiculo, detalle, max);
  }
  return resultado;
}
