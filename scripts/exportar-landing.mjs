/**
 * Exporta la landing (`/`) a un unico archivo HTML autocontenido: `landing.html`.
 *
 * Inlinea el CSS y las tipografias, y mete todas las imagenes como data URI
 * redimensionadas, para que el archivo se pueda abrir o mandar por si solo, sin
 * el servidor y sin la carpeta public.
 *
 * Requiere el server de desarrollo corriendo:
 *   npm run dev
 *   node scripts/exportar-landing.mjs
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const ORIGEN = "http://localhost:3000";
const SALIDA = "landing.html";

/** Ancho maximo de las fotos embebidas: alcanza para retina sin inflar el archivo. */
const ANCHO_MAX = 1600;
const CALIDAD = 78;

async function bytesDe(url) {
  if (url.startsWith("http")) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} en ${url}`);
    return Buffer.from(await r.arrayBuffer());
  }
  // Las rutas absolutas del sitio salen de public/, con el %20 ya decodificado.
  return readFile("public" + decodeURIComponent(url));
}

/** Reencoda a JPEG y devuelve el data URI. Las fotos pesan mucho menos asi. */
async function comoDataUri(url) {
  const bytes = await bytesDe(url);
  const jpeg = await sharp(bytes)
    .resize({ width: ANCHO_MAX, withoutEnlargement: true })
    .jpeg({ quality: CALIDAD, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** Las fuentes de next/font viven en /_next/static/media y van tal cual. */
async function fuenteComoDataUri(url) {
  const bytes = await bytesDe(url);
  return `data:font/woff2;base64,${bytes.toString("base64")}`;
}

const kb = (s) => `${Math.round(s / 1024)} KB`;

console.log("Bajando la landing...");
let html = await (await fetch(ORIGEN + "/")).text();

// ── CSS ────────────────────────────────────────────────────────────────────
const hojaEtiqueta = html.match(/<link[^>]+rel="stylesheet"[^>]*>/i);
const hojaUrl = hojaEtiqueta?.[0].match(/href="([^"]+)"/)?.[1];
if (!hojaUrl) throw new Error("No encontre la hoja de estilos en el HTML.");

let css = await (await fetch(ORIGEN + hojaUrl)).text();

// next/font las referencia relativas al propio CSS ("../media/x.woff2") y entre
// comillas, asi que hay que resolverlas contra la ubicacion de la hoja.
const fuentes = [
  ...new Set([...css.matchAll(/url\(\s*['"]?([^)'"]+\.woff2?)['"]?\s*\)/g)].map((m) => m[1])),
];
for (const f of fuentes) {
  const absoluta = new URL(f, ORIGEN + hojaUrl).href;
  css = css.replaceAll(f, await fuenteComoDataUri(absoluta));
}
console.log(`CSS inlineado (${kb(css.length)}), ${fuentes.length} tipografias embebidas`);

// ── Imagenes ───────────────────────────────────────────────────────────────
// Se buscan sobre el HTML y el CSS juntos: el fondo del hero vive en un style.
const candidatas = [
  ...html.matchAll(/(?:src|poster)="([^"]+\.(?:jpe?g|png|webp))"/gi),
  ...html.matchAll(/url\(['"]?([^'")]+\.(?:jpe?g|png|webp))['"]?\)/gi),
];
const urls = [...new Set(candidatas.map((m) => m[1]))].filter((u) => !u.startsWith("data:"));

let embebidas = 0;
for (const u of urls) {
  try {
    const dataUri = await comoDataUri(u.startsWith("http") ? u : ORIGEN + u);
    html = html.replaceAll(`"${u}"`, `"${dataUri}"`).replaceAll(`(${u})`, `(${dataUri})`);
    embebidas++;
    process.stdout.write(`  ${embebidas}/${urls.length}\r`);
  } catch (e) {
    console.warn(`\n  no pude embeber ${u}: ${e.message}`);
  }
}
console.log(`${embebidas}/${urls.length} imagenes embebidas   `);

// ── Limpieza ───────────────────────────────────────────────────────────────
// El video del hero no se embebe: son varios MB y arruinaria el archivo. Al
// sacarle el <source>, el <video> se queda mostrando su poster, que si esta.
const videos = (html.match(/<source[^>]+\.mp4[^>]*>/gi) || []).length;
html = html.replace(/<source[^>]+\.mp4[^>]*>/gi, "");

// Sin React ni Next: esto es una foto estatica de la pagina.
html = html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<link[^>]+rel="(?:preload|prefetch|modulepreload)"[^>]*>/gi, "")
  .replace(hojaEtiqueta[0], `<style>${css}</style>`);

// El menu de hamburguesa lo manejaba React. Se repone con un poco de JS propio,
// clonando los links del nav de escritorio, para que en el celular no quede muerto.
const menuMovil = `
<script>
(function () {
  var boton = document.querySelector('header button[aria-label="Men\\u00fa"]');
  var nav = document.querySelector('header nav');
  if (!boton || !nav) return;

  var panel = document.createElement('div');
  panel.className = 'border-t border-car-gold/20 bg-car-black/98 px-5 py-4 md:hidden';
  panel.style.display = 'none';
  nav.querySelectorAll('a').forEach(function (a) {
    var copia = a.cloneNode(true);
    copia.className = 'block py-3 text-sm font-semibold uppercase tracking-wide text-car-white/80';
    panel.appendChild(copia);
  });
  boton.closest('header').appendChild(panel);

  boton.addEventListener('click', function () {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
})();
</script>`;
html = html.replace("</body>", menuMovil + "\n</body>");

const aviso = `<!--
  Landing de Posse Automotores, exportada como archivo unico.
  Generado por scripts/exportar-landing.mjs desde ${ORIGEN}/
  Fecha: ${new Date().toISOString()}

  Es una foto estatica: el stock no se actualiza solo y el video del hero se
  reemplazo por su imagen de portada para que el archivo siga siendo liviano.
-->
`;

await writeFile(SALIDA, aviso + html, "utf8");
console.log(`\n${SALIDA} listo — ${kb(Buffer.byteLength(html))}${videos ? `, ${videos} video reemplazado por su poster` : ""}`);
