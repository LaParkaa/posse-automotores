/**
 * Achica una foto sacada con el celular antes de subirla: una foto de cámara pesa 3 a 8 MB y el servidor acepta
 * como máximo 1 MB por acción. Solo para el navegador.
 */

export const MAX_BYTES_SUBIDA = 900_000;
const LADO_MAXIMO = 1280;
const CALIDADES = [0.85, 0.75, 0.65, 0.55];

function aBlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => canvas.toBlob(resolver, "image/jpeg", calidad));
}

async function abrir(archivo: File): Promise<{ imagen: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }> {
  if (typeof createImageBitmap === "function") {
    // "from-image" respeta la orientación de la foto (los celulares guardan las fotos de costado con un aviso).
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    return { imagen: bitmap, ancho: bitmap.width, alto: bitmap.height, cerrar: () => bitmap.close() };
  }
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { imagen: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
}

/** Devuelve un JPG de hasta ~900 KB. Lanza un Error con un texto para mostrar si no se pudo. */
export async function comprimirFoto(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) throw new Error("Elegí una foto (JPG, PNG o WebP)");

  const origen = await abrir(archivo);
  try {
    let escala = Math.min(1, LADO_MAXIMO / Math.max(origen.ancho, origen.alto));
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(origen.ancho * escala));
      canvas.height = Math.max(1, Math.round(origen.alto * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Tu navegador no pudo preparar la foto");
      ctx.drawImage(origen.imagen, 0, 0, canvas.width, canvas.height);

      for (const calidad of CALIDADES) {
        const blob = await aBlob(canvas, calidad);
        if (blob && blob.size <= MAX_BYTES_SUBIDA) return blob;
      }
      escala *= 0.75; // sigue pesando de más: se achica el tamaño y se vuelve a probar
    }
  } finally {
    origen.cerrar();
  }
  throw new Error("La foto es demasiado pesada. Probá con otra.");
}
