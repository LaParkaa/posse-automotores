# Panel de Control Móvil (PWA) — Posse Automotores

Fecha: 2026-08-27
Estado: aprobado

## Objetivo

PWA mobile-first en `/panel` para que el dueño gestione el stock desde su iPhone
(agregada a la pantalla de inicio), cambie el estado de un vehículo en 1 tap
registrando fecha y hora de venta, y consulte métricas de rendimiento. El
catálogo público refleja los cambios en vivo, sin recargar.

`/admin` sigue siendo el panel de escritorio. Se pensó dejarlo intacto, pero
terminó necesitando cambios para no corromper los campos de venta nuevos: ver
el final de la sección 8.

## Decisiones tomadas

| Decisión | Elegido |
| --- | --- |
| Sincronización | Supabase Realtime completo (público + panel) |
| Estado `reservado` en el público | Visible con badge, sin botón de WhatsApp |
| Ubicación de la PWA | Ruta nueva `/panel`; `/admin` ajustado después (sección 8) |
| Gráficos | SVG propio, sin dependencias nuevas |
| Flujo de venta | Hoja rápida con campos opcionales |
| Service worker | No se incluye |

## 1. Esquema de base de datos

Archivo nuevo: `supabase/schema-posse-panel.sql`

```sql
alter table public.vehiculos_posse drop constraint if exists vehiculos_posse_estado_check;
alter table public.vehiculos_posse add constraint vehiculos_posse_estado_check
  check (estado in ('disponible','reservado','vendido'));

alter table public.vehiculos_posse
  add column if not exists sold_at    timestamptz,
  add column if not exists sale_price numeric(12,2),
  add column if not exists sale_notes text;

create index if not exists vehiculos_posse_sold_at_idx
  on public.vehiculos_posse (sold_at desc);

alter publication supabase_realtime add table public.vehiculos_posse;
```

Reglas:

- `sold_at` se escribe con la hora exacta del servidor al pasar a `vendido`.
- Al revertir a `disponible` o `reservado`, `sold_at`, `sale_price` y
  `sale_notes` se limpian a `null`.
- `sale_price` y `sale_notes` son siempre opcionales.
- Las políticas RLS existentes alcanzan: `select using (deleted_at is null)`
  habilita la suscripción Realtime con la anon key. No se crean políticas nuevas.

### Datos históricos

Los vehículos ya marcados como `vendido` antes de esta migración quedan con
`sold_at = null`. No se inventan fechas. Consecuencia explícita:

- Siguen apareciendo en el explorador de stock bajo el filtro "Vendidos".
- Quedan **excluidos** del gráfico de ventas, de los KPIs semanales y del
  cálculo de rotación, que filtran por `sold_at is not null`.

`src/lib/types.ts` extiende `Vehiculo`:

```ts
estado: "disponible" | "reservado" | "vendido";
sold_at: string | null;
sale_price: number | null;
sale_notes: string | null;
```

Los vehículos del fallback local (`vehiculos.json`) reciben `sold_at: null`,
`sale_price: null`, `sale_notes: null`.

## 2. Lógica, API y sincronización

### Patrón: SSR + parche en vivo

El render inicial no cambia (first paint y SEO intactos). Un componente cliente
recibe los datos del servidor como estado inicial y los parcha con los eventos
de Realtime.

```
/catalogo (server)  ->  getVehiculosDisponibles()  ->  <CatalogoLive initial={...}>
                                                              |
                                          supabase.channel('vehiculos_posse')
                                            .on('postgres_changes', UPDATE|INSERT|DELETE)
                                                              |
                                                     patch de estado local
```

- `src/lib/supabase-browser.ts`: cliente anon singleton para el navegador.
- El panel se suscribe al mismo canal, así que panel en el celular y panel en la
  PC se sincronizan entre sí.
- Las Server Actions siguen llamando `revalidatePath("/")`, `"/catalogo"` y
  `"/panel"` para quien entre después.
- Si la suscripción falla o el socket se cae, la vista sigue mostrando los datos
  SSR: degradación silenciosa, sin pantalla de error.

### Server Actions — `src/app/panel/actions.ts`

| Acción | Efecto |
| --- | --- |
| `cambiarEstado(id, estado)` | `disponible` ↔ `reservado`; limpia campos de venta |
| `marcarVendido(id, { precio?, nota? })` | `estado='vendido'`, `sold_at=now()`, guarda precio y nota si vinieron |
| `deshacerVenta(id)` | vuelve a `disponible`, limpia `sold_at`, `sale_price`, `sale_notes` |

Todas validan sesión con `requireAdminSession()` antes de escribir, usan
`createAdminSupabaseClient()` y devuelven `{ ok: boolean; error?: string }`.

### Consultas públicas — `src/lib/data.ts`

`getVehiculosDisponibles()` pasa a traer `estado in ('disponible','reservado')`,
ordenando `disponible` primero y después por `created_at desc`. Se mantiene el
nombre de la función para no romper llamadas existentes.

### Métricas — `src/lib/metrics.ts`

