# Imágenes de vehículos: sin recortes automáticos + recorte manual de portada en el panel

## Contexto

Las cards del catálogo (`vehicle-card.tsx`) y varias otras vistas usan `object-cover`
sobre un contenedor `aspect-video`, lo que recorta automáticamente cualquier foto
que no sea 16:9. Muchas fotos de autos quedan con el techo o las puntas cortadas.
Además, el panel de carga de vehículos (`vehiculo-form.tsx`) no ofrece ninguna forma
de encuadrar la foto de portada ni de arrastrar archivos — solo un `<input type="file">`
plano subido directo a Supabase Storage.

## 1. Ninguna imagen se ve recortada

**Cards del catálogo** (`src/components/vehicle-card.tsx`, `VehicleCard` y
`VehicleCardVendido`): cambiar el `<img>` de `object-cover` a `object-contain`
dentro del contenedor `aspect-video`. Para que no queden franjas vacías feas,
el contenedor lleva de fondo la misma imagen, desenfocada (`blur`) y oscurecida,
ocupando todo el espacio (efecto "letterbox"), con la imagen nítida centrada encima.

**Mismo criterio en el resto de lugares con `object-cover`** detectados:
`src/app/admin/vehiculos/page.tsx` (miniaturas del listado admin),
`src/components/panel/vehicle-row.tsx`, `src/components/image-lightbox.tsx`,
y la galería de miniaturas en `src/app/vehiculos/[slug]/page.tsx`. El hero de
la ficha de detalle usa `background-image` vía CSS, no se toca (ya es
"cover" intencional a pantalla completa, distinto caso de uso).

Este cambio es puramente visual/CSS, no requiere cambios de datos ni de backend.

## 2. Recorte manual de la foto de portada en el panel

Alcance: **solo la foto de portada** (la que hoy se marca como principal con
`moverPrincipal`, posición 0 de `imagenes`). Las demás fotos de la galería no
se recortan — se siguen viendo completas en la ficha del vehículo.

Flujo en `vehiculo-form.tsx`:
1. Sobre la miniatura marcada como portada aparece un botón "Recortar".
2. Se abre un modal con `react-easy-crop` (nueva dependencia, MIT, ~10kb):
   arrastrás la imagen para encuadrar y ajustás el zoom con un slider. El
   recuadro de recorte tiene la proporción exacta de la card (16:9,
   `aspect-video`).
3. Al lado del recorte, una **vista previa en vivo** reutilizando el
   componente `VehicleCard` en miniatura, con datos reales del formulario
   (marca, modelo, precio, etc.), para ver exactamente cómo va a quedar
   publicada la card.
4. Al confirmar: se genera con `<canvas>` un JPEG recortado del área
   seleccionada, se sube a Supabase Storage (mismo bucket `vehiculos-posse`)
   como archivo nuevo, y esa URL pasa a ser `cover_image_url`. La imagen
   original sin recortar permanece intacta en el array `imagenes`.
5. Se puede volver a recortar en cualquier momento reabriendo el modal —
   siempre parte de la imagen original (no de una copia ya recortada), para
   no perder calidad en recortes sucesivos.

Si el usuario nunca recorta manualmente, el comportamiento actual no cambia:
`cover_image_url` sigue siendo la imagen original sin modificar, mostrada con
`object-contain` según el punto 1 (o sea, nunca se ve mal aunque no la hayan
recortado a mano).

## 3. Arrastrar y soltar imágenes

En la zona de carga de fotos del panel, se agregan handlers nativos
`onDragOver` / `onDragLeave` / `onDrop` (sin librería adicional) sobre el
área del botón "Subir fotos", reutilizando la función `handleFiles` ya
existente que procesa un `FileList`. Mientras se arrastra un archivo encima,
el recuadro se resalta visualmente (cambio de borde/fondo). Funciona tanto
para arrastrar archivos sueltos como una selección múltiple desde el
explorador de Windows.

## Dependencias

- Nueva: `react-easy-crop` (única dependencia nueva).
- Sin cambios en el esquema de base de datos: no se agregan columnas: el
  recorte se resuelve subiendo un archivo nuevo y reemplazando
  `cover_image_url`, igual que ya ocurre hoy cuando se reemplaza la portada.

## Fuera de alcance

- Recorte de fotos que no sean la portada.
- Guardar parámetros de recorte editables (zoom/posición) en base de datos —
  se descartó a favor de generar directamente la imagen recortada.
- Compresión/optimización general de imágenes subidas (no pedido, no se toca).
