# Trazabilidad Reel vs. web en WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada vehículo tiene un flag interno "Promocionado en Reel" tildable desde el panel admin; el texto de los botones de WhatsApp (card del catálogo y ficha de detalle) cambia según ese flag, sin que el flag sea visible en ningún lugar del sitio público.

**Architecture:** Una columna booleana nueva en `vehiculos_posse` (default `false`, sin migrar datos existentes). `buildWhatsAppUrl` en `src/lib/utils.ts` cambia de firma — pasa a recibir el vehículo (nombre/tipo/promocionado_reel) en vez de nombre+año+contexto — y arma un único texto por vehículo, usado igual en ambos botones de WhatsApp. El panel admin gana un checkbox que se lee y persiste igual que `estado`/`badge`.

**Tech Stack:** Next.js 16 (React 19, App Router), Supabase (Postgres + `@supabase/ssr`), Vitest (`environment: "node"`).

## Global Constraints

- La columna nueva se llama `promocionado_reel`, tipo `boolean`, `not null default false`. Se aplica en el SQL Editor de Supabase por el usuario (Task 1, Step 1) — no hay forma de correr SQL crudo desde este entorno con las keys disponibles.
- El campo NO se renderiza en ningún componente del sitio público (`VehicleCard`, `VehicleCardVendido`, la ficha del vehículo) ni en el listado admin — solo existe en el formulario de carga/edición y como input de `buildWhatsAppUrl`.
- Textos exactos (no parafrasear):
  - `promocionado_reel === true`: `Hola, vi el Reel de {artículo} {nombre} {emoji_vehículo}🎥 y entré a la web. ¡Quiero más info!`
  - `promocionado_reel === false`: `Hola, vengo desde el catálogo web 💻. Me interesa {artículo} {nombre} {emoji_vehículo}. ¿Sigue disponible?`
  - `{artículo}` = `"la"` si `tipo === "Moto"`, sino `"el"`.
  - `{emoji_vehículo}` = `"🏍️"` si `tipo === "Moto"`, sino `"🚗"`.
- El mismo texto se usa en el botón de la card del catálogo y en el de la ficha de detalle — ya no hay distinción por `context`.
- No se toca `FloatingWhatsApp` (mensaje genérico fijo, no recibe un vehículo).
- Idioma de toda copy visible al usuario: español.

---

### Task 1: Columna en la base de datos + tipo `Vehiculo`

**Files:**
- Modify: `supabase/schema-posse.sql` (documentar la columna nueva)
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: campo `promocionado_reel: boolean` en el tipo `Vehiculo` (`src/lib/types.ts`), consumido por Task 2 y Task 3.

- [ ] **Step 1: Aplicar el ALTER TABLE (manual, lo corre el usuario)**

Pedirle al usuario que entre al **SQL Editor** de su proyecto Supabase y corra:

```sql
alter table public.vehiculos_posse
  add column promocionado_reel boolean not null default false;
```

Esperar confirmación explícita del usuario de que lo corrió antes de seguir con Task 3 (Task 3 hace `insert`/`update` contra esa columna — si no existe todavía, esas operaciones van a fallar con un error de Postgres). Task 1 y Task 2 no dependen de que la columna ya exista en la base (son cambios de tipos/frontend puro), así que se pueden implementar en paralelo con este paso manual, pero Task 3 no se prueba de punta a punta hasta que la columna exista.

- [ ] **Step 2: Documentar la columna en el schema versionado**

En `supabase/schema-posse.sql`, la tabla `vehiculos_posse` ya tiene desvíos conocidos respecto de la base real (por ejemplo el check constraint de `estado` en este archivo solo lista `'disponible'`/`'vendido'`, pero la base real y el código ya soportan `'reservado'` también — este archivo es documentación de referencia, no la fuente de verdad ejecutable). Igual, mantenelo al día: agregar la columna al `create table` para que alguien leyendo el archivo no se sorprenda.

Reemplazar esta línea:

```sql
  badge text,
```

por:

```sql
  badge text,
  promocionado_reel boolean not null default false,
```

- [ ] **Step 3: Agregar el campo al tipo `Vehiculo`**

En `src/lib/types.ts`, reemplazar:

```ts
  badge: string | null;
```

por:

```ts
  badge: string | null;
  promocionado_reel: boolean;
```

