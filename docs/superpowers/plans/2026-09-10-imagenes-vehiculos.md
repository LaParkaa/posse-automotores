# Imágenes de vehículos: sin recorte automático + recorte manual de portada + drag&drop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ninguna foto de vehículo se muestra recortada en el sitio público, el panel de administración permite recortar manualmente la foto de portada con vista previa de card en vivo, y la carga de fotos en el panel admite arrastrar y soltar archivos.

**Architecture:** Cambio 1 es puramente visual: un componente compartido `VehicleThumbnail` reemplaza `object-cover` por `object-contain` sobre un fondo desenfocado ("letterbox"), usado en todos los lugares que muestran la portada de un vehículo como miniatura/card. Cambio 2 agrega una herramienta de recorte en el panel (`react-easy-crop` + un helper de `<canvas>` para generar el archivo final) que sube la imagen recortada como una foto nueva a Supabase Storage y la antepone al array `imagenes` (que ya determina `cover_image_url` en el servidor tomando `imagenes[0]`) — la foto original permanece en el array, ahora en la posición siguiente. Cambio 3 agrega handlers nativos de drag&drop sobre la zona de carga existente, reutilizando la función de subida ya implementada.

**Tech Stack:** Next.js 16 (React 19, App Router), Tailwind v4, Supabase Storage (`@supabase/ssr`), Vitest (entorno `node`, sin infraestructura de tests de componentes React instalada). Nueva dependencia: `react-easy-crop`.

## Global Constraints

- Única dependencia nueva permitida: `react-easy-crop`. No agregar `@testing-library/react`, `jsdom` ni cambiar `vitest.config.ts` — el proyecto no tiene tests de componentes React y este plan no lo introduce.
- No se agregan columnas a la base de datos. `cover_image_url` se sigue derivando en el servidor de `imagenes[0]` (`src/app/admin/vehiculos/form-actions.ts:93,151`) — no tocar ese archivo.
- El recorte manual solo aplica a la foto de portada (índice 0 de `imagenes`). Las demás fotos no se tocan.
- Todo componente de UI nuevo o modificado se verifica manualmente en el navegador (dev server `posse-dev`, puerto 3000, ya configurado en `.claude/launch.json`) porque el proyecto no tiene tests de componentes — este paso reemplaza al "test" en las tareas de UI.
- Los únicos tests automatizados (`vitest`, `src/**/*.test.ts`) son para lógica pura sin DOM/canvas.
- Idioma de toda copy visible al usuario: español, igual que el resto del panel.

---

### Task 1: Ninguna imagen se muestra recortada (componente `VehicleThumbnail` + aplicarlo en cards, listado admin y galería)

**Files:**
- Create: `src/components/vehicle-thumbnail.tsx`
- Modify: `src/components/vehicle-card.tsx:15-20,68-73`
- Modify: `src/app/admin/vehiculos/page.tsx:53-63`
- Modify: `src/components/panel/vehicle-row.tsx:25-35`
- Modify: `src/components/image-lightbox.tsx:33-37`

**Interfaces:**
- Produces: `VehicleThumbnail({ src: string; alt: string; className?: string; imgClassName?: string; loading?: "lazy" | "eager" })` — componente exportado desde `src/components/vehicle-thumbnail.tsx`, usado por las Tasks siguientes indirectamente (Task 3 lo usa vía `VehicleCard`, que a su vez lo usa desde esta Task).

- [ ] **Step 1: Crear el componente `VehicleThumbnail`**

Crear `src/components/vehicle-thumbnail.tsx`:

```tsx
export function VehicleThumbnail({
  src,
  alt,
  className = "aspect-video w-full",
  imgClassName = "",
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <div className={`relative overflow-hidden bg-car-gray2 ${className}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-xl"
        style={{ backgroundImage: `url(${src})` }}
      />
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={`relative h-full w-full object-contain ${imgClassName}`}
      />
    </div>
  );
}
```

Esto muestra la imagen completa (`object-contain`) centrada, con un fondo relleno con la misma imagen desenfocada y oscurecida para que no queden franjas vacías feas cuando la proporción de la foto no coincide con la de la card.

- [ ] **Step 2: Usar `VehicleThumbnail` en `vehicle-card.tsx`**

En `src/components/vehicle-card.tsx`, agregar el import (después de la línea 3):

```tsx
import { VehicleThumbnail } from "@/components/vehicle-thumbnail";
```

Reemplazar las líneas 15-20 (dentro de `VehicleCard`):

```tsx
        {vehiculo.cover_image_url ? (
          <VehicleThumbnail
            src={vehiculo.cover_image_url}
            alt={vehiculo.nombre}
            className="aspect-video w-full"
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full bg-car-gray2" />
        )}
