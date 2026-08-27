# Panel Móvil PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `/panel`, una PWA mobile-first donde el dueño de Posse Automotores cambia el estado de un vehículo en 1 tap (registrando fecha y hora de venta) y ve métricas semanales, con el catálogo público sincronizado en vivo.

**Architecture:** Migración SQL que agrega el estado `reservado` y los campos de venta. Un módulo puro `metrics.ts` calcula KPIs y series temporales sobre `Vehiculo[]`. Un hook `useVehiculosRealtime` toma la lista renderizada por el servidor y la parcha con eventos de Supabase Realtime; lo consumen tanto el catálogo público como el panel. Server Actions escriben los cambios de estado y revalidan las rutas.

**Tech Stack:** Next.js 16.2.9 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind CSS 4, `@supabase/supabase-js` 2.110 + `@supabase/ssr` 0.12, lucide-react, vitest (se agrega en la Tarea 1).

Spec de referencia: `docs/superpowers/specs/2026-08-27-panel-movil-posse-design.md`

## Global Constraints

- **Sin dependencias nuevas de runtime.** La única dependencia que se agrega es `vitest`, y va en `devDependencies`. Los gráficos se dibujan en SVG a mano.
- **Sin service worker.** No crear `sw.js` ni registrar nada con `navigator.serviceWorker`.
- **`/admin` no se toca.** Ni sus páginas, ni `src/app/admin/vehiculos/actions.ts`, ni `admin-shell.tsx`. La única excepción es `src/middleware.ts`, que debe además proteger `/panel`.
- **Colores exactos:** `car-black #0d0d12`, `car-gray #141824`, `car-gray2 #1e2434`, `car-gold #C9A227`, `car-gold-dark #a8881f`, `car-white #EEF2FF`, `car-muted #7a8aaa`. Disponible y ventas en `emerald-400`, reservado en `amber-400`. Estas clases ya existen en `src/app/globals.css`; no agregar tokens nuevos.
- **Nombre de la tabla:** `vehiculos_posse` (no `vehiculos`, que pertenece a otro sitio del mismo proyecto Supabase).
- **Zona horaria:** Argentina, UTC−3 fijo. Nada de `Intl` ni de librerías de fechas.
- **Semana:** lunes a domingo.
- **Idioma de la UI:** español rioplatense (voseo), igual que el resto del sitio.
- **Toque mínimo:** todo control interactivo del panel mide al menos 44 px de alto.
- **Los íconos PWA ya existen** en `public/icons/icon-180.png`, `icon-192.png`, `icon-512.png`, generados por `scripts/gen-logo-assets.mjs`. No hay que regenerarlos.

---

### Task 1: Migración SQL, tipos y consultas

Agrega el estado `reservado` y los campos de venta a la base, al tipo `Vehiculo` y a las consultas públicas.

**Files:**
- Create: `supabase/schema-posse-panel.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: el tipo `Vehiculo` con `estado: "disponible" | "reservado" | "vendido"`, `sold_at: string | null`, `sale_price: number | null`, `sale_notes: string | null`. `getVehiculosDisponibles(): Promise<Vehiculo[]>` pasa a incluir los reservados.

- [ ] **Step 1: Escribir la migración SQL**

Crear `supabase/schema-posse-panel.sql`:

```sql
-- Panel móvil: estado "reservado" + registro de venta.
-- Correr en el SQL Editor de Supabase sobre el proyecto de Posse.

alter table public.vehiculos_posse drop constraint if exists vehiculos_posse_estado_check;
alter table public.vehiculos_posse add constraint vehiculos_posse_estado_check
  check (estado in ('disponible', 'reservado', 'vendido'));

alter table public.vehiculos_posse
  add column if not exists sold_at    timestamptz,
  add column if not exists sale_price numeric(12,2),
  add column if not exists sale_notes text;

create index if not exists vehiculos_posse_sold_at_idx
  on public.vehiculos_posse (sold_at desc);

-- Habilita que el navegador reciba los cambios de esta tabla en vivo.
-- Las politicas RLS existentes ya permiten el select publico, no hacen falta nuevas.
alter publication supabase_realtime add table public.vehiculos_posse;
```

- [ ] **Step 2: Correr la migración**

Abrir el SQL Editor del proyecto Supabase de Posse, pegar el contenido del archivo y ejecutarlo.

Esperado: `Success. No rows returned`. Si `alter publication` falla con `relation "vehiculos_posse" is already member of publication`, está bien: significa que ya estaba habilitada. Cualquier otro error hay que resolverlo antes de seguir.

Verificar que las columnas existen:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'vehiculos_posse' and column_name in ('sold_at','sale_price','sale_notes');
```

Esperado: 3 filas — `sold_at timestamp with time zone`, `sale_price numeric`, `sale_notes text`.

- [ ] **Step 3: Extender el tipo `Vehiculo`**

En `src/lib/types.ts`, reemplazar la línea `estado: "disponible" | "vendido";` y agregar los campos nuevos, de modo que el tipo quede así:

```ts
export type EstadoVehiculo = "disponible" | "reservado" | "vendido";

export type Vehiculo = {
  id: string;
  slug: string;
  nombre: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje: string;
  combustible: string;
  transmision: string;
  motor: string | null;
  tipo: string | null;
  descripcion: string | null;
  precio_texto: string;
  cover_image_url: string | null;
  imagenes: string[];
  videos: string[];
  estado: EstadoVehiculo;
  badge: string | null;
  created_at: string;
  deleted_at: string | null;
  sold_at: string | null;
  sale_price: number | null;
  sale_notes: string | null;
};
```

- [ ] **Step 4: Mapear los campos nuevos en el fallback local**

`src/lib/data.ts` construye `localVehiculos` a partir de `vehiculos.json` cuando Supabase no responde. En el objeto que devuelve el `.map()`, después de la línea `deleted_at: null,`, agregar:

```ts
    sold_at: null,
    sale_price: null,
    sale_notes: null,
```

- [ ] **Step 5: Incluir los reservados en las consultas públicas**

En `src/lib/data.ts`, en `getVehiculosDisponibles()`, reemplazar `.eq("estado", "disponible")` por `.in("estado", ["disponible", "reservado"])`, y reemplazar el `.order("created_at", { ascending: false })` de esa función por dos órdenes, para que los disponibles queden primero:

```ts
      .order("estado", { ascending: true })
      .order("created_at", { ascending: false });
```

(`disponible` < `reservado` alfabéticamente, así que el orden ascendente pone los disponibles arriba.)

En el fallback de esa misma función, reemplazar
`localVehiculos.filter((v) => v.estado === "disponible")` por:

```ts
localVehiculos.filter((v) => v.estado !== "vendido")
```

En `getVehiculoBySlug()`, reemplazar `.eq("estado", "disponible")` por:

```ts
      .in("estado", ["disponible", "reservado"])
```

Sin este cambio la ficha de un auto reservado devolvería 404.

- [ ] **Step 6: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema-posse-panel.sql src/lib/types.ts src/lib/data.ts
git commit -m "feat: agregar estado reservado y campos de venta al modelo de vehiculos"
```

---

### Task 2: Módulo de métricas + setup de tests

Módulo puro que calcula KPIs y series de ventas. Sin red, sin React: se testea con datos fijos.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/metrics.ts`
- Test: `src/lib/metrics.test.ts`

