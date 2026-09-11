# Trazabilidad de campañas de Reel vs. web en el mensaje de WhatsApp

## Contexto

Hoy los dos botones de "Consultar por WhatsApp" (card del catálogo y ficha de
detalle) arman su texto con `buildWhatsAppUrl(nombre, anio, context)` en
`src/lib/utils.ts`, con dos mensajes genéricos fijos según el contexto
(`"card"` o `"ficha"`). No hay forma de saber si un lead vino de un Reel de
Instagram promocionado o de tráfico orgánico de la web.

Se agrega un campo interno por vehículo, marcable/desmarcable desde el panel
admin, que cambia el texto prearmado de WhatsApp para que el mensaje que
llega sea la prueba de que el cliente vio el Reel — sin tocar nada visible
en el sitio público.

## 1. Base de datos

Nueva columna en `vehiculos_posse`, aditiva y con default seguro:

```sql
alter table public.vehiculos_posse
  add column promocionado_reel boolean not null default false;
```

Se aplica directamente contra la base de producción (autorizado por el
usuario), usando la Service Role Key ya presente en `.env.local`. No se
migran datos existentes (todos los vehículos actuales quedan en `false`,
comportamiento idéntico al de hoy).

## 2. Tipos y panel admin

- `src/lib/types.ts`: se agrega `promocionado_reel: boolean` al tipo
  `Vehiculo`.
- `src/app/admin/vehiculos/vehiculo-form.tsx`: un checkbox "🎥 Promocionado
  en Reel" en la sección "Precio y estado" (junto a Estado y Badge, que es
  donde viven los otros flags/metadatos del vehículo). Sin texto de ayuda
  elaborado — un checkbox simple con label clara.
- `src/app/admin/vehiculos/form-actions.ts`: `createVehiculo` y
  `updateVehiculo` leen `formData.get("promocionado_reel")` (un checkbox
  desmarcado no manda el campo en el FormData, así que ausencia = `false`,
  presencia con valor `"on"` = `true`) y lo guardan en el insert/update.

El campo es 100% interno: no se renderiza en `VehicleCard`,
`VehicleCardVendido`, la ficha del vehículo, ni el listado admin (que ya
tiene suficiente información visual con estado/badge). Es exclusivamente
input para el flujo de WhatsApp.

## 3. Mensaje de WhatsApp condicional

`buildWhatsAppUrl` en `src/lib/utils.ts` cambia de firma: en vez de recibir
`(nombre, anio, context)`, recibe el vehículo (o los campos que necesita:
`nombre`, `tipo`, `promocionado_reel`) y arma el texto según dos ejes
independientes:

**Emoji del vehículo** (según `tipo`):
- `tipo === "Moto"` → 🏍️
- cualquier otro valor (Sedán, Hatchback, SUV, Pick-up, Camioneta,
  Utilitario, o sin especificar) → 🚗

**Artículo** (mismo criterio que el emoji, para que el mensaje se lea
natural):
- `tipo === "Moto"` → "la"
- cualquier otro valor → "el"

**Texto final**, según `promocionado_reel`:

- `true`:
  `Hola, vi el Reel de {artículo} {nombre} {emoji_vehículo}🎥 y entré a la web. ¡Quiero más info!`
- `false` (default):
  `Hola, vengo desde el catálogo web 💻. Me interesa {artículo} {nombre} {emoji_vehículo}. ¿Sigue disponible?`

Ejemplos:
- Honda XR 250 (moto) + Reel: `Hola, vi el Reel de la Honda XR 250 🏍️🎥 y entré a la web. ¡Quiero más info!`
- Ford Mondeo Titanium 2.0 (auto) + web: `Hola, vengo desde el catálogo web 💻. Me interesa el Ford Mondeo Titanium 2.0 🚗. ¿Sigue disponible?`

Este mensaje reemplaza a los dos mensajes genéricos actuales (`"card"` y
`"ficha"`) — con este cambio ya no hace falta distinguir por contexto, el
mismo texto se usa en ambos botones, como pidió el usuario. El parámetro
`context` de `buildWhatsAppUrl` se elimina.

## 4. Consumidores a actualizar

- `src/components/vehicle-card.tsx` (línea 56): pasa a llamar
  `buildWhatsAppUrl(vehiculo)` en vez de
  `buildWhatsAppUrl(vehiculo.nombre, vehiculo.anio, "card")`.
- `src/app/vehiculos/[slug]/page.tsx` (línea 37): pasa a llamar
  `buildWhatsAppUrl(v)` en vez de `buildWhatsAppUrl(v.nombre, v.anio, "ficha")`.

## Fuera de alcance

- No se agrega ningún indicador visual del campo en el sitio público ni en
  el listado admin — es explícitamente invisible salvo en el formulario de
  carga/edición.
- No se versiona el histórico de qué vehículos estuvieron promocionados en
  qué fechas — el campo es un flag simple de estado actual (tildado/
  destildado), sin auditoría.
- No se toca el mensaje de WhatsApp flotante (`FloatingWhatsApp`, si existe
  fuera de la ficha de un vehículo específico) — este cambio es solo para
  los botones que ya reciben un vehículo concreto.
