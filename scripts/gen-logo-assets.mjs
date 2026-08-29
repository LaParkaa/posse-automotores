/**
 * Convierte "img/logo nuevo.jpeg" (line-art negro sobre blanco) en los assets
 * que usa el sitio oscuro:
 *
 *   public/logo-posse.png       lockup completo, trazo blanco, fondo transparente
 *   public/logo-posse-gold.png  idem en dorado de marca
 *   public/icons/icon-{180,192,512}.png  silueta del auto en dorado sobre car-black
 *   src/app/icon.png            favicon (Next lo enlaza solo)
 *   src/app/apple-icon.png      apple-touch-icon (Next lo enlaza solo)
 *
 * Uso: node scripts/gen-logo-assets.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "img/logo nuevo.jpeg";
/** El mismo logo en un lienzo mas alto, subido aparte para los iconos de app. */
const SRC_ICONO = "img/logo-app.jpeg";
const WHITE = { r: 0xee, g: 0xf2, b: 0xff };
const GOLD = { r: 0xc9, g: 0xa2, b: 0x27 };
const BLACK = { r: 0x0d, g: 0x0d, b: 0x12, alpha: 1 };

/** Umbral que descarta el ruido de compresión JPEG del fondo blanco. */
const NOISE_FLOOR = 40;

/**
 * Usa la luminancia invertida del JPEG como canal alfa: donde había trazo negro
 * el alfa queda opaco, donde había papel blanco queda transparente.
 */
async function lineArtToAlpha(archivo = SRC) {
  const { data, info } = await sharp(archivo)
    .flatten({ background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alpha = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) {
    const ink = 255 - data[i * info.channels];
    alpha[i] = ink < NOISE_FLOOR ? 0 : ink;
  }
  return { alpha, width: info.width, height: info.height };
}

/** Pinta la máscara alfa de un color plano y recorta el margen transparente. */
function tint({ alpha, width, height }, color) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < alpha.length; i++) {
    rgba[i * 4] = color.r;
    rgba[i * 4 + 1] = color.g;
    rgba[i * 4 + 2] = color.b;
    rgba[i * 4 + 3] = alpha[i];
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).trim({
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    threshold: 0,
  });
}

/**
 * El lockup son dos bloques apilados (auto arriba, palabra abajo) separados por
 * una franja de filas vacías. Busca esa franja para poder aislar el auto.
 */
function findCarHeight(alpha, width, height) {
  const rowHasInk = [];
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += alpha[y * width + x];
    rowHasInk.push(sum > width * 2);
  }

  const firstInk = rowHasInk.indexOf(true);
  for (let y = firstInk; y < height; y++) {
    if (rowHasInk[y] || !rowHasInk.slice(Math.max(0, y - 1), y).includes(true)) continue;
    // primera fila vacía después de tinta: confirmá que el hueco es real
    let gap = 0;
    while (y + gap < height && !rowHasInk[y + gap]) gap++;
    if (gap > height * 0.01) return y;
  }
  return Math.round(height * 0.55);
}

/**
 * Logo completo en dorado, centrado sobre un cuadrado car-black.
 * El lockup es apaisado (mas o menos 3.3:1), asi que ocupa una banda al medio
 * del icono; se deja algo de margen para que no toque los bordes al recortarse
 * en redondeado.
 */
async function buildIcon(logoPng, size) {
  const glyph = await sharp(logoPng)
    .resize({ width: Math.round(size * 0.84), fit: "inside" })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BLACK },
  })
    .composite([{ input: glyph, gravity: "centre" }])
    .png()
    .toBuffer();
}

const mask = await lineArtToAlpha();

await tint(mask, WHITE).png().toFile("public/logo-posse.png");
await tint(mask, GOLD).png().toFile("public/logo-posse-gold.png");

// Los iconos de app llevan el logo completo, no solo el auto.
const mascaraIcono = await lineArtToAlpha(SRC_ICONO);
const logoPng = await tint(mascaraIcono, GOLD).png().toBuffer();
const { width: lw, height: lh } = await sharp(logoPng).metadata();

await mkdir("public/icons", { recursive: true });
for (const size of [180, 192, 512]) {
  await sharp(await buildIcon(logoPng, size)).toFile(`public/icons/icon-${size}.png`);
}
await sharp(await buildIcon(logoPng, 512)).toFile("src/app/apple-icon.png");
await sharp(await buildIcon(logoPng, 512)).resize(256, 256).toFile("src/app/icon.png");

console.log(`iconos con el lockup completo (${lw}x${lh})`);