```

Reemplazar las líneas 68-73 (dentro de `VehicleCardVendido`):

```tsx
        {vehiculo.cover_image_url ? (
          <VehicleThumbnail
            src={vehiculo.cover_image_url}
            alt={vehiculo.nombre}
            className="aspect-video w-full"
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full bg-car-gray2" />
        )}
```

- [ ] **Step 3: Usar `VehicleThumbnail` en el listado del admin**

En `src/app/admin/vehiculos/page.tsx`, agregar el import (después de la línea 6):

```tsx
import { VehicleThumbnail } from "@/components/vehicle-thumbnail";
```

Reemplazar las líneas 53-63:

```tsx
              {v.cover_image_url ? (
                <VehicleThumbnail
                  src={v.cover_image_url}
                  alt={v.nombre}
                  className="aspect-video w-full"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-car-gray2 text-xs text-car-muted">
                  Sin foto
                </div>
              )}
```

- [ ] **Step 4: Usar `VehicleThumbnail` en `vehicle-row.tsx` (panel móvil)**

En `src/components/panel/vehicle-row.tsx`, agregar el import (después de la línea 1):

```tsx
import { VehicleThumbnail } from "@/components/vehicle-thumbnail";
```

Reemplazar las líneas 25-35:

```tsx
        {vehiculo.cover_image_url ? (
          <VehicleThumbnail
            src={vehiculo.cover_image_url}
            alt=""
            className="size-16 shrink-0 rounded"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded bg-car-gray2 text-[10px] text-car-muted">
            Sin foto
          </div>
        )}
```

- [ ] **Step 5: Usar `VehicleThumbnail` en la grilla de miniaturas del lightbox**

En `src/components/image-lightbox.tsx`, agregar el import (después de la línea 1):

```tsx
import { VehicleThumbnail } from "@/components/vehicle-thumbnail";
```

Reemplazar las líneas 33-37 (la miniatura dentro del `<button>` del grid; el `<img>` del modal ampliado en las líneas 82-87 NO se toca, ya usa `object-contain`):

```tsx
            <VehicleThumbnail
              src={url}
              alt={`${alt} ${i + 1}`}
              className="aspect-video w-full"
              imgClassName="transition group-hover:scale-105"
            />
```

- [ ] **Step 6: Verificar en el navegador**

```bash
npm run build
```

Expected: build sin errores de TypeScript.

Iniciar el servidor de dev (`preview_start` con `name: "posse-dev"`), navegar a `/catalogo`, y confirmar visualmente:
- Ninguna card muestra un auto cortado en los bordes (comparar con la captura del usuario: Ford Mondeo, Honda XR 250, Chevrolet Agile, etc. deben verse completos).
- Las cards con fotos que no son 16:9 muestran franjas con la misma foto desenfocada de fondo, no un recorte.
- Repetir la revisión visual en `/admin/vehiculos` (listado admin) y en la ficha de un vehículo con varias fotos (`/vehiculos/<slug>`, sección Galería).

- [ ] **Step 7: Commit**

```bash
git add src/components/vehicle-thumbnail.tsx src/components/vehicle-card.tsx src/app/admin/vehiculos/page.tsx src/components/panel/vehicle-row.tsx src/components/image-lightbox.tsx
git commit -m "$(cat <<'EOF'
fix: mostrar las fotos de vehiculos completas en vez de recortadas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Dependencia `react-easy-crop` + helper de recorte con `<canvas>`

**Files:**
- Modify: `package.json` (agregar dependencia)
- Create: `src/lib/image-crop.ts`
- Test: `src/lib/image-crop.test.ts`

**Interfaces:**
- Produces: `clampPixelCrop(crop: PixelCrop, imageWidth: number, imageHeight: number): PixelCrop` y `cropImageToBlob(imageSrc: string, crop: PixelCrop, mimeType?: string, quality?: number): Promise<Blob>`, ambas exportadas desde `src/lib/image-crop.ts`. `PixelCrop` es `{ x: number; y: number; width: number; height: number }`. Usadas por Task 3.

