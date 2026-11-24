import type { Vehiculo } from "@/lib/types";

/** Lo que el panel necesita de un auto para mostrar su llave. */
export type VehiculoLlave = Pick<
  Vehiculo,
  "id" | "nombre" | "marca" | "modelo" | "anio" | "estado" | "cover_image_url" | "key_image_url" | "patente"
>;

/** Texto que se busca en el buscador de imágenes: "llave Chevrolet Cruze 2018 original". */
export function consultaLlave(v: Pick<Vehiculo, "marca" | "modelo" | "anio">): string {
  return `llave ${v.marca} ${v.modelo} ${v.anio} original`.replace(/\s+/g, " ").trim();
}

const sinTildes = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** "ab 123-cd" → "ab123cd": para comparar patentes sin importar espacios ni guiones. */
const compacto = (texto: string) => sinTildes(texto).replace(/[^a-z0-9]/g, "");

/**
 * Filtro instantáneo del buscador: cada palabra tiene que aparecer en el nombre, la marca, el modelo o el año,
 * o ser parte de la patente (con o sin espacios). Sin texto devuelve todo.
 */
export function filtrarLlaves<T extends Pick<Vehiculo, "nombre" | "marca" | "modelo" | "anio" | "patente">>(
  vehiculos: T[],
  termino: string,
): T[] {
  const buscado = sinTildes(termino).trim();
  if (buscado === "") return vehiculos;
  const buscadoCompacto = compacto(termino);
  const palabras = buscado.split(/\s+/);

  return vehiculos.filter((v) => {
    const texto = sinTildes(`${v.nombre} ${v.marca} ${v.modelo} ${v.anio}`);
    const patente = compacto(v.patente ?? "");
    // "ab 123 cd" escrito con espacios también tiene que encontrar la patente AB123CD.
    if (buscadoCompacto.length >= 3 && patente.includes(buscadoCompacto)) return true;
    return palabras.every((p) => texto.includes(p) || (compacto(p) !== "" && patente.includes(compacto(p))));
  });
}

/**
 * Deja la patente en mayúsculas y sin espacios. Texto vacío → null (borrar la patente);
 * algo que no parece una patente (5 a 8 letras o números) → undefined.
 */
export function normalizarPatente(crudo: string): string | null | undefined {
  const limpia = crudo.replace(/[\s.-]/g, "").toUpperCase();
  if (limpia === "") return null;
  return /^[A-Z0-9]{5,8}$/.test(limpia) ? limpia : undefined;
}

/** "AB123CD" → "AB 123 CD", "ABC123" → "ABC 123"; cualquier otra cosa se muestra tal cual. */
export function formatearPatente(patente: string): string {
  const nueva = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(patente);
  if (nueva) return `${nueva[1]} ${nueva[2]} ${nueva[3]}`;
  const vieja = /^([A-Z]{3})(\d{3})$/.exec(patente);
  if (vieja) return `${vieja[1]} ${vieja[2]}`;
  return patente;
}

/** Autos que necesitan llave: los que están en venta (un vendido ya no se muestra a nadie). */
export function autosConLlave<T extends Pick<Vehiculo, "estado">>(vehiculos: T[]): T[] {
  return vehiculos.filter((v) => v.estado !== "vendido");
}