- [ ] **Step 4: Verificar que compila**

```bash
npm run build
```

Expected: falla con errores de TypeScript en los lugares que construyen un objeto `Vehiculo` a mano sin el campo nuevo (por ejemplo `construirVehiculoDeVistaPrevia` en `src/app/admin/vehiculos/vehiculo-form.tsx`). Esto es esperado en este punto — Task 3 lo arregla. Anotar en el reporte cuáles son esos errores para que Task 3 los tenga en cuenta, pero no arreglarlos en esta Task.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema-posse.sql src/lib/types.ts
git commit -m "$(cat <<'EOF'
feat: agregar campo promocionado_reel al tipo Vehiculo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `buildWhatsAppUrl` con el mensaje condicional (TDD) + actualizar los dos consumidores

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `src/lib/utils.test.ts`
- Modify: `src/components/vehicle-card.tsx:56`
- Modify: `src/app/vehiculos/[slug]/page.tsx:37`

**Interfaces:**
- Consumes: `Vehiculo` type de `src/lib/types.ts` (Task 1), específicamente los campos `nombre`, `tipo`, `promocionado_reel`.
- Produces: `buildWhatsAppUrl(vehiculo: Pick<Vehiculo, "nombre" | "tipo" | "promocionado_reel">): string`, exportada desde `src/lib/utils.ts`. Firma nueva — reemplaza por completo a la anterior `buildWhatsAppUrl(nombre, anio, context)`. No queda ningún llamador con la firma vieja tras esta Task.

Este Task deja el build pasando (a diferencia de Task 1 solo, que lo rompe a propósito) porque actualiza también los dos únicos consumidores existentes.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "./utils";