Módulo puro, sin acceso a red: recibe `Vehiculo[]` y devuelve los agregados. Se
testea de forma aislada.

```ts
getKpis(vehiculos): {
  stockActivo: number;         // disponible + reservado
  disponibles: number;
  reservados: number;
  vendidosSemana: number;      // semana corriente
  vendidosSemanaPrevia: number;
  deltaSemana: number;         // vendidosSemana - vendidosSemanaPrevia
  rotacionDias: number | null; // promedio de días en stock, ventas últimos 90 d
}

getSerieVentas(vehiculos, rango: "dia" | "semana" | "mes"): Bucket[]
// dia    -> últimos 30 días
// semana -> últimas 12 semanas
// mes    -> últimos 12 meses
```

Reglas de tiempo:

- Zona horaria Argentina, UTC−3 fijo (el país no aplica horario de verano).
  Helper local, sin dependencias de i18n.
- La semana va de lunes a domingo.
- `rotacionDias` = promedio de `sold_at - created_at` sobre las ventas con
  `sold_at` en los últimos 90 días. Si no hay ninguna, devuelve `null` y la UI
  muestra un guion en lugar de un número.

## 3. Estados en el catálogo público

| Estado | Aparece en catálogo | Badge | WhatsApp |
| --- | --- | --- | --- |
| `disponible` | sí | el suyo (`badge`) | activo |
| `reservado` | sí | ámbar "Reservado" | reemplazado por texto "Reservado · consultá por similares" |
| `vendido` | sección Vendidos, grayscale | gris "Vendido" | sin botón |

`VehicleCard` recibe una variante `reservado`: mismo layout, precio visible,
badge ámbar, y en lugar del botón verde un bloque no interactivo. El badge de
reservado tiene prioridad sobre `badge`.

## 4. Configuración PWA para iOS

- `src/app/panel/layout.tsx` exporta `metadata` con `manifest:
  "/panel.webmanifest"`, `appleWebApp: { capable: true, title: "Posse",
  statusBarStyle: "black-translucent" }`, y `viewport` con
  `viewportFit: "cover"`, `themeColor: "#0d0d12"`, `userScalable: false`.
- `public/panel.webmanifest`: `start_url: "/panel"`, `scope: "/panel"`,
  `display: "standalone"`, `background_color` y `theme_color` `#0d0d12`,
  íconos 192 y 512.
- Íconos: el logo viejo (`public/Gemini_Generated_Image_*.png`) mide 2390×1792
  y pesa 9,6 MB — no sirve. Los íconos se generan a partir del logo nuevo con
  `scripts/gen-logo-assets.mjs`, que usa `sharp` (ya presente en
  `node_modules`): recorta la silueta del auto y la centra en dorado `#C9A227`
  sobre `#0d0d12`. Produce `public/icons/icon-{180,192,512}.png` más
  `src/app/icon.png` y `src/app/apple-icon.png`, que Next enlaza solo. Los PNG
  se commitean.
- Todos los contenedores fijos usan `env(safe-area-inset-*)` para el notch y la
  barra inferior del iPhone.
- Sin service worker: en una app de inventario en tiempo real, servir stock
  cacheado es peor que un error de red. Se puede sumar más adelante.

## 5. Interfaz

```
+-----------------------------+
| safe-area top               |
| POSSE · Panel        [ 8 ]  |  header sticky
| +-------+-------+---------+ |
| | Stock |Semana |Rotación | |  3 KPIs
| |   8   | 3 +2  |  22 d   | |
| +-------+-------+---------+ |
| [ Stock ] [ Métricas ]      |  segmented control
+-----------------------------+
| Buscar...                   |
| (Todos)(Disp.)(Res.)(Vend.) |  chips de 1 tap
|                             |
| +-------------------------+ |
| |[img] Amarok V6 2019     | |  fila compacta
| |      USD 32.000         | |
| |      [Disp][Res][Vend]  | |  <- cambio de estado
| +-------------------------+ |
+-----------------------------+
|  Stock    Métricas     +    |  tab bar (thumb zone)
| safe-area bottom            |
+-----------------------------+
```

### Componentes

Cada uno tiene una responsabilidad y se puede leer sin abrir los demás.

| Componente | Responsabilidad | Depende de |
| --- | --- | --- |
| `panel-app.tsx` | estado cliente, suscripción Realtime, tabs, toast | actions, metrics |
| `kpi-header.tsx` | render puro de los 3 KPIs | resultado de `getKpis` |
| `sales-chart.tsx` | barras SVG + selector de rango | resultado de `getSerieVentas` |
| `stock-list.tsx` | buscador, chips de filtro, lista | `Vehiculo[]` + callbacks |
| `vehicle-row.tsx` | render puro de una fila + botones de estado | un `Vehiculo` + callback |
| `sale-sheet.tsx` | hoja inferior de confirmación de venta | callback de submit |

`panel-app.tsx` es el único con estado; el resto recibe props y emite callbacks.

### Interacciones

- Tocar **Vend** abre la hoja inferior: `sold_at` ya está resuelto, precio real y
  nota son opcionales, y un botón grande "Confirmar venta" se puede tocar sin
  llenar nada.