**Interfaces:**
- Consumes: el tipo `Vehiculo` de la Tarea 1.
- Produces:
  - `toArDay(iso: string): Date`
  - `startOfArWeek(iso: string): Date`
  - `getKpis(vehiculos: Vehiculo[], ahora?: string): Kpis`
  - `getSerieVentas(vehiculos: Vehiculo[], rango: Rango, ahora?: string): Bucket[]`
  - `type Rango = "dia" | "semana" | "mes"`
  - `type Bucket = { key: string; label: string; total: number }`
  - `type Kpis = { stockActivo, disponibles, reservados, vendidosSemana, vendidosSemanaPrevia, deltaSemana, rotacionDias }` — todos `number` salvo `rotacionDias: number | null`.

- [ ] **Step 1: Instalar vitest**

```bash
npm install --save-dev vitest
```

Agregar el script de test en `package.json`, dentro de `"scripts"`, después de `"lint": "eslint"`:

```json
    "test": "vitest run"
```

(No olvidar la coma después de `"lint": "eslint"`.)

- [ ] **Step 2: Configurar vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Escribir los tests que fallan**

Crear `src/lib/metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Vehiculo } from "./types";
import { getKpis, getSerieVentas, startOfArWeek, toArDay } from "./metrics";

/** Vehículo mínimo: solo importan estado, created_at y sold_at. */
function v(parcial: Partial<Vehiculo>): Vehiculo {
  return {
    id: "id", slug: "slug", nombre: "Auto", marca: "Marca", modelo: "Modelo",
    anio: 2020, kilometraje: "0 km", combustible: "Nafta", transmision: "Manual",
    motor: null, tipo: null, descripcion: null, precio_texto: "Consultar",
    cover_image_url: null, imagenes: [], videos: [], estado: "disponible",
    badge: null, created_at: "2026-01-01T12:00:00Z", deleted_at: null,
    sold_at: null, sale_price: null, sale_notes: null,
    ...parcial,
  };
}

describe("toArDay", () => {
  it("mapea un instante al dia calendario argentino", () => {
    expect(toArDay("2026-08-27T15:00:00Z").toISOString()).toBe("2026-08-27T00:00:00.000Z");
  });

  it("antes de las 03:00 UTC todavia es el dia anterior en Argentina", () => {
    expect(toArDay("2026-08-27T02:30:00Z").toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });
});

describe("startOfArWeek", () => {
  it("devuelve el lunes de esa semana", () => {
    // 2026-08-27 es jueves; el lunes es el 24.
    expect(startOfArWeek("2026-08-27T15:00:00Z").toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("un lunes se devuelve a si mismo", () => {
    expect(startOfArWeek("2026-08-24T15:00:00Z").toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("el domingo cierra la semana que arranco el lunes anterior", () => {
    expect(startOfArWeek("2026-08-30T15:00:00Z").toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });
});

describe("getKpis", () => {
  const ahora = "2026-08-27T15:00:00Z"; // jueves

  it("cuenta el stock activo como disponibles mas reservados", () => {
    const k = getKpis([
      v({ estado: "disponible" }),
      v({ estado: "disponible" }),
      v({ estado: "reservado" }),
      v({ estado: "vendido", sold_at: ahora }),
    ], ahora);
    expect(k.stockActivo).toBe(3);
    expect(k.disponibles).toBe(2);
    expect(k.reservados).toBe(1);
  });

  it("compara la semana corriente contra la anterior", () => {
    const k = getKpis([
      v({ estado: "vendido", sold_at: "2026-08-25T14:00:00Z" }), // esta semana
      v({ estado: "vendido", sold_at: "2026-08-27T14:00:00Z" }), // esta semana
      v({ estado: "vendido", sold_at: "2026-08-19T14:00:00Z" }), // semana previa
    ], ahora);
    expect(k.vendidosSemana).toBe(2);
    expect(k.vendidosSemanaPrevia).toBe(1);
    expect(k.deltaSemana).toBe(1);
  });

  it("ignora los vendidos sin sold_at", () => {
    const k = getKpis([
      v({ estado: "vendido", sold_at: null }),
      v({ estado: "vendido", sold_at: "2026-08-25T14:00:00Z" }),
    ], ahora);
    expect(k.vendidosSemana).toBe(1);
  });

  it("promedia los dias en stock de las ventas de los ultimos 90 dias", () => {
    const k = getKpis([
      v({ estado: "vendido", created_at: "2026-08-05T12:00:00Z", sold_at: "2026-08-15T12:00:00Z" }), // 10 d
      v({ estado: "vendido", created_at: "2026-08-05T12:00:00Z", sold_at: "2026-08-25T12:00:00Z" }), // 20 d
    ], ahora);
    expect(k.rotacionDias).toBe(15);
  });

  it("excluye del promedio las ventas de hace mas de 90 dias", () => {
    const k = getKpis([
      v({ estado: "vendido", created_at: "2026-01-01T12:00:00Z", sold_at: "2026-02-01T12:00:00Z" }),
      v({ estado: "vendido", created_at: "2026-08-05T12:00:00Z", sold_at: "2026-08-15T12:00:00Z" }),
    ], ahora);
    expect(k.rotacionDias).toBe(10);
  });

  it("devuelve null cuando no hay ninguna venta con fecha", () => {
    const k = getKpis([v({ estado: "disponible" })], ahora);
    expect(k.rotacionDias).toBeNull();
  });
});

describe("getSerieVentas", () => {
  const ahora = "2026-08-27T15:00:00Z";

  it("devuelve 30 buckets diarios, incluidos los vacios", () => {
    const s = getSerieVentas([], "dia", ahora);
    expect(s).toHaveLength(30);
    expect(s.every((b) => b.total === 0)).toBe(true);
    expect(s[29].key).toBe("2026-08-27");
  });

  it("agrupa las ventas en el dia argentino correcto", () => {
    const s = getSerieVentas([
      v({ estado: "vendido", sold_at: "2026-08-27T15:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-08-27T16:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-08-27T02:00:00Z" }), // todavia es el 26 en Argentina
    ], "dia", ahora);
    expect(s.find((b) => b.key === "2026-08-27")?.total).toBe(2);
    expect(s.find((b) => b.key === "2026-08-26")?.total).toBe(1);
  });

  it("devuelve 12 buckets semanales indexados por lunes", () => {
    const s = getSerieVentas([
      v({ estado: "vendido", sold_at: "2026-08-25T14:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-08-27T14:00:00Z" }),
    ], "semana", ahora);
    expect(s).toHaveLength(12);
    expect(s[11].key).toBe("2026-08-24");
    expect(s[11].total).toBe(2);
  });

  it("devuelve 12 buckets mensuales con etiqueta corta", () => {
    const s = getSerieVentas([
      v({ estado: "vendido", sold_at: "2026-08-10T14:00:00Z" }),
      v({ estado: "vendido", sold_at: "2026-07-10T14:00:00Z" }),
    ], "mes", ahora);
    expect(s).toHaveLength(12);
    expect(s[11].key).toBe("2026-08");
    expect(s[11].label).toBe("ago");
    expect(s[11].total).toBe(1);
    expect(s[10].total).toBe(1);
  });

  it("ignora los vendidos sin sold_at", () => {
    const s = getSerieVentas([v({ estado: "vendido", sold_at: null })], "dia", ahora);
    expect(s.every((b) => b.total === 0)).toBe(true);
  });
});
```

- [ ] **Step 4: Correr los tests para verificar que fallan**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./metrics"`.

- [ ] **Step 5: Implementar `metrics.ts`**

Crear `src/lib/metrics.ts`:

```ts
import type { Vehiculo } from "./types";

/** Argentina no aplica horario de verano: el offset es fijo. */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type Rango = "dia" | "semana" | "mes";
export type Bucket = { key: string; label: string; total: number };

export type Kpis = {
  stockActivo: number;
  disponibles: number;
  reservados: number;
  vendidosSemana: number;
  vendidosSemanaPrevia: number;
  deltaSemana: number;
  rotacionDias: number | null;
};

/** El día calendario argentino de un instante, como Date UTC a medianoche. */
export function toArDay(iso: string): Date {
  const local = new Date(new Date(iso).getTime() - AR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** El lunes de la semana argentina que contiene ese instante. */
export function startOfArWeek(iso: string): Date {
  const dia = toArDay(iso);
  const desdeLunes = (dia.getUTCDay() + 6) % 7;
  return new Date(dia.getTime() - desdeLunes * DIA_MS);
}

function claveDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function claveMes(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Vendidos con fecha registrada. Los vendidos históricos sin sold_at quedan fuera. */
function ventasConFecha(vehiculos: Vehiculo[]): Vehiculo[] {
  return vehiculos.filter((v) => v.estado === "vendido" && v.sold_at !== null);
}

export function getKpis(vehiculos: Vehiculo[], ahora: string = new Date().toISOString()): Kpis {
  const disponibles = vehiculos.filter((v) => v.estado === "disponible").length;
  const reservados = vehiculos.filter((v) => v.estado === "reservado").length;

  const ventas = ventasConFecha(vehiculos);
  const semanaActual = startOfArWeek(ahora).getTime();
  const semanaPrevia = semanaActual - 7 * DIA_MS;

  const vendidosSemana = ventas.filter(
    (v) => startOfArWeek(v.sold_at!).getTime() === semanaActual
  ).length;
  const vendidosSemanaPrevia = ventas.filter(
    (v) => startOfArWeek(v.sold_at!).getTime() === semanaPrevia
  ).length;

  const corte = new Date(ahora).getTime() - 90 * DIA_MS;
  const recientes = ventas.filter((v) => new Date(v.sold_at!).getTime() >= corte);
  const rotacionDias = recientes.length
    ? Math.round(
        recientes.reduce(
          (suma, v) =>
            suma + (new Date(v.sold_at!).getTime() - new Date(v.created_at).getTime()) / DIA_MS,
          0
        ) / recientes.length
      )
    : null;

  return {
    stockActivo: disponibles + reservados,
    disponibles,
    reservados,
    vendidosSemana,
    vendidosSemanaPrevia,
    deltaSemana: vendidosSemana - vendidosSemanaPrevia,
    rotacionDias,
  };
}

/** Los buckets del período, del más viejo al más nuevo, incluidos los vacíos. */
function construirBuckets(rango: Rango, ahora: string): Bucket[] {
  if (rango === "dia") {
    const hoy = toArDay(ahora);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(hoy.getTime() - (29 - i) * DIA_MS);
      return { key: claveDia(d), label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, total: 0 };
    });
  }

  if (rango === "semana") {
    const lunes = startOfArWeek(ahora);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(lunes.getTime() - (11 - i) * 7 * DIA_MS);
      return { key: claveDia(d), label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, total: 0 };
    });
  }

  const hoy = toArDay(ahora);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (11 - i), 1));
    return { key: claveMes(d), label: MESES[d.getUTCMonth()], total: 0 };
  });
}

/** La clave de bucket que le corresponde a una venta. */
function claveDeVenta(soldAt: string, rango: Rango): string {
  if (rango === "dia") return claveDia(toArDay(soldAt));
  if (rango === "semana") return claveDia(startOfArWeek(soldAt));
  return claveMes(toArDay(soldAt));
}

export function getSerieVentas(
  vehiculos: Vehiculo[],
  rango: Rango,
  ahora: string = new Date().toISOString()
): Bucket[] {
  const buckets = construirBuckets(rango, ahora);
  const porClave = new Map(buckets.map((b) => [b.key, b]));

  for (const venta of ventasConFecha(vehiculos)) {
    const bucket = porClave.get(claveDeVenta(venta.sold_at!, rango));
    if (bucket) bucket.total += 1;
  }

  return buckets;
}
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `npm test`
Expected: PASS — 16 tests passed en `src/lib/metrics.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/metrics.ts src/lib/metrics.test.ts
git commit -m "feat: modulo puro de metricas de stock y ventas, con tests"
```

---

### Task 3: Parche de Realtime (módulo puro + hook)

La función que aplica un evento de Postgres a una lista de vehículos es pura y se testea sola. El hook la envuelve en una suscripción.

**Files:**
- Create: `src/lib/realtime-patch.ts`
- Test: `src/lib/realtime-patch.test.ts`
- Create: `src/lib/supabase-browser.ts`
- Create: `src/lib/use-vehiculos-realtime.ts`

**Interfaces:**
- Consumes: el tipo `Vehiculo` de la Tarea 1.
- Produces:
  - `aplicarCambio(lista: Vehiculo[], cambio: CambioRealtime): Vehiculo[]`
  - `type CambioRealtime = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Vehiculo | null; old: { id?: string } | null }`
  - `getBrowserSupabase(): SupabaseClient | null`
  - `useVehiculosRealtime(inicial: Vehiculo[]): Vehiculo[]`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/realtime-patch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Vehiculo } from "./types";
import { aplicarCambio } from "./realtime-patch";

function v(id: string, parcial: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id, slug: `slug-${id}`, nombre: `Auto ${id}`, marca: "Marca", modelo: "Modelo",
    anio: 2020, kilometraje: "0 km", combustible: "Nafta", transmision: "Manual",
    motor: null, tipo: null, descripcion: null, precio_texto: "Consultar",
    cover_image_url: null, imagenes: [], videos: [], estado: "disponible",
    badge: null, created_at: "2026-01-01T12:00:00Z", deleted_at: null,
    sold_at: null, sale_price: null, sale_notes: null,
    ...parcial,
  };
}

describe("aplicarCambio", () => {
  it("reemplaza en el lugar el vehiculo actualizado", () => {
    const lista = [v("a"), v("b")];
    const r = aplicarCambio(lista, {
      eventType: "UPDATE",
      new: v("a", { estado: "vendido", sold_at: "2026-08-27T15:00:00Z" }),
      old: { id: "a" },
    });
    expect(r).toHaveLength(2);
    expect(r[0].estado).toBe("vendido");
    expect(r[1].id).toBe("b");
  });

  it("no muta la lista original", () => {
    const lista = [v("a")];
    aplicarCambio(lista, { eventType: "UPDATE", new: v("a", { estado: "vendido" }), old: { id: "a" } });
    expect(lista[0].estado).toBe("disponible");
  });

  it("agrega adelante un vehiculo nuevo", () => {
    const r = aplicarCambio([v("a")], { eventType: "INSERT", new: v("b"), old: null });
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("no duplica un INSERT que ya esta en la lista", () => {
    const r = aplicarCambio([v("a")], { eventType: "INSERT", new: v("a"), old: null });
    expect(r).toHaveLength(1);
  });

  it("saca el vehiculo borrado", () => {
    const r = aplicarCambio([v("a"), v("b")], { eventType: "DELETE", new: null, old: { id: "a" } });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("trata el borrado logico como una baja", () => {
    const r = aplicarCambio([v("a"), v("b")], {
      eventType: "UPDATE",
      new: v("a", { deleted_at: "2026-08-27T15:00:00Z" }),
      old: { id: "a" },
    });
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("agrega adelante un UPDATE de un vehiculo que no estaba en la lista", () => {
    const r = aplicarCambio([v("a")], { eventType: "UPDATE", new: v("b"), old: { id: "b" } });
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("devuelve la lista igual si el evento no trae datos utilizables", () => {
    const lista = [v("a")];
    expect(aplicarCambio(lista, { eventType: "UPDATE", new: null, old: null })).toBe(lista);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./realtime-patch"`.

