import type { Negocio } from "@/lib/bot/negocio";
import type { Vehiculo } from "@/lib/types";

export type Plataforma = "mercadolibre" | "marketplace";

export type VehiculoPublicable = Pick<
  Vehiculo,
  | "nombre"
  | "marca"
  | "modelo"
  | "anio"
  | "kilometraje"
  | "combustible"
  | "transmision"
  | "motor"
  | "tipo"
  | "descripcion"
  | "precio_texto"
>;

export type DatosNegocio = Pick<Negocio, "nombre" | "ciudad" | "whatsappVisible" | "financiacion" | "permutas" | "garantia">;

export type Aviso = {
  titulo: string;
  descripcion: string;
  /** Cada dato se copia por separado al formulario de la plataforma. */
  datos: { etiqueta: string; valor: string }[];
  /** Lo que el formulario de la plataforma pide y el auto no tiene: se completa a mano. */
  faltantes: string[];
};

const MAX_TITULO_MERCADOLIBRE = 60;

/** Mercado Libre corta el título en 60 caracteres: se arma por palabras completas. */
function cortarPorPalabras(texto: string, max: number): string {
  let salida = "";
  for (const palabra of texto.split(" ")) {
    const siguiente = salida ? `${salida} ${palabra}` : palabra;
    if (siguiente.length > max) break;
    salida = siguiente;
  }
  return salida;
}

/** Un dato cargado de verdad: ni vacío ni un "Consultá km" / "Consultá precio" de relleno. */
function dato(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").trim();
  if (!limpio || /^consult/i.test(limpio.normalize("NFD").replace(/[̀-ͯ]/g, ""))) return null;
  return limpio;
}

/**
 * "USD 14.500" → USD 14500; "$9.500.000" → ARS 9500000; "Consultá precio" → null. Si el texto puede leerse de más
 * de una manera (dos números, coma decimal, "mil"/"millones", un monto muy chico) devuelve null: es mejor avisar
 * que se cargue a mano que pegar un precio equivocado en una publicación.
 */
export function precioNumerico(texto: string): { moneda: "ARS" | "USD"; monto: number } | null {
  const dolares = /usd|u\$[sd]|us\$|d[oó]lares/i.test(texto);
  if (!dolares && !texto.includes("$")) return null;
  if (/\d,\d/.test(texto) || /\bmil(lones)?\b|mill[oó]n/i.test(texto)) return null;
  const numeros = texto.match(/\d[\d.]*/g) ?? [];
  if (numeros.length !== 1) return null;
  const monto = Number(numeros[0].replace(/\D/g, ""));
  if (monto < 1000) return null;
  return { moneda: dolares ? "USD" : "ARS", monto };
}

export function armarAviso(v: VehiculoPublicable, plataforma: Plataforma, negocio: DatosNegocio): Aviso {
  const km = dato(v.kilometraje) && /\d/.test(v.kilometraje) ? v.kilometraje.trim() : null;
  const combustible = dato(v.combustible);
  const transmision = dato(v.transmision);
  const motor = dato(v.motor);
  const tipo = dato(v.tipo);
  const precio = precioNumerico(v.precio_texto);

  const base = `${v.marca} ${v.modelo} ${v.anio}`.replace(/\s+/g, " ").trim();
  const titulo =
    plataforma === "mercadolibre"
      ? cortarPorPalabras(km ? `${base} ${km}` : base, MAX_TITULO_MERCADOLIBRE)
      : base;

  const datos: Aviso["datos"] = [
    { etiqueta: "Marca", valor: v.marca },
    { etiqueta: "Modelo", valor: v.modelo },
    { etiqueta: "Año", valor: String(v.anio) },
  ];
  if (km) datos.push({ etiqueta: "Kilometraje", valor: km });
  if (combustible) datos.push({ etiqueta: "Combustible", valor: combustible });
  if (transmision) datos.push({ etiqueta: "Transmisión", valor: transmision });
  if (motor) datos.push({ etiqueta: "Motor", valor: motor });
  if (tipo) datos.push({ etiqueta: "Tipo", valor: tipo });
  if (precio) datos.push({ etiqueta: `Precio (${precio.moneda})`, valor: String(precio.monto) });

  const faltantes: string[] = [];
  if (!precio) faltantes.push(`Precio (en el auto dice «${v.precio_texto.trim() || "sin precio"}»): cargalo a mano`);
  if (!km) faltantes.push("Kilometraje");
  if (!combustible) faltantes.push("Combustible");
  if (!transmision) faltantes.push("Transmisión");
  faltantes.push("Versión", "Color", "Puertas");

  const lineas: string[] = [`${base}.`];
  const ficha: string[] = [];
  if (km) ficha.push(`• Kilometraje: ${km}`);
  if (combustible) ficha.push(`• Combustible: ${combustible}`);
  if (transmision) ficha.push(`• Transmisión: ${transmision}`);
  if (motor) ficha.push(`• Motor: ${motor}`);
  if (tipo) ficha.push(`• Tipo: ${tipo}`);
  if (ficha.length > 0) lineas.push(ficha.join("\n"));

  const propia = (v.descripcion ?? "").trim();
  if (propia) lineas.push(propia);

  const condiciones = [negocio.financiacion, negocio.permutas, negocio.garantia].filter((t): t is string => !!t);
  if (condiciones.length > 0) lineas.push(condiciones.join("\n"));

  lineas.push(`Estamos en ${negocio.ciudad}.`);
  // Mercado Libre no deja teléfonos en la descripción: ahí el contacto va por la publicación.
  if (plataforma === "marketplace") lineas.push(`Escribinos por WhatsApp: ${negocio.whatsappVisible}`);

  return { titulo, descripcion: lineas.join("\n\n"), datos, faltantes };
}

/** Todo el aviso en un solo texto, para el botón "Copiar todo". */
export function avisoComoTexto(a: Aviso): string {
  const ficha = a.datos.map((d) => `${d.etiqueta}: ${d.valor}`).join("\n");
  return [a.titulo, a.descripcion, ficha].filter(Boolean).join("\n\n");
}