- [ ] **Step 1: Instalar la dependencia**

```bash
npm install react-easy-crop
```

Expected: agrega `"react-easy-crop"` a `dependencies` en `package.json` y actualiza `package-lock.json`.

- [ ] **Step 2: Escribir el test que falla para `clampPixelCrop`**

Crear `src/lib/image-crop.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampPixelCrop } from "./image-crop";

describe("clampPixelCrop", () => {
  it("deja intacto un recorte que ya está dentro de los límites", () => {
    const crop = { x: 10, y: 20, width: 100, height: 50 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual(crop);
  });

  it("recorta el ancho y alto si exceden la imagen", () => {
    const crop = { x: 0, y: 0, width: 500, height: 500 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it("desplaza x/y negativos a 0", () => {
    const crop = { x: -20, y: -5, width: 100, height: 50 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it("desplaza el origen hacia adentro si el recorte se sale por abajo/derecha", () => {
    const crop = { x: 350, y: 280, width: 100, height: 50 };
    expect(clampPixelCrop(crop, 400, 300)).toEqual({ x: 300, y: 250, width: 100, height: 50 });
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

```bash
npx vitest run src/lib/image-crop.test.ts
```

Expected: FAIL — `Failed to resolve import "./image-crop"` (el archivo todavía no existe).

- [ ] **Step 4: Implementar `src/lib/image-crop.ts`**

```ts
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
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

```bash
npx vitest run src/lib/image-crop.test.ts
```