- [ ] **Step 3: Implementar el módulo puro**

Crear `src/lib/realtime-patch.ts`:

```ts
import type { Vehiculo } from "./types";

export type CambioRealtime = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Vehiculo | null;
  old: { id?: string } | null;
};

/**
 * Aplica un evento de Postgres a la lista de vehículos y devuelve una lista
 * nueva. No filtra por estado: eso lo decide cada vista.
 */
export function aplicarCambio(lista: Vehiculo[], cambio: CambioRealtime): Vehiculo[] {
  if (cambio.eventType === "DELETE") {
    const id = cambio.old?.id;
    return id ? lista.filter((v) => v.id !== id) : lista;
  }

  const fila = cambio.new;
  if (!fila?.id) return lista;

  // Un borrado lógico llega como UPDATE, pero para la vista es una baja.
  if (fila.deleted_at !== null) return lista.filter((v) => v.id !== fila.id);

  const indice = lista.findIndex((v) => v.id === fila.id);
  if (indice === -1) return [fila, ...lista];

  const siguiente = [...lista];
  siguiente[indice] = fila;
  return siguiente;
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test`
Expected: PASS — 24 tests en total (16 de métricas + 8 de realtime).

- [ ] **Step 5: Cliente Supabase de navegador**

Crear `src/lib/supabase-browser.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let cliente: BrowserClient | null = null;

/**
 * Cliente anon para el navegador, compartido por todas las suscripciones.
 * Devuelve null si el entorno no tiene configurado Supabase, para que las
 * vistas sigan mostrando los datos que renderizó el servidor.
 */
export function getBrowserSupabase(): BrowserClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (!cliente) cliente = createBrowserClient(url, anonKey);
  return cliente;
}
```

- [ ] **Step 6: Hook de suscripción**

Crear `src/lib/use-vehiculos-realtime.ts`:

```ts
"use client";
import { useEffect, useState } from "react";
import { aplicarCambio, type CambioRealtime } from "./realtime-patch";
import { getBrowserSupabase } from "./supabase-browser";
import type { Vehiculo } from "./types";

/**
 * Arranca con la lista que renderizó el servidor y la mantiene al día con los
 * cambios de la tabla. Si Supabase no está configurado o el socket se cae, se
 * conserva la lista inicial: la vista nunca queda vacía.
 */
export function useVehiculosRealtime(inicial: Vehiculo[]): Vehiculo[] {
  const [vehiculos, setVehiculos] = useState(inicial);

  useEffect(() => {
    setVehiculos(inicial);
  }, [inicial]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const canal = supabase
      .channel("vehiculos-posse-stock")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehiculos_posse" },
        (payload) => {
          setVehiculos((prev) => aplicarCambio(prev, payload as unknown as CambioRealtime));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  return vehiculos;
}
```

- [ ] **Step 7: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/realtime-patch.ts src/lib/realtime-patch.test.ts src/lib/supabase-browser.ts src/lib/use-vehiculos-realtime.ts
git commit -m "feat: parche de realtime para la lista de vehiculos"
```

---

### Task 4: Catálogo público en vivo con estado reservado

La landing muestra el badge de reservado y se actualiza sola cuando el dueño cambia un estado.

**Files:**
- Modify: `src/components/vehicle-card.tsx`
- Create: `src/components/catalogo-live.tsx`
- Modify: `src/app/catalogo/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `useVehiculosRealtime` (Tarea 3), `Vehiculo` (Tarea 1).
- Produces: `<CatalogoLive vehiculos={Vehiculo[]}>{(lista) => ReactNode}</CatalogoLive>` — componente cliente que recibe la lista del servidor, la mantiene viva y la pasa como argumento a su children, ya filtrada (sin vendidos ni borrados).

- [ ] **Step 1: Variante reservado en la tarjeta**

En `src/components/vehicle-card.tsx`, dentro de `VehicleCard`, reemplazar el bloque del badge:

```tsx
        {vehiculo.badge && (
          <span className="absolute left-3 top-3 rounded bg-car-gold px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
            {vehiculo.badge}
          </span>
        )}
```

por este, que le da prioridad al estado reservado sobre el badge editorial:

```tsx
        {vehiculo.estado === "reservado" ? (
          <span className="absolute left-3 top-3 rounded bg-amber-400 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
            Reservado
          </span>
        ) : (
          vehiculo.badge && (
            <span className="absolute left-3 top-3 rounded bg-car-gold px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
              {vehiculo.badge}
            </span>
          )
        )}
```

Y reemplazar el `<Link>` verde de WhatsApp del final por un condicional, para que un auto reservado no habilite la consulta:

```tsx
        {vehiculo.estado === "reservado" ? (
          <p className="flex w-full items-center justify-center rounded border border-amber-400/40 bg-amber-400/10 py-3 text-center text-sm font-bold uppercase tracking-wide text-amber-400">
            Reservado · consultá por similares
          </p>
        ) : (
          <Link
            href={buildWhatsAppUrl(vehiculo.nombre, vehiculo.anio, "card")}
            target="_blank" rel="noopener"
            className="flex w-full items-center justify-center gap-2 rounded bg-[#25D366] py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1da851]"
          >
            <WaIcon /> Consultar por WhatsApp
          </Link>
        )}
```

- [ ] **Step 2: Crear el envoltorio en vivo**

Crear `src/components/catalogo-live.tsx`:

```tsx
"use client";
import { useVehiculosRealtime } from "@/lib/use-vehiculos-realtime";
import type { Vehiculo } from "@/lib/types";

/**
 * Envuelve una grilla del catálogo público: recibe lo que renderizó el
 * servidor y vuelve a renderizar cuando cambia el stock. Filtra los vendidos,
 * que tienen su propia sección.
 */
export function CatalogoLive({
  vehiculos,
  children,
}: {
  vehiculos: Vehiculo[];
  children: (lista: Vehiculo[]) => React.ReactNode;
}) {
  const vivos = useVehiculosRealtime(vehiculos);
  const publicables = vivos.filter((v) => v.estado !== "vendido" && v.deleted_at === null);
  return <>{children(publicables)}</>;
}
```

- [ ] **Step 3: Conectar el catálogo**

En `src/app/catalogo/page.tsx`, agregar el import:

```tsx
import { CatalogoLive } from "@/components/catalogo-live";
```

La página filtra `vehiculos` en `filtered` y después renderiza la grilla. Envolver **la grilla** (no los filtros, que se calculan en el servidor) con `CatalogoLive`, pasándole `filtered`.

Reemplazar exactamente este bloque, que hoy está justo después del `</form>` de los filtros:

```tsx
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-car-muted">
            <p className="font-condensed text-2xl font-bold italic">No encontramos vehículos con esos filtros.</p>
            <Link href="/catalogo" className="mt-4 inline-block text-car-gold underline">Ver todos</Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => <VehicleCard key={v.id} vehiculo={v} />)}
          </div>
        )}
```

por este, que conserva las mismas clases y el mismo copy, movidos adentro del callback:

```tsx
        <CatalogoLive vehiculos={filtered}>
          {(lista) =>
            lista.length === 0 ? (
              <div className="py-20 text-center text-car-muted">
                <p className="font-condensed text-2xl font-bold italic">No encontramos vehículos con esos filtros.</p>
                <Link href="/catalogo" className="mt-4 inline-block text-car-gold underline">Ver todos</Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {lista.map((v) => <VehicleCard key={v.id} vehiculo={v} />)}
              </div>
            )
          }
        </CatalogoLive>
```

- [ ] **Step 4: Conectar la home**

En `src/app/page.tsx`, agregar el import de `CatalogoLive` y envolver únicamente la grilla de destacados — la línea que hoy dice
`{featured.map((v) => <VehicleCard key={v.id} vehiculo={v} />)}`:

```tsx
<CatalogoLive vehiculos={featured}>
  {(lista) => lista.map((v) => <VehicleCard key={v.id} vehiculo={v} />)}
</CatalogoLive>
```

La sección de vendidos de la home queda como está: se actualiza al recargar.

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 6: Verificar en el navegador**

Levantar el preview con la configuración `posse-dev` de `.claude/launch.json` y abrir `http://localhost:3000/catalogo`.

Verificar en la consola del navegador que no hay errores, y comprobar que el canal quedó suscrito:

```js
document.querySelectorAll('article').length
```

Esperado: la misma cantidad de tarjetas que antes del cambio (14 con los datos actuales).

- [ ] **Step 7: Commit**

```bash
git add src/components/vehicle-card.tsx src/components/catalogo-live.tsx src/app/catalogo/page.tsx src/app/page.tsx
git commit -m "feat: catalogo publico en vivo con estado reservado"
```

---

### Task 5: Ruta `/panel` protegida, con configuración PWA

Cascarón de la PWA: autenticación, manifest, meta tags de iOS y carga de datos.

**Files:**
- Modify: `src/middleware.ts`
- Create: `public/panel.webmanifest`
- Create: `src/app/panel/layout.tsx`
- Create: `src/app/panel/page.tsx`

**Interfaces:**
- Consumes: `getAllVehiculos()` de `src/lib/data.ts`, `requireAdminSession()` de `src/lib/auth.ts`.
- Produces: la ruta `/panel`, que renderiza `<PanelApp vehiculos={Vehiculo[]} ahora={string} />` (el componente se implementa en la Tarea 8; hasta entonces la página muestra un marcador de posición).

- [ ] **Step 1: Proteger `/panel` en el middleware**

En `src/middleware.ts`, la condición del redirect y el `matcher` solo contemplan `/admin`. Reemplazar la condición:

```ts
  if (!user && request.nextUrl.pathname.startsWith("/admin") &&
      !request.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
```

por:

```ts
  const rutaProtegida =
    request.nextUrl.pathname.startsWith("/panel") ||
    (request.nextUrl.pathname.startsWith("/admin") &&
      !request.nextUrl.pathname.startsWith("/admin/login"));

  if (!user && rutaProtegida) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
```

Y reemplazar el `config` del final del archivo por:

```ts
export const config = {
  matcher: ["/admin/:path*", "/panel/:path*"],
};
```

- [ ] **Step 2: Crear el manifest**

Crear `public/panel.webmanifest`:

```json
{
  "name": "Posse Automotores · Panel",
  "short_name": "Posse",
  "description": "Gestión de stock y métricas de venta de Posse Automotores.",
  "start_url": "/panel",
  "scope": "/panel",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0d0d12",
  "theme_color": "#0d0d12",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Layout de la PWA**

Crear `src/app/panel/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Panel · Posse Automotores",
  description: "Gestión de stock y métricas de venta.",
  manifest: "/panel.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Posse",
    statusBarStyle: "black-translucent",
  },
  // El panel es privado: nunca debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0d12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Deja que el fondo llegue hasta debajo del notch y de la barra de gestos.
  viewportFit: "cover",
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-car-black text-car-white">{children}</div>;
}
```

`appleWebApp.capable: true` es lo que hace que Next emita `<meta name="apple-mobile-web-app-capable" content="yes">`, que es lo que saca la barra de Safari al abrir desde el acceso directo. El `apple-touch-icon` ya lo emite `src/app/apple-icon.png`, que existe desde el commit del logo.

- [ ] **Step 4: Página del panel**

Crear `src/app/panel/page.tsx`:

```tsx
import { requireAdminSession } from "@/lib/auth";
import { getAllVehiculos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  await requireAdminSession();
  const vehiculos = await getAllVehiculos();

  return (
    <main className="p-6">
      <p className="text-car-muted">Panel · {vehiculos.length} vehículos cargados</p>
    </main>
  );
}
```

(Es un marcador de posición deliberado: la Tarea 8 lo reemplaza por `<PanelApp />`. No dejarlo así al terminar el plan.)

- [ ] **Step 5: Verificar la ruta y el manifest**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

Con el preview corriendo, abrir `http://localhost:3000/panel.webmanifest`.
Esperado: responde 200 con el JSON del manifest.

Abrir `http://localhost:3000/panel` en una ventana sin sesión iniciada.
Esperado: redirige a `/admin/login`. Esto confirma que el middleware nuevo funciona.

Iniciar sesión con `admin@posse.com` y volver a `/panel`.
Esperado: se ve "Panel · N vehículos cargados".

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts public/panel.webmanifest src/app/panel/layout.tsx src/app/panel/page.tsx
git commit -m "feat: ruta /panel protegida con manifest y meta tags de iOS"
```

---

### Task 6: Server Actions de cambio de estado

Las tres escrituras que hace el panel.

**Files:**
- Create: `src/app/panel/actions.ts`

**Interfaces:**
- Consumes: `requireAdminSession()`, `createAdminSupabaseClient()`, `EstadoVehiculo` (Tarea 1).
- Produces:
  - `type ResultadoAccion = { ok: true } | { ok: false; error: string }`
  - `cambiarEstado(id: string, estado: "disponible" | "reservado"): Promise<ResultadoAccion>`
  - `marcarVendido(id: string, datos: { precio: number | null; nota: string | null }): Promise<ResultadoAccion>`
  - `deshacerVenta(id: string): Promise<ResultadoAccion>`

- [ ] **Step 1: Implementar las acciones**

Crear `src/app/panel/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

const RUTAS = ["/", "/catalogo", "/panel", "/admin/vehiculos"];

function revalidar() {
  // El callback explícito importa: revalidatePath toma un segundo parámetro
  // ("page" | "layout") y pasarle el índice del forEach rompería la llamada.
  RUTAS.forEach((ruta) => revalidatePath(ruta));
}

async function actualizar(id: string, campos: Record<string, unknown>): Promise<ResultadoAccion> {
  await requireAdminSession();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("vehiculos_posse").update(campos).eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true };
}

/** Campos de venta en blanco: un auto que vuelve al stock no conserva la venta. */
const SIN_VENTA = { sold_at: null, sale_price: null, sale_notes: null };

export async function cambiarEstado(
  id: string,
  estado: "disponible" | "reservado"
): Promise<ResultadoAccion> {
  return actualizar(id, { estado, ...SIN_VENTA });
}

export async function marcarVendido(
  id: string,
  datos: { precio: number | null; nota: string | null }
): Promise<ResultadoAccion> {
  return actualizar(id, {
    estado: "vendido",
    sold_at: new Date().toISOString(),
    sale_price: datos.precio,
    sale_notes: datos.nota,
  });
}

