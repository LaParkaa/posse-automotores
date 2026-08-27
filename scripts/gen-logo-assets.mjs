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
const WHITE = { r: 0xee, g: 0xf2, b: 0xff };
const GOLD = { r: 0xc9, g: 0xa2, b: 0x27 };
const BLACK = { r: 0x0d, g: 0x0d, b: 0x12, alpha: 1 };

/** Umbral que descarta el ruido de compresión JPEG del fondo blanco. */
const NOISE_FLOOR = 40;

/**
 * Usa la luminancia invertida del JPEG como canal alfa: donde había trazo negro
 * el alfa queda opaco, donde había papel blanco queda transparente.
 */
async function lineArtToAlpha() {
  const { data, info } = await sharp(SRC)
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

/** Silueta del auto en dorado, centrada sobre un cuadrado car-black. */
async function buildIcon(carPng, size) {
  const glyph = await sharp(carPng)
    .resize({ width: Math.round(size * 0.92), fit: "inside" })
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

// Aislar el auto: recortar el lockup a la altura de la franja vacía.
const goldTrimmed = await tint(mask, GOLD)
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: tw, height: th } = goldTrimmed.info;
const trimmedAlpha = Buffer.alloc(tw * th);
for (let i = 0; i < trimmedAlpha.length; i++) {
  trimmedAlpha[i] = goldTrimmed.data[i * 4 + 3];
}
const carHeight = findCarHeight(trimmedAlpha, tw, th);

const carPng = await sharp(goldTrimmed.data, { raw: { width: tw, height: th, channels: 4 } })
  .extract({ left: 0, top: 0, width: tw, height: carHeight })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
  .png()
  .toBuffer();

await mkdir("public/icons", { recursive: true });
for (const size of [180, 192, 512]) {
  await sharp(await buildIcon(carPng, size)).toFile(`public/icons/icon-${size}.png`);
}
await sharp(await buildIcon(carPng, 512)).toFile("src/app/apple-icon.png");
await sharp(await buildIcon(carPng, 512)).resize(256, 256).toFile("src/app/icon.png");

console.log(`lockup ${tw}x${th}, auto recortado a ${carHeight}px de alto`);