describe("buildWhatsAppUrl", () => {
  it("arma el mensaje de catalogo web para un auto (no reel, no moto)", () => {
    const url = buildWhatsAppUrl({
      nombre: "Ford Mondeo Titanium 2.0",
      tipo: "Sedán",
      promocionado_reel: false,
    });
    const texto = decodeURIComponent(url.split("text=")[1]);
    expect(texto).toBe(
      "Hola, vengo desde el catálogo web 💻. Me interesa el Ford Mondeo Titanium 2.0 🚗. ¿Sigue disponible?"
    );
  });

  it("arma el mensaje de reel para una moto", () => {
    const url = buildWhatsAppUrl({
      nombre: "Honda XR 250",
      tipo: "Moto",
      promocionado_reel: true,
    });
    const texto = decodeURIComponent(url.split("text=")[1]);
    expect(texto).toBe(
      "Hola, vi el Reel de la Honda XR 250 🏍️🎥 y entré a la web. ¡Quiero más info!"
    );
  });

  it("usa articulo y emoji de auto cuando el tipo no es Moto (incluido null)", () => {
    const url = buildWhatsAppUrl({
      nombre: "Chevrolet Agile 1.4 LS",
      tipo: null,
      promocionado_reel: true,
    });
    const texto = decodeURIComponent(url.split("text=")[1]);
    expect(texto).toBe(
      "Hola, vi el Reel de el Chevrolet Agile 1.4 LS 🚗🎥 y entré a la web. ¡Quiero más info!"
    );
  });

  it("apunta siempre al mismo numero de WhatsApp", () => {
    const url = buildWhatsAppUrl({ nombre: "X", tipo: null, promocionado_reel: false });
    expect(url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

```bash
npx vitest run src/lib/utils.test.ts
```

Expected: FAIL — `buildWhatsAppUrl` todavía tiene la firma vieja `(nombre, anio, context)`, así que `vehiculo.tipo`/`vehiculo.promocionado_reel` no existen en esa función y los textos no van a coincidir (o falla de tipos si TypeScript corre antes; en Vitest sobre `.ts` sin type-check estricto en runtime, el test corre pero falla el `expect` porque el texto armado con la lógica vieja no matchea).

- [ ] **Step 3: Reemplazar `buildWhatsAppUrl`**

En `src/lib/utils.ts`, agregar el import al principio del archivo:

```ts
import type { Vehiculo } from "@/lib/types";
```

Reemplazar toda la función actual:

```ts
export function buildWhatsAppUrl(nombre: string, anio: number, context: "card" | "ficha" = "card"): string {
  const base = "https://wa.me/5493537662444?text=";
  const msg =
    context === "ficha"
      ? `Hola, me interesa el ${nombre} ${anio}, ¿está disponible?`
      : `Hola, quiero consultar el ${nombre} ${anio}`;
  return base + encodeURIComponent(msg);
}
```

por:

```ts
export function buildWhatsAppUrl(
  vehiculo: Pick<Vehiculo, "nombre" | "tipo" | "promocionado_reel">
): string {
  const base = "https://wa.me/5493537662444?text=";
  const esMoto = vehiculo.tipo === "Moto";
  const articulo = esMoto ? "la" : "el";
  const emoji = esMoto ? "🏍️" : "🚗";
  const msg = vehiculo.promocionado_reel
    ? `Hola, vi el Reel de ${articulo} ${vehiculo.nombre} ${emoji}🎥 y entré a la web. ¡Quiero más info!`
    : `Hola, vengo desde el catálogo web 💻. Me interesa ${articulo} ${vehiculo.nombre} ${emoji}. ¿Sigue disponible?`;
  return base + encodeURIComponent(msg);
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

```bash
npx vitest run src/lib/utils.test.ts
```

Expected: PASS — 4 tests en verde.

- [ ] **Step 5: Actualizar el consumidor en `vehicle-card.tsx`**

En `src/components/vehicle-card.tsx`, reemplazar la línea 56:

```tsx
            href={buildWhatsAppUrl(vehiculo.nombre, vehiculo.anio, "card")}
```

por:

```tsx
            href={buildWhatsAppUrl(vehiculo)}
```

- [ ] **Step 6: Actualizar el consumidor en la ficha de detalle**

En `src/app/vehiculos/[slug]/page.tsx`, reemplazar la línea 37:

```tsx
  const whatsappUrl = buildWhatsAppUrl(v.nombre, v.anio, "ficha");
```

por:

```tsx
  const whatsappUrl = buildWhatsAppUrl(v);
```

- [ ] **Step 7: Correr toda la suite y verificar el build**

```bash
npx vitest run
npm run build
```

Expected: `npx vitest run` en verde (incluye los 4 tests nuevos). `npm run build` **sigue fallando** en este punto — el error de tipos que Task 1 Step 4 dejó pendiente (`construirVehiculoDeVistaPrevia` en `vehiculo-form.tsx` no arma el campo `promocionado_reel`) todavía no se resolvió; eso es trabajo de Task 3. Confirmar en el reporte que el único error de build restante es ese, no uno nuevo introducido por esta Task.

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts src/components/vehicle-card.tsx "src/app/vehiculos/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat: mensaje de WhatsApp condicional segun Reel vs web

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Checkbox en el panel admin + persistencia

**Files:**
- Modify: `src/app/admin/vehiculos/vehiculo-form.tsx`
- Modify: `src/app/admin/vehiculos/form-actions.ts`

**Interfaces:**
- Consumes: `Vehiculo.promocionado_reel` (Task 1), `buildWhatsAppUrl` sin cambios directos en este archivo (no se usa acá, pero `construirVehiculoDeVistaPrevia` arma un objeto `Vehiculo` completo y necesita el campo para que el tipo compile).

Esta Task es la que efectivamente arregla el error de build que quedó pendiente desde Task 1.

- [ ] **Step 1: Agregar el checkbox al formulario**

En `src/app/admin/vehiculos/vehiculo-form.tsx`, dentro de la sección "Precio y estado" (el `<div className="grid gap-3 sm:grid-cols-3">` que contiene Precio/Estado/Badge), agregar un cuarto campo. Reemplazar:

```tsx
          <div>
            <label className={labelClass}>Badge</label>
            <select name="badge" defaultValue={vehiculo?.badge ?? ""} className={inputClass}>
              <option value="">— Sin badge —</option>
              <option value="Nuevo ingreso">Nuevo ingreso</option>
              <option value="Destacado">Destacado</option>
              <option value="Usado">Usado</option>
            </select>
          </div>
        </div>
      </div>
```

por:

```tsx
          <div>
            <label className={labelClass}>Badge</label>
            <select name="badge" defaultValue={vehiculo?.badge ?? ""} className={inputClass}>
              <option value="">— Sin badge —</option>
              <option value="Nuevo ingreso">Nuevo ingreso</option>
              <option value="Destacado">Destacado</option>
              <option value="Usado">Usado</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-car-white">
          <input
            type="checkbox"
            name="promocionado_reel"
            defaultChecked={vehiculo?.promocionado_reel ?? false}
            className="size-4 rounded border-white/20 bg-car-gray2 accent-car-gold"
          />
          🎥 Promocionado en Reel
        </label>
      </div>
```

- [ ] **Step 2: Incluir el campo en la vista previa de la card**

En `src/app/admin/vehiculos/vehiculo-form.tsx`, dentro de `construirVehiculoDeVistaPrevia()`, agregar el campo que faltaba (esto es lo que hace que `npm run build` deje de fallar). Reemplazar:

```tsx
      badge: (datos.get("badge") as string) || null,
      created_at: "",
```

por:

```tsx
      badge: (datos.get("badge") as string) || null,
      promocionado_reel: datos.get("promocionado_reel") === "on",
      created_at: "",
```

- [ ] **Step 3: Persistir el campo en `createVehiculo`**

En `src/app/admin/vehiculos/form-actions.ts`, dentro de `createVehiculo`, reemplazar:

```ts
    ...camposDeVenta(estado, null),
    badge: (formData.get("badge") as string) || null,
  });
```

por:

```ts
    ...camposDeVenta(estado, null),
    badge: (formData.get("badge") as string) || null,
    promocionado_reel: formData.get("promocionado_reel") === "on",
  });
```

- [ ] **Step 4: Persistir el campo en `updateVehiculo`**

En el mismo archivo, dentro de `updateVehiculo`, reemplazar:

```ts
      ...camposDeVenta(estado, filaActual?.sold_at ?? null),
      badge: (formData.get("badge") as string) || null,
    })
    .eq("id", id);
