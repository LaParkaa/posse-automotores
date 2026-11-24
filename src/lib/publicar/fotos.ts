import type { Vehiculo } from "@/lib/types";

/** Las fotos del auto para publicar: la portada primero, sin repetir y solo direcciones http(s). */
export function fotosDelAuto(v: Pick<Vehiculo, "cover_image_url" | "imagenes">): string[] {
  const vistas = new Set<string>();
  for (const url of [v.cover_image_url, ...v.imagenes]) {
    if (url && /^https?:\/\//i.test(url)) vistas.add(url);
  }
  return [...vistas];
}

/** "volkswagen-vento-2015-1.jpg": sin tildes ni espacios, con el número de la foto (desde 1). */
export function nombreArchivoFoto(nombreAuto: string, indice: number, url: string): string {
  const base = nombreAuto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const extension = /\.(jpe?g|png|webp|gif|avif)$/i.exec(url.split(/[?#]/)[0])?.[1].toLowerCase() ?? "jpg";
  return `${base || "auto"}-${indice + 1}.${extension}`;
}

export type ResultadoFotos =
  | { estado: "compartido" | "descargado" | "cancelado" }
  | { estado: "error"; mensaje: string };

/** Lo que toca el navegador, separado para poder probar la lógica sin navegador. */
export type DepsFotos = {
  bajar: (url: string) => Promise<Blob>;
  puedeCompartir: (archivos: File[]) => boolean;
  compartir: (archivos: File[], titulo: string) => Promise<void>;
  /** Descarga normal del navegador. */
  guardar: (archivo: File) => void;
};

const esCancelacion = (e: unknown) => (e as { name?: string } | null)?.name === "AbortError";

/**
 * Baja las fotos y las manda juntas a otra app del celular (WhatsApp, Marketplace…). Si el navegador no puede
 * compartir archivos, las descarga una por una. Cancelar el compartir no es un error.
 */
export async function compartirFotos(urls: string[], nombreAuto: string, deps: DepsFotos): Promise<ResultadoFotos> {
  if (urls.length === 0) return { estado: "error", mensaje: "Este auto no tiene fotos para compartir." };

  let archivos: File[];
  try {
    archivos = await Promise.all(
      urls.map(async (url, i) => {
        const blob = await deps.bajar(url);
        return new File([blob], nombreArchivoFoto(nombreAuto, i, url), { type: blob.type || "image/jpeg" });
      }),
    );
  } catch {
    return { estado: "error", mensaje: "No se pudieron bajar las fotos. Revisá la señal y probá de nuevo." };
  }

  if (deps.puedeCompartir(archivos)) {
    try {
      await deps.compartir(archivos, nombreAuto);
      return { estado: "compartido" };
    } catch (e) {
      if (esCancelacion(e)) return { estado: "cancelado" };
      // Cualquier otro fallo del compartir: se baja igual, que es lo que el usuario quería.
    }
  }

  for (const archivo of archivos) deps.guardar(archivo);
  return { estado: "descargado" };
}

export const depsDelNavegador: DepsFotos = {
  bajar: async (url) => {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.blob();
  },
  puedeCompartir: (archivos) =>
    typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: archivos }),
  compartir: (archivos, titulo) => navigator.share({ files: archivos, title: titulo }),
  guardar: (archivo) => {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = archivo.name;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