export async function deshacerVenta(id: string): Promise<ResultadoAccion> {
  return actualizar(id, { estado: "disponible", ...SIN_VENTA });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/panel/actions.ts
git commit -m "feat: server actions de cambio de estado y registro de venta"
```

---

### Task 7: Componentes de presentación del panel

Cuatro componentes sin estado propio: reciben props, emiten callbacks.

**Files:**
- Create: `src/components/panel/kpi-header.tsx`
- Create: `src/components/panel/vehicle-row.tsx`
- Create: `src/components/panel/sale-sheet.tsx`
- Create: `src/components/panel/stock-list.tsx`

**Interfaces:**
- Consumes: `Kpis` (Tarea 2), `Vehiculo` y `EstadoVehiculo` (Tarea 1).
- Produces:
  - `<KpiHeader kpis={Kpis} />`
  - `<VehicleRow vehiculo={Vehiculo} onEstado={(estado: EstadoVehiculo) => void} pendiente={boolean} />`
  - `<SaleSheet vehiculo={Vehiculo | null} onCerrar={() => void} onConfirmar={(datos: { precio: number | null; nota: string | null }) => void} />`
  - `<StockList vehiculos={Vehiculo[]} onEstado={(id: string, estado: EstadoVehiculo) => void} pendientes={Set<string>} />`

- [ ] **Step 1: Cabecera de KPIs**

Crear `src/components/panel/kpi-header.tsx`:

```tsx
import type { Kpis } from "@/lib/metrics";

function Tarjeta({ etiqueta, valor, detalle, color }: {
  etiqueta: string;
  valor: string;
  detalle: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-car-gray2 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-car-muted">{etiqueta}</p>
      <p className={`font-condensed text-3xl font-black italic leading-none ${color}`}>{valor}</p>
      <p className="mt-0.5 text-[11px] text-car-muted">{detalle}</p>
    </div>
  );
}

export function KpiHeader({ kpis }: { kpis: Kpis }) {
  const { deltaSemana } = kpis;
  const signo = deltaSemana > 0 ? "▲" : deltaSemana < 0 ? "▼" : "=";
  const colorDelta =
    deltaSemana > 0 ? "text-emerald-400" : deltaSemana < 0 ? "text-red-400" : "text-car-muted";

  return (
    <div className="grid grid-cols-3 gap-2">
      <Tarjeta
        etiqueta="Stock"
        valor={String(kpis.stockActivo)}
        detalle={`${kpis.disponibles} disp · ${kpis.reservados} res`}
        color="text-car-white"
      />
      <Tarjeta
        etiqueta="Semana"
        valor={String(kpis.vendidosSemana)}
        detalle={`${signo} ${Math.abs(deltaSemana)} vs anterior`}
        color={colorDelta}
      />
      <Tarjeta
        etiqueta="Rotación"
        valor={kpis.rotacionDias === null ? "—" : `${kpis.rotacionDias}`}
        detalle={kpis.rotacionDias === null ? "sin datos" : "días promedio"}
        color="text-car-gold"
      />
    </div>
  );
}
```

- [ ] **Step 2: Fila de vehículo**

Crear `src/components/panel/vehicle-row.tsx`:

```tsx
import type { EstadoVehiculo, Vehiculo } from "@/lib/types";

const OPCIONES: { estado: EstadoVehiculo; texto: string; activo: string }[] = [
  { estado: "disponible", texto: "Disp", activo: "bg-emerald-500 text-car-black" },
  { estado: "reservado", texto: "Res", activo: "bg-amber-400 text-car-black" },
  { estado: "vendido", texto: "Vend", activo: "bg-car-gold text-car-black" },
];

export function VehicleRow({
  vehiculo,
  onEstado,
  pendiente,
}: {
  vehiculo: Vehiculo;
  onEstado: (estado: EstadoVehiculo) => void;
  pendiente: boolean;
}) {
  return (
    <li
      className={`overflow-hidden rounded-lg border border-white/10 bg-car-gray transition-opacity ${
        pendiente ? "opacity-50" : ""
      }`}
    >
      <div className="flex gap-3 p-3">
        {vehiculo.cover_image_url ? (
          <img
            src={vehiculo.cover_image_url}
            alt=""
            className="size-16 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded bg-car-gray2 text-[10px] text-car-muted">
            Sin foto
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-condensed text-base font-black italic leading-tight text-car-white">
            {vehiculo.nombre}
          </p>
          <p className="text-xs text-car-muted">
            {vehiculo.marca} · {vehiculo.anio}
          </p>
          <p className="font-condensed text-base font-bold text-car-gold">{vehiculo.precio_texto}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/10">
        {OPCIONES.map(({ estado, texto, activo }) => {
          const seleccionado = vehiculo.estado === estado;
          return (
            <button
              key={estado}
              type="button"
              disabled={pendiente}
              onClick={() => onEstado(estado)}
              aria-pressed={seleccionado}
              className={`min-h-11 text-sm font-bold uppercase tracking-wide transition ${
                seleccionado ? activo : "bg-car-gray text-car-muted active:bg-car-gray2"
              }`}
            >
              {texto}
            </button>
          );
        })}
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Hoja de confirmación de venta**

Crear `src/components/panel/sale-sheet.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { Vehiculo } from "@/lib/types";

/** Hora exacta que se va a registrar, en formato argentino legible. */
function horaAhora(): string {
  return new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function SaleSheet({
  vehiculo,
  onCerrar,
  onConfirmar,
}: {
  vehiculo: Vehiculo | null;
  onCerrar: () => void;
  onConfirmar: (datos: { precio: number | null; nota: string | null }) => void;
}) {
  const [precio, setPrecio] = useState("");
  const [nota, setNota] = useState("");

  if (!vehiculo) return null;

  function confirmar() {
    const limpio = precio.replace(/[^\d]/g, "");
    onConfirmar({
      precio: limpio ? Number(limpio) : null,
      nota: nota.trim() || null,
    });
    setPrecio("");
    setNota("");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Cancelar"
        className="absolute inset-0 bg-black/70"
        onClick={onCerrar}
      />
      <div
        className="relative rounded-t-2xl border-t border-car-gold/30 bg-car-gray p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <p className="font-condensed text-xl font-black italic text-car-white">{vehiculo.nombre}</p>
        <p className="mt-1 text-sm text-car-muted">Se registra la venta el {horaAhora()}</p>

        <label className="mt-4 block text-xs uppercase tracking-wide text-car-muted">
          Precio de venta <span className="normal-case">(opcional)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="Ej: 32000"
          className="mt-1 min-h-11 w-full rounded border border-white/15 bg-car-gray2 px-3 text-car-white placeholder:text-car-muted/60 focus:border-car-gold focus:outline-none"
        />

        <label className="mt-3 block text-xs uppercase tracking-wide text-car-muted">
          Nota <span className="normal-case">(opcional)</span>
        </label>
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: entregó usado en parte de pago"
          className="mt-1 min-h-11 w-full rounded border border-white/15 bg-car-gray2 px-3 text-car-white placeholder:text-car-muted/60 focus:border-car-gold focus:outline-none"
        />

        <button
          type="button"
          onClick={confirmar}
          className="mt-5 min-h-14 w-full rounded bg-car-gold font-condensed text-lg font-black uppercase tracking-wide text-car-black transition active:bg-car-gold-dark"
        >
          Confirmar venta
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="mt-2 min-h-11 w-full text-sm font-semibold text-car-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Explorador de stock**

Crear `src/components/panel/stock-list.tsx`:

```tsx
"use client";
import { useMemo, useState } from "react";
import type { EstadoVehiculo, Vehiculo } from "@/lib/types";
import { VehicleRow } from "./vehicle-row";

type Filtro = "todos" | EstadoVehiculo;

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "disponible", texto: "Disponibles" },
  { valor: "reservado", texto: "Reservados" },
  { valor: "vendido", texto: "Vendidos" },
];

export function StockList({
  vehiculos,
  onEstado,
  pendientes,
}: {
  vehiculos: Vehiculo[];
  onEstado: (id: string, estado: EstadoVehiculo) => void;
  pendientes: Set<string>;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return vehiculos.filter((v) => {
      const okFiltro = filtro === "todos" || v.estado === filtro;
      const okBusqueda =
        !termino ||
        `${v.nombre} ${v.marca} ${v.modelo} ${v.anio}`.toLowerCase().includes(termino);
      return okFiltro && okBusqueda;
    });
  }, [vehiculos, filtro, busqueda]);

  return (
    <div>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, marca o año…"
        className="min-h-11 w-full rounded-full border border-white/15 bg-car-gray2 px-4 text-sm text-car-white placeholder:text-car-muted/60 focus:border-car-gold focus:outline-none"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map(({ valor, texto }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold uppercase tracking-wide transition ${
              filtro === valor
                ? "bg-car-gold text-car-black"
                : "bg-car-gray2 text-car-muted active:bg-white/10"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="py-12 text-center text-sm text-car-muted">
          No hay vehículos que coincidan.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visibles.map((v) => (
            <VehicleRow
              key={v.id}
              vehiculo={v}
              pendiente={pendientes.has(v.id)}
              onEstado={(estado) => onEstado(v.id, estado)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/panel/
git commit -m "feat: componentes de presentacion del panel movil"
```

---

### Task 8: Gráfico de ventas en SVG

Barras dibujadas a mano, con selector de rango y tap para ver el valor.

**Files:**
- Create: `src/components/panel/sales-chart.tsx`

**Interfaces:**
- Consumes: `getSerieVentas`, `Rango`, `Bucket` (Tarea 2); `Vehiculo` (Tarea 1).
- Produces: `<SalesChart vehiculos={Vehiculo[]} ahora={string} />`

- [ ] **Step 1: Implementar el gráfico**

Crear `src/components/panel/sales-chart.tsx`:

```tsx
"use client";
import { useMemo, useState } from "react";
import { getSerieVentas, type Rango } from "@/lib/metrics";
import type { Vehiculo } from "@/lib/types";

const RANGOS: { valor: Rango; texto: string }[] = [
  { valor: "dia", texto: "30 días" },
  { valor: "semana", texto: "12 sem" },
  { valor: "mes", texto: "12 meses" },
];

// Coordenadas del viewBox. El SVG escala solo al ancho del teléfono.
const ANCHO = 320;
const ALTO = 140;
const BASE = 118; // línea del eje X

export function SalesChart({ vehiculos, ahora }: { vehiculos: Vehiculo[]; ahora: string }) {
  const [rango, setRango] = useState<Rango>("semana");
  const [seleccion, setSeleccion] = useState<number | null>(null);

  const serie = useMemo(() => getSerieVentas(vehiculos, rango, ahora), [vehiculos, rango, ahora]);
  const total = serie.reduce((s, b) => s + b.total, 0);
  const maximo = Math.max(1, ...serie.map((b) => b.total));

  const paso = ANCHO / serie.length;
  const anchoBarra = Math.max(3, paso * 0.6);
  const activo = seleccion === null ? null : serie[seleccion];

  return (
    <section className="rounded-lg border border-white/10 bg-car-gray p-4">
      <div className="flex items-center justify-between">
        <p className="font-condensed text-lg font-black italic text-car-white">Ventas</p>
        <div className="flex gap-1">
          {RANGOS.map(({ valor, texto }) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setRango(valor);
                setSeleccion(null);
              }}
              className={`min-h-11 rounded-full px-3 text-xs font-bold uppercase tracking-wide transition ${
                rango === valor ? "bg-car-gold text-car-black" : "bg-car-gray2 text-car-muted"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-sm text-car-muted">
        {activo
          ? `${activo.label}: ${activo.total} ${activo.total === 1 ? "venta" : "ventas"}`
          : `${total} ${total === 1 ? "venta" : "ventas"} en el período`}
      </p>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-car-muted">
          Sin ventas registradas en este período.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Ventas por período: ${total} en total`}
        >
          <line x1="0" y1={BASE} x2={ANCHO} y2={BASE} stroke="#ffffff" strokeOpacity="0.15" />

          {serie.map((bucket, i) => {
            const altura = (bucket.total / maximo) * (BASE - 12);
            const x = i * paso + (paso - anchoBarra) / 2;
            const seleccionado = seleccion === i;
            return (
              <g key={bucket.key}>
                {/* Zona táctil de toda la columna: la barra sola sería muy fina. */}
                <rect
                  x={i * paso}
                  y="0"
                  width={paso}
                  height={BASE}
                  fill="transparent"
                  onClick={() => setSeleccion(seleccionado ? null : i)}
                />
                <rect
                  x={x}
                  y={BASE - altura}
                  width={anchoBarra}
                  height={altura}
                  rx="1.5"
                  fill={seleccionado ? "#C9A227" : "#34d399"}
                  pointerEvents="none"
                />
              </g>
            );
          })}

          {serie.map((bucket, i) =>
            // Solo algunas etiquetas: 30 no entran en el ancho de un teléfono.
            i % Math.ceil(serie.length / 6) === 0 ? (
              <text
                key={bucket.key}
                x={i * paso + paso / 2}
                y={ALTO - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#7a8aaa"
              >
                {bucket.label}
              </text>
            ) : null
          )}
        </svg>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin salida, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/panel/sales-chart.tsx
git commit -m "feat: grafico de ventas en SVG sin dependencias"
```

---

### Task 9: Ensamblar el panel y verificar la sincronización

El componente con estado que junta todo: realtime, tabs, actualización optimista y toast.

**Files:**
- Create: `src/components/panel/panel-app.tsx`
- Modify: `src/app/panel/page.tsx`

**Interfaces:**
- Consumes: todo lo anterior — `useVehiculosRealtime`, `getKpis`, `KpiHeader`, `StockList`, `SaleSheet`, `SalesChart`, `cambiarEstado`, `marcarVendido`, `deshacerVenta`.
- Produces: `<PanelApp vehiculos={Vehiculo[]} ahora={string} />`, la pantalla completa del panel.

- [ ] **Step 1: Implementar el componente**

Crear `src/components/panel/panel-app.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, Car, Plus } from "lucide-react";
import { cambiarEstado, deshacerVenta, marcarVendido } from "@/app/panel/actions";
import { getKpis } from "@/lib/metrics";
import type { EstadoVehiculo, Vehiculo } from "@/lib/types";
import { useVehiculosRealtime } from "@/lib/use-vehiculos-realtime";
import { KpiHeader } from "./kpi-header";
import { SaleSheet } from "./sale-sheet";
import { SalesChart } from "./sales-chart";
import { StockList } from "./stock-list";

type Tab = "stock" | "metricas";
type Toast = { texto: string; tono: "ok" | "error"; deshacer?: () => void };

export function PanelApp({ vehiculos, ahora }: { vehiculos: Vehiculo[]; ahora: string }) {
  const vivos = useVehiculosRealtime(vehiculos);

  const [tab, setTab] = useState<Tab>("stock");
  const [ventaAbierta, setVentaAbierta] = useState<Vehiculo | null>(null);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();

  const activos = useMemo(() => vivos.filter((v) => v.deleted_at === null), [vivos]);
  const kpis = useMemo(() => getKpis(activos, ahora), [activos, ahora]);

  // El toast se va solo a los 6 segundos, que es la ventana para tocar "Deshacer".
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  function marcarPendiente(id: string, activo: boolean) {
    setPendientes((prev) => {
      const siguiente = new Set(prev);
      if (activo) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  /**
   * Corre una Server Action mostrando la fila como pendiente. Realtime trae el
   * estado real, así que no hace falta parchar la lista a mano: alcanza con
   * avisar si falló.
   */
  function ejecutar(id: string, accion: () => Promise<{ ok: boolean; error?: string }>, exito: Toast) {
    marcarPendiente(id, true);
    startTransition(async () => {
      const r = await accion();
      marcarPendiente(id, false);
      setToast(r.ok ? exito : { texto: r.error ?? "No se pudo guardar", tono: "error" });
    });
  }

  function onEstado(id: string, estado: EstadoVehiculo) {
    const vehiculo = activos.find((v) => v.id === id);
    if (!vehiculo || vehiculo.estado === estado) return;

    if (estado === "vendido") {
      setVentaAbierta(vehiculo);
      return;
    }

    const texto = estado === "reservado" ? "Marcado como reservado" : "Devuelto al stock";
    ejecutar(id, () => cambiarEstado(id, estado), { texto, tono: "ok" });
  }

  function onConfirmarVenta(datos: { precio: number | null; nota: string | null }) {
    const vehiculo = ventaAbierta;
    if (!vehiculo) return;
    setVentaAbierta(null);

    ejecutar(vehiculo.id, () => marcarVendido(vehiculo.id, datos), {
      texto: `${vehiculo.nombre} · vendido`,
      tono: "ok",
      deshacer: () => {
        setToast(null);
        ejecutar(vehiculo.id, () => deshacerVenta(vehiculo.id), {
          texto: "Venta deshecha",
          tono: "ok",
        });
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header
        className="sticky top-0 z-30 border-b border-white/10 bg-car-black/95 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <img src="/logo-posse.png" alt="Posse Automotores" className="h-7 w-auto" />
          <span className="font-condensed text-sm font-black italic uppercase tracking-[3px] text-car-gold">
            Panel
          </span>
        </div>

        <KpiHeader kpis={kpis} />

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-car-gray2 p-1">
          {(["stock", "metricas"] as Tab[]).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => setTab(valor)}
              className={`min-h-11 rounded-full text-sm font-bold uppercase tracking-wide transition ${
                tab === valor ? "bg-car-gold text-car-black" : "text-car-muted"
              }`}
            >
              {valor === "stock" ? "Stock" : "Métricas"}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-4">
        {tab === "stock" ? (
          <StockList vehiculos={activos} onEstado={onEstado} pendientes={pendientes} />
        ) : (
          <SalesChart vehiculos={activos} ahora={ahora} />
        )}
      </main>

      {toast && (
        <div className="fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
          <div
            className={`flex w-full max-w-sm items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.tono === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            <span className="min-w-0 truncate">{toast.texto}</span>
            {toast.deshacer ? (
              <button type="button" onClick={toast.deshacer} className="shrink-0 underline">
                Deshacer
              </button>
            ) : (
              <button type="button" onClick={() => setToast(null)} className="shrink-0 underline">
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg justify-around border-t border-white/10 bg-car-black/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          type="button"
          onClick={() => setTab("stock")}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase ${
            tab === "stock" ? "text-car-gold" : "text-car-muted"
          }`}
        >
          <Car size={20} /> Stock
        </button>
        <button
          type="button"
          onClick={() => setTab("metricas")}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase ${
            tab === "metricas" ? "text-car-gold" : "text-car-muted"
          }`}
        >
          <BarChart3 size={20} /> Métricas
        </button>
        <Link
          href="/admin/vehiculos/nuevo"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase text-car-muted"
        >
          <Plus size={20} /> Agregar
        </Link>
      </nav>

      <SaleSheet
        vehiculo={ventaAbierta}
        onCerrar={() => setVentaAbierta(null)}
        onConfirmar={onConfirmarVenta}
      />
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar el marcador de posición de la página**

Reemplazar el contenido completo de `src/app/panel/page.tsx`:

```tsx
import { requireAdminSession } from "@/lib/auth";
import { getAllVehiculos } from "@/lib/data";
import { PanelApp } from "@/components/panel/panel-app";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  await requireAdminSession();
  const vehiculos = await getAllVehiculos();

  // La hora se fija en el servidor para que los KPIs no cambien entre el
  // render del servidor y el del cliente.
  return <PanelApp vehiculos={vehiculos} ahora={new Date().toISOString()} />;
}
```

- [ ] **Step 3: Verificar que compila y que los tests pasan**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: tsc sin salida; 24 tests pasando; lint sin errores.

- [ ] **Step 4: Verificar la sincronización de punta a punta**

Con el preview corriendo y sesión iniciada como `admin@posse.com`:

1. Abrir `http://localhost:3000/catalogo` en una pestaña y anotar la cantidad de tarjetas.
2. Abrir `http://localhost:3000/panel` en otra pestaña.
3. En el panel, tocar **Res** en un vehículo disponible.
4. Volver a la pestaña del catálogo **sin recargarla**.

Esperado: esa tarjeta ahora muestra el badge ámbar "Reservado" y, en lugar del botón verde, el texto "Reservado · consultá por similares". La cantidad de tarjetas no cambió.

5. En el panel, tocar **Vend** en ese mismo vehículo, confirmar sin llenar nada.

Esperado: en el catálogo, sin recargar, la tarjeta desaparece de la grilla.

6. Tocar **Deshacer** en el toast del panel.

Esperado: la tarjeta vuelve a aparecer en el catálogo como disponible.

Si el catálogo no reacciona: revisar en la consola del navegador que no haya errores de WebSocket, y confirmar en el SQL Editor que la tabla está en la publicación:

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
```

Esperado: la lista incluye `vehiculos_posse`.

- [ ] **Step 5: Verificar el comportamiento de PWA**

En Chrome DevTools → Application → Manifest, con `/panel` abierto.
Esperado: se lee "Posse Automotores · Panel", `start_url` `/panel`, `display` standalone, y los tres íconos cargan sin error.

Con el emulador de móvil (375×812), recorrer `/panel`.
Esperado: la barra inferior no tapa la última fila de la lista, el buscador y los botones de estado se tocan cómodo, y no aparece scroll horizontal.

- [ ] **Step 6: Commit**

```bash
git add src/components/panel/panel-app.tsx src/app/panel/page.tsx
git commit -m "feat: panel movil PWA con metricas y cambio de estado en 1 tap"
```

---

## Después del plan

Para que el dueño lo agregue al iPhone: abrir la URL de producción de `/panel` en **Safari** (no Chrome — solo Safari puede agregar a la pantalla de inicio en iOS), tocar Compartir → "Agregar a inicio". El acceso directo abre a pantalla completa, sin barra de navegación.

Queda fuera de este plan, tal como acordamos en el spec: service worker y modo offline, notificaciones push, backfill de `sold_at` para las ventas históricas, y graficar montos de `sale_price`.