- Al confirmar: la fila se marca como pendiente (atenuada, botones
  deshabilitados) mientras corre la Server Action; el estado real llega por
  Realtime y por la revalidación. No se hace actualización optimista: entre el
  parche optimista, el evento de Realtime y las props nuevas del servidor
  habría tres escritores peleando por la misma fila. Si la acción falla —o
  rechaza, por corte de red o sesión vencida— la fila se libera igual y el
  error se muestra en el toast.
- Toast "Vendido · Deshacer" durante 6 s → `deshacerVenta()`.
- Tocar **Disp**/**Res** cambia el estado directo, sin hoja.
- Gráfico: tap en una barra muestra el valor de ese período.
- Zonas táctiles de 44 px mínimo; toda acción principal en el tercio inferior.

### Estilo

Se reutilizan los tokens existentes de `globals.css`: `car-black #0d0d12`,
`car-gray #141824`, `car-gray2 #1e2434`, `car-gold #C9A227`, `car-white
#EEF2FF`, `car-muted #7a8aaa`. Verde `emerald-400` para disponible y ventas,
ámbar `amber-400` para reservado, dorado para acciones principales. Tipografías
Barlow / Barlow Condensed ya cargadas en el layout raíz.

## 6. Errores

| Caso | Comportamiento |
| --- | --- |
| Server Action falla | rollback del estado optimista + toast rojo con el mensaje |
| Socket de Realtime caído | se conserva la vista SSR, sin cartel de error |
| Sesión expirada | `requireAdminSession()` redirige a `/admin/login` |
| Supabase no configurado | `/panel` muestra un aviso; el público sigue con el fallback local |
| Sin ventas con `sold_at` | gráfico vacío con leyenda "Sin ventas registradas en este período" |

## 7. Pruebas

- `src/lib/metrics.ts` es puro y se prueba con datos fijos: límites de semana
  lunes–domingo, corte de UTC−3, ventas sin `sold_at` excluidas, `rotacionDias`
  `null` cuando no hay datos, buckets vacíos presentes en la serie.
- Verificación manual en el navegador: cambiar un estado en `/panel` y confirmar
  que `/catalogo`, abierto en otra pestaña, se actualiza sin recargar.
- Verificación de la PWA: `/panel.webmanifest` responde 200 y los íconos cargan.

## 8. Archivos

Nuevos:

- `supabase/schema-posse-panel.sql`
- `scripts/gen-panel-icons.mjs`
- `src/lib/metrics.ts`
- `src/lib/supabase-browser.ts`
- `src/app/panel/layout.tsx`, `page.tsx`, `actions.ts`
- `src/components/panel/panel-app.tsx`, `kpi-header.tsx`, `sales-chart.tsx`,
  `stock-list.tsx`, `vehicle-row.tsx`, `sale-sheet.tsx`
- `src/components/catalogo-live.tsx`
- `public/panel.webmanifest`, `public/icons/icon-180.png`, `icon-192.png`,
  `icon-512.png`

Modificados:

- `src/lib/types.ts` — campos de venta y estado `reservado`
- `src/lib/data.ts` — incluir `reservado`, mapear campos nuevos en el fallback
- `src/components/vehicle-card.tsx` — variante reservado
- `src/app/catalogo/page.tsx`, `src/app/page.tsx` — envolver la grilla en
  `CatalogoLive`

`/admin` sí terminó modificándose, contra lo previsto. La revisión final
encontró que el panel viejo escribía el vocabulario de dos estados sobre las
mismas filas y corrompía los datos nuevos: marcar vendido desde `/admin` dejaba
`sold_at` nulo y la venta no aparecía en ninguna métrica; reactivar conservaba
la fecha vieja; y guardar un auto reservado lo des-reservaba solo, porque el
`<select>` no tenía esa opción. Con aprobación explícita del usuario se
corrigió:

- `src/app/admin/vehiculos/actions.ts` — `toggleEstado` delega en las Server
  Actions del panel en vez de duplicar la contabilidad de la venta
- `src/app/admin/vehiculos/form-actions.ts` — valida el estado y mantiene
  coherentes `sold_at`, `sale_price` y `sale_notes`
- `src/app/admin/vehiculos/vehiculo-form.tsx` y `page.tsx` — soportan los tres
  estados
- `src/lib/data.ts` y `src/app/admin/page.tsx` — el dashboard cuenta los
  reservados

## Seguridad de los campos de venta

Las políticas RLS de la tabla son por fila, no por columna, así que la anon key
—que viaja en el bundle público— puede leer `sale_price` y `sale_notes`, y el
canal de Realtime los transmite a cualquier visitante del catálogo. Se cierra
con:

```sql
revoke select (sale_price, sale_notes) on public.vehiculos_posse from anon;
```

El SSR no se ve afectado: `src/lib/data.ts` usa siempre el cliente de
service-role.

## Fuera de alcance

- Service worker y modo offline.
- Notificaciones push.
- Backfill de `sold_at` para ventas históricas.
- Métricas de ingresos por monto (se guarda `sale_price` pero no se grafica).
