/**
 * No hay en Argentina un registro público de "cuánto vale un usado" (tipo Kelley Blue Book):
 * lo más cercano y siempre actualizado son los clasificados reales. Esto arma el link de
 * búsqueda en MercadoLibre para que el vendedor vea publicaciones vigentes de ese modelo y
 * decida el valor de toma con esa referencia, en vez de un número inventado que queda viejo
 * en semanas con la inflación.
 */
export function urlBusquedaMercadoLibre(marca: string, modelo: string, anio?: string): string {
  const partes = [marca, modelo, anio].map((p) => (p ?? "").trim()).filter((p) => p !== "");
  const slug = partes
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `https://listado.mercadolibre.com.ar/${slug}`;
}
