export type PixelCrop = { x: number; y: number; width: number; height: number };

/**
 * Ajusta un recorte en píxeles para que quede dentro de los límites de la
 * imagen: primero recorta ancho/alto si exceden la imagen, después
 * desplaza el origen para que el rectángulo no se salga por ningún borde.
 */
export function clampPixelCrop(
  crop: PixelCrop,
  imageWidth: number,
  imageHeight: number
): PixelCrop {
  const width = Math.min(crop.width, imageWidth);
  const height = Math.min(crop.height, imageHeight);
  const x = Math.min(Math.max(crop.x, 0), imageWidth - width);
  const y = Math.min(Math.max(crop.y, 0), imageHeight - height);
  return { x, y, width, height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`));
    img.src = src;
  });
}

/**
 * Genera un archivo recortado a partir de una imagen y un rectángulo en
 * píxeles (coordenadas sobre la imagen original, como las que devuelve
 * react-easy-crop en croppedAreaPixels). Requiere DOM (Image + canvas), se
 * usa solo en el navegador.
 */
export async function cropImageToBlob(
  imageSrc: string,
  crop: PixelCrop,
  mimeType = "image/jpeg",
  quality = 0.9
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const safeCrop = clampPixelCrop(crop, image.naturalWidth, image.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = safeCrop.width;
  canvas.height = safeCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el contexto de canvas");

  ctx.drawImage(
    image,
    safeCrop.x,
    safeCrop.y,
    safeCrop.width,
    safeCrop.height,
    0,
    0,
    safeCrop.width,
    safeCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen recortada"))),
      mimeType,
      quality
    );
  });
}