Expected: PASS — 4 tests en verde. (`cropImageToBlob` no se testea acá porque depende de `Image`/`canvas` del navegador, que no existen en el entorno `node` de Vitest; se verifica manualmente en Task 3.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/image-crop.ts src/lib/image-crop.test.ts
git commit -m "$(cat <<'EOF'
feat: agregar react-easy-crop y helper de recorte con canvas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Modal de recorte de portada con vista previa de card, integrado al panel

**Files:**
- Create: `src/app/admin/vehiculos/cover-crop-modal.tsx`
- Modify: `src/app/admin/vehiculos/vehiculo-form.tsx`

**Interfaces:**
- Consumes: `cropImageToBlob(imageSrc, crop, mimeType?, quality?): Promise<Blob>` de `src/lib/image-crop.ts` (Task 2). `VehicleCard({ vehiculo: Vehiculo })` de `src/components/vehicle-card.tsx` (Task 1, sin cambios de firma).
- Produces: `CoverCropModal({ imageUrl: string; previewVehiculo: Vehiculo; onConfirm: (blob: Blob) => void; onClose: () => void })`, exportado desde `src/app/admin/vehiculos/cover-crop-modal.tsx`. Solo lo consume `vehiculo-form.tsx` en esta misma Task.

- [ ] **Step 1: Crear el modal de recorte**

Crear `src/app/admin/vehiculos/cover-crop-modal.tsx`:

```tsx
"use client";
import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { X } from "lucide-react";
import { VehicleCard } from "@/components/vehicle-card";
import { cropImageToBlob } from "@/lib/image-crop";
import type { Vehiculo } from "@/lib/types";

export function CoverCropModal({
  imageUrl,
  previewVehiculo,
  onConfirm,
  onClose,
}: {
  imageUrl: string;
  previewVehiculo: Vehiculo;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback(
    async (_area: Area, areaPixels: Area) => {
      setCroppedAreaPixels(areaPixels);
      try {
        const blob = await cropImageToBlob(imageUrl, areaPixels);
        setPreviewUrl(URL.createObjectURL(blob));
      } catch {
        // Si falla la generación de la vista previa se sigue mostrando la
        // última válida; el recorte final se reintenta al confirmar.
      }
    },
    [imageUrl]
  );

  async function confirmar() {
    if (!croppedAreaPixels) return;
    setConfirming(true);
    setError("");
    try {
      const blob = await cropImageToBlob(imageUrl, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      setError("No se pudo generar el recorte. Probá de nuevo.");
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-white/10 bg-car-gray p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-condensed text-lg font-bold uppercase tracking-wide text-car-gold">
            Recortar portada
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-car-muted transition hover:text-car-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-car-muted">
              Así se va a ver la card
            </p>
            <div className="pointer-events-none">
              <VehicleCard vehiculo={{ ...previewVehiculo, cover_image_url: previewUrl }} />
            </div>
          </div>
        </div>

        <label className="mt-4 block text-xs uppercase tracking-wide text-car-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/15 px-5 py-2.5 text-sm text-car-muted transition hover:text-car-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!croppedAreaPixels || confirming}
            className="rounded bg-car-gold px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50"
          >
            {confirming ? "Aplicando..." : "Usar este recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Agregar estado y helpers en `vehiculo-form.tsx`**

En `src/app/admin/vehiculos/vehiculo-form.tsx`, agregar el import del modal después de la línea 5:

```tsx
import { CoverCropModal } from "./cover-crop-modal";
```

Agregar, después de la línea 46 (`const formRef = useRef<HTMLFormElement>(null);`):

```tsx
  const [recortando, setRecortando] = useState(false);

  function construirVehiculoDeVistaPrevia(): Vehiculo {
    const datos = formRef.current ? new FormData(formRef.current) : new FormData();
    return {
      id: "preview",
      slug: "preview",
      nombre: (datos.get("nombre") as string) || "",
      marca: (datos.get("marca") as string) || "",
      modelo: (datos.get("modelo") as string) || "",
      anio: Number(datos.get("anio")) || new Date().getFullYear(),
      kilometraje: (datos.get("kilometraje") as string) || "Consultá km",
      combustible: (datos.get("combustible") as string) || "Nafta",
      transmision: (datos.get("transmision") as string) || "Manual",
      motor: null,
      tipo: (datos.get("tipo") as string) || null,
      descripcion: null,
      precio_texto: (datos.get("precio_texto") as string) || "Consultá precio",
      cover_image_url: imagenes[0] ?? null,
      imagenes: [],
      videos: [],
      estado: (datos.get("estado") as Vehiculo["estado"]) || "disponible",
      badge: (datos.get("badge") as string) || null,
      created_at: "",
      deleted_at: null,
      sold_at: null,
      sale_price: null,
      sale_notes: null,
    };
  }

  async function subirPortadaRecortada(blob: Blob) {
    setUploading(true);
    setUploadError("");
    const supabase = getSupabase();
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, blob, { upsert: false });

    if (error) {
      setUploadError(`Error subiendo el recorte: ${error.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
    setImagenes((prev) => [data.publicUrl, ...prev]);
    setUploading(false);
    setRecortando(false);
  }
```

- [ ] **Step 3: Agregar el botón "Recortar" sobre la miniatura de portada**

En `src/app/admin/vehiculos/vehiculo-form.tsx`, dentro del bloque que renderiza cada miniatura (líneas 263-280 del archivo original, el `<div>` con la clase `absolute inset-0 flex flex-col...`), agregar el botón de recorte junto al de "Principal". Reemplazar ese bloque completo:

```tsx
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded bg-black/60 opacity-0 transition group-hover:opacity-100">
                  {i === 0 && (
                    <button
                      type="button"
                      onClick={() => setRecortando(true)}
                      className="rounded bg-car-gold px-2 py-0.5 text-[10px] font-bold text-car-black"
                    >
                      Recortar
                    </button>
                  )}
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => moverPrincipal(url)}
                      className="rounded bg-car-gold px-2 py-0.5 text-[10px] font-bold text-car-black"
                    >
                      Principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminarImagen(url)}
                    className="rounded bg-red-600 p-1 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
```

- [ ] **Step 4: Renderizar el modal condicionalmente**

En `src/app/admin/vehiculos/vehiculo-form.tsx`, justo antes del `return (` del componente (antes de la línea 148, `return (`), no hace falta nada — el modal se agrega dentro del JSX. Ubicarlo inmediatamente después de la etiqueta de apertura `<form ...>` (después de la línea 153, `className="max-w-2xl space-y-6 rounded-lg border border-white/10 bg-car-gray p-5 sm:p-8"` seguida de `>`):

```tsx
      {recortando && imagenes[0] && (
        <CoverCropModal
          imageUrl={imagenes[0]}
          previewVehiculo={construirVehiculoDeVistaPrevia()}
          onConfirm={subirPortadaRecortada}
          onClose={() => setRecortando(false)}
        />
      )}
```

Nota: este bloque queda dentro del `<form>`. Como es un `<div>` fixed con `z-50` no afecta el layout del formulario; usa `type="button"` en todos sus botones internos (ya está así en el modal) para no disparar el submit del form al hacer click.

- [ ] **Step 5: Verificar en el navegador**

```bash
npm run build
```

Expected: build sin errores de TypeScript.

Con el dev server corriendo (`preview_start`, `name: "posse-dev"`):
1. Ir a `/admin/vehiculos/nuevo`, completar nombre/marca/modelo/año, subir 2-3 fotos.
2. Sobre la miniatura marcada "Principal", pasar el mouse y click en "Recortar". Confirmar que se abre el modal con la imagen completa y el recuadro de recorte 16:9.
3. Arrastrar la imagen dentro del recuadro y mover el slider de zoom; confirmar que la vista previa de la card (lado derecho) se actualiza con la card real (mismo nombre, año, precio, etc. que se cargaron en el paso 1).
4. Click en "Usar este recorte"; confirmar que el modal se cierra, aparece una miniatura nueva subida y ahora es la marcada como "Principal", y la foto original sigue presente en la grilla de miniaturas (ya no como principal).
5. Guardar el vehículo y abrir su ficha pública (`/vehiculos/<slug>`): la card del catálogo debe mostrar la versión recortada como portada, y la foto original sin recortar debe seguir apareciendo en la Galería.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/vehiculos/cover-crop-modal.tsx src/app/admin/vehiculos/vehiculo-form.tsx
git commit -m "$(cat <<'EOF'
feat: recorte manual de la foto de portada con vista previa de card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Arrastrar y soltar imágenes en la zona de carga

**Files:**
- Modify: `src/app/admin/vehiculos/vehiculo-form.tsx`

**Interfaces:**
- Consumes: `handleFiles(files: FileList | null)`, ya definida en el mismo archivo (línea 48).

- [ ] **Step 1: Agregar estado de arrastre y handlers**

En `src/app/admin/vehiculos/vehiculo-form.tsx`, agregar después de la declaración de `recortando` (agregada en Task 3, Step 2):

```tsx
  const [arrastrando, setArrastrando] = useState(false);

  function onDragOverFotos(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setArrastrando(true);
  }

  function onDragLeaveFotos(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setArrastrando(false);
  }

  function onDropFotos(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setArrastrando(false);
    handleFiles(e.dataTransfer.files);
  }
```

- [ ] **Step 2: Conectar los handlers al botón de "Agregar fotos" y resaltarlo mientras se arrastra**

En `src/app/admin/vehiculos/vehiculo-form.tsx`, reemplazar el botón de subir fotos (líneas 294-305 del archivo original):

```tsx
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOverFotos}
          onDragLeave={onDragLeaveFotos}
          onDrop={onDropFotos}
          disabled={uploading}
          className={`flex w-full items-center justify-center gap-2 rounded border border-dashed py-4 text-sm transition disabled:opacity-50 ${
            arrastrando
              ? "border-car-gold bg-car-gold/10 text-car-gold"
              : "border-white/20 text-car-muted hover:border-car-gold hover:text-car-gold"
          }`}
        >
          {uploading ? (
            <><Loader2 size={16} className="animate-spin" /> Subiendo...</>
          ) : arrastrando ? (
            <><ImagePlus size={16} /> Soltá las fotos acá</>
          ) : (
            <><ImagePlus size={16} /> Agregar fotos</>
          )}
        </button>
```

Actualizar el texto de ayuda debajo (línea 307-309 del archivo original) para mencionar la opción de arrastrar:

```tsx
        <p className="mt-1.5 text-xs text-car-muted">
          Podés elegir varias fotos a la vez, desde la galería o la cámara, o arrastrarlas
          directamente acá (por ejemplo, desde una carpeta de Windows).
        </p>
```

- [ ] **Step 3: Verificar en el navegador**

```bash
npm run build
```

Expected: build sin errores de TypeScript.

Con el dev server corriendo, ir a `/admin/vehiculos/nuevo`:
1. Arrastrar un archivo de imagen desde el explorador de archivos sobre el recuadro "Agregar fotos"; confirmar que el recuadro cambia de estilo (borde/fondo dorado) y el texto pasa a "Soltá las fotos acá" mientras el archivo está encima.
2. Soltar el archivo; confirmar que se sube igual que con el selector de archivos (aparece la miniatura nueva) y el recuadro vuelve al estado normal.
3. Repetir arrastrando una selección múltiple de fotos (varios archivos a la vez) y confirmar que se suben todas.
4. Confirmar que el click normal en el recuadro (sin arrastrar) sigue abriendo el selector de archivos de siempre.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/vehiculos/vehiculo-form.tsx
git commit -m "$(cat <<'EOF'
feat: permitir arrastrar y soltar fotos en el panel de carga

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Galería de la ficha con zoom tipo lupa (agregada durante la ejecución, a pedido del usuario)

**Contexto:** Task añadida después de que el usuario, viendo Task 1 en el navegador, pidió un layout de galería estilo Mercado Libre: foto grande + columna de miniaturas + una lupa que amplía al pasar el mouse. La galería actual (`ImageLightbox`, usada solo en `src/app/vehiculos/[slug]/page.tsx:107`) es una grilla que abre un modal a pantalla completa al hacer click; esta task la reemplaza por completo con un nuevo componente. `ImageLightbox` no se usa en ningún otro lugar del proyecto (confirmado por búsqueda), así que se elimina en vez de dejarla sin uso.

**Files:**
- Create: `src/components/gallery-zoom.tsx`
- Modify: `src/app/vehiculos/[slug]/page.tsx:105-108`
- Delete: `src/components/image-lightbox.tsx`

**Interfaces:**
- Produces: `GalleryZoom({ imagenes: string[]; alt: string })`, exportado desde `src/components/gallery-zoom.tsx`. Mismos props que el `ImageLightbox` que reemplaza, para que el cambio en la página de detalle sea un swap directo.

- [ ] **Step 1: Crear el componente `GalleryZoom`**

Crear `src/components/gallery-zoom.tsx`:

```tsx
"use client";
import { useRef, useState } from "react";

/** Cuánto amplía la lupa respecto del tamaño real de la imagen. */
const ZOOM = 2.5;

export function GalleryZoom({ imagenes, alt }: { imagenes: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const imageBoxRef = useRef<HTMLDivElement>(null);

  if (imagenes.length === 0) return null;

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = imageBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    setPos({ x, y });
  }

  function close() {
    setOpenIndex(null);
  }

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    setOpenIndex((i) => (i === null ? null : (i - 1 + imagenes.length) % imagenes.length));
  }

  function next(e: React.MouseEvent) {
    e.stopPropagation();
    setOpenIndex((i) => (i === null ? null : (i + 1) % imagenes.length));
  }

  const lensSize = 100 / ZOOM; // porcentaje del lado del recuadro principal
  const lensLeft = Math.min(Math.max(pos.x * 100 - lensSize / 2, 0), 100 - lensSize);
  const lensTop = Math.min(Math.max(pos.y * 100 - lensSize / 2, 0), 100 - lensSize);

  return (
    <div className="grid gap-4 lg:grid-cols-[80px_1fr_1fr]">
      {/* Miniaturas: fila horizontal en mobile, columna en desktop */}
      <div className="flex gap-2 overflow-x-auto lg:max-h-[480px] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
        {imagenes.map((url, i) => (
          <button
            key={url + i}
            type="button"
            onClick={() => setSelected(i)}
            className={`shrink-0 overflow-hidden rounded border-2 transition ${
              i === selected ? "border-car-gold" : "border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            <img src={url} alt="" className="h-16 w-20 object-cover lg:h-14 lg:w-full" />
          </button>
        ))}
      </div>

      {/* Foto principal */}
      <div>
        <div
          ref={imageBoxRef}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseMove={onMouseMove}
          onClick={() => setOpenIndex(selected)}
          className="relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded bg-car-gray2"
        >
          <img
            src={imagenes[selected]}
            alt={`${alt} ${selected + 1}`}
            className="h-full w-full object-contain"
          />
          {hovering && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute hidden border-2 border-car-gold/70 bg-white/10 lg:block"
              style={{
                width: `${lensSize}%`,
                height: `${lensSize}%`,
                left: `${lensLeft}%`,
                top: `${lensTop}%`,
              }}
            />
          )}
        </div>
        <p className="mt-2 hidden text-xs text-car-muted lg:block">
          Pasá el mouse por la foto para ampliar · Tocá para ver a pantalla completa
        </p>
        <p className="mt-2 text-xs text-car-muted lg:hidden">Tocá la foto para ampliarla</p>
      </div>

      {/* Panel de zoom, solo desktop */}
      <div
        className={`relative hidden aspect-[4/3] overflow-hidden rounded border border-white/10 bg-car-gray2 lg:block`}
        style={
          hovering
            ? {
                backgroundImage: `url(${imagenes[selected]})`,
                backgroundSize: `${ZOOM * 100}%`,
                backgroundPosition: `${pos.x * 100}% ${pos.y * 100}%`,
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      />

      {/* Modal a pantalla completa (mobile: tocar la foto; desktop: click en la foto) */}
      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
            aria-label="Cerrar"
          >
            ×
          </button>

          {imagenes.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:left-6"
                aria-label="Anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:right-6"
                aria-label="Siguiente"
              >
                ›
              </button>
            </>
          )}

          <img
            src={imagenes[openIndex]}
            alt={`${alt} ${openIndex + 1}`}
            className="max-h-[85vh] max-w-full rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {imagenes.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {openIndex + 1} / {imagenes.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

Notas de diseño para el implementador:
- La lupa (`lensSize`/`lensLeft`/`lensTop`) y el panel de zoom (`backgroundSize`/`backgroundPosition`) son la técnica estándar de "zoom con background-position": el recuadro de la izquierda marca qué parte de la foto se está mirando, el panel de la derecha muestra esa parte ampliada. Ambos se ocultan en mobile (`hidden lg:block`) porque dependen de `mousemove`, que no existe con touch.
- El modal a pantalla completa es una copia funcional del que ya existía en `image-lightbox.tsx` (mismo comportamiento: click afuera cierra, flechas prev/next, contador, `object-contain` para no recortar). Se mantiene igual a propósito para no cambiar un comportamiento que ya funcionaba bien.
- La imagen principal usa `aspect-[4/3]` con `object-contain` (no `h-auto` como las cards de la Task 1): en una vista de detalle grande, un recuadro con letterbox es el estándar esperado (así se ve en Mercado Libre, Amazon, etc.) — la objeción original del usuario era específicamente sobre las cards chicas del catálogo con fondo borroso, no sobre este tipo de visor.

- [ ] **Step 2: Reemplazar `ImageLightbox` por `GalleryZoom` en la ficha del vehículo**

En `src/app/vehiculos/[slug]/page.tsx`, cambiar el import (línea 9):

```tsx
import { GalleryZoom } from "@/components/gallery-zoom";
```

Reemplazar las líneas 105-108:

```tsx
                <p className="mt-1 text-sm text-car-muted">Mirá las fotos en detalle</p>
                <div className="mt-5">
                  <GalleryZoom imagenes={v.imagenes} alt={v.nombre} />
                </div>
```

- [ ] **Step 3: Eliminar el componente viejo**

Confirmar que nada más importa `ImageLightbox` (`grep -r "ImageLightbox" src/` no debe encontrar nada fuera del propio archivo que se borra) y eliminar `src/components/image-lightbox.tsx`.

- [ ] **Step 4: Verificar en el navegador**

```bash
npm run build
```

Expected: build sin errores de TypeScript (confirma también que no quedó ningún import roto a `ImageLightbox`).

Con el dev server corriendo, abrir la ficha de un vehículo con varias fotos (`/vehiculos/<slug>`):
1. **Desktop:** confirmar que aparece la foto grande, la columna de miniaturas a la izquierda, y que al pasar el mouse por la foto principal aparece el recuadro de la lupa siguiendo el cursor y, a la derecha, el panel con la zona ampliada. Click en una miniatura cambia la foto principal. Click en la foto principal abre el modal a pantalla completa con flechas prev/next.
2. **Mobile** (usar `resize_window` con preset `mobile` o similar): confirmar que las miniaturas se ven en una fila horizontal debajo/arriba de la foto, que NO aparece ningún panel de zoom (no tiene sentido sin mouse), y que tocar la foto principal abre el mismo modal a pantalla completa.
3. Confirmar que ninguna foto se ve recortada de forma rara en ninguno de los dos casos (la foto principal usa letterbox con `object-contain`, que es el comportamiento esperado en un visor grande).

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery-zoom.tsx src/app/vehiculos/\[slug\]/page.tsx
git rm src/components/image-lightbox.tsx
git commit -m "$(cat <<'EOF'
feat: galeria de la ficha con zoom tipo lupa (estilo Mercado Libre)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