```

por:

```ts
      ...camposDeVenta(estado, filaActual?.sold_at ?? null),
      badge: (formData.get("badge") as string) || null,
      promocionado_reel: formData.get("promocionado_reel") === "on",
    })
    .eq("id", id);
```

Nota sobre checkboxes HTML: un `<input type="checkbox">` desmarcado **no aparece** en el `FormData` al hacer submit. Por eso `formData.get("promocionado_reel") === "on"` da `false` tanto si el campo nunca se marcó como si se desmarcó — es exactamente el comportamiento que se necesita, sin lógica adicional.

- [ ] **Step 5: Verificar el build**

```bash
npm run build
```

Expected: build sin errores de TypeScript. Este es el punto donde el error pendiente desde Task 1 Step 4 debe haber desaparecido.

- [ ] **Step 6: Correr toda la suite**

```bash
npx vitest run
```

Expected: todos los tests en verde (los mismos de antes, esta Task no agrega tests automatizados nuevos — es formulario/Server Action sin lógica pura nueva para testear; el campo booleano se verifica manualmente en el navegador en el siguiente paso).

- [ ] **Step 7: Verificar en el navegador (requiere que la columna ya exista en la base — confirmar con el usuario que corrió el SQL de Task 1 Step 1 antes de este paso)**

Con el dev server corriendo:
1. Ir a `/admin/vehiculos/nuevo`, completar los campos obligatorios (nombre, marca, modelo, año, combustible, transmisión), tildar "🎥 Promocionado en Reel", y guardar.
2. Abrir la ficha pública de ese vehículo (`/vehiculos/<slug>`) y click en "Consultar por WhatsApp": confirmar que el texto prearmado en la ventana de WhatsApp que se abre es el de Reel (con 🎥), y que el emoji del vehículo (🚗 o 🏍️) coincide con el tipo elegido.
3. Confirmar visualmente que el checkbox **no aparece** en ningún lado del sitio público (card del catálogo, ficha, listado admin) — solo en el formulario de carga/edición.
4. Editar el mismo vehículo, destildar "Promocionado en Reel", guardar. Repetir el paso 2: el texto ahora debe ser el de "catálogo web 💻".
5. Repetir con un vehículo de `tipo = "Moto"` para confirmar el artículo "la" y el emoji 🏍️.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/vehiculos/vehiculo-form.tsx src/app/admin/vehiculos/form-actions.ts
git commit -m "$(cat <<'EOF'
feat: checkbox de Promocionado en Reel en el panel admin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
