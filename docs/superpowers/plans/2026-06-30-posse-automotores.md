# Posse Automotores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el sitio de Posse Automotores en Next.js 15 + Supabase con panel admin para gestionar el stock de vehículos.

**Architecture:** App Router de Next.js 15 con Server Components para las páginas públicas y autenticación via Supabase Auth. Una tabla `vehiculos` en Supabase gestiona todo el contenido. El admin está protegido por middleware.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + Auth + Storage), Tailwind CSS, TypeScript, Barlow / Barlow Condensed (Google Fonts)

## Global Constraints

- Next.js 15 App Router — leer `node_modules/next/dist/docs/` antes de escribir código
- Todos los `params` y `searchParams` son `Promise<...>` y requieren `await`
- `cookies()` solo se puede escribir en Server Actions o Route Handlers — usar try/catch en Server Components
- Colores: black `#0d0d12`, gray `#141824`, gray2 `#1e2434`, gold `#C9A227`, gold-dark `#a8881f`, white `#EEF2FF`, muted `#7a8aaa`
- Fuentes: Barlow Condensed (títulos, italic bold) + Barlow (cuerpo) via Google Fonts
- Tema 100% dark — sin clases `dark:`
- Número WhatsApp: `5493537662444`
- Soft delete: `deleted_at IS NULL` = activo
- Estado de vehículo: `disponible` | `vendido`
- Sin tests unitarios — verificar con build + revisión visual en browser

---

## File Map

```
posse-automotores/
├── src/
│   ├── app/
│   │   ├── layout.tsx                        # Root layout, fuentes, metadata global
│   │   ├── globals.css                       # Tailwind base + CSS vars + scrollbar
│   │   ├── not-found.tsx                     # 404 personalizada
│   │   ├── page.tsx                          # Home: hero + features + destacados + nosotros + porque + vendidos + contacto
│   │   ├── catalogo/
│   │   │   └── page.tsx                      # Catálogo con filtros
│   │   ├── vehiculos/
│   │   │   └── [slug]/
│   │   │       └── page.tsx                  # Ficha de vehículo
│   │   └── admin/
│   │       ├── login/
│   │       │   └── page.tsx                  # Login form
│   │       ├── page.tsx                      # Dashboard con counters
│   │       └── vehiculos/
│   │           ├── page.tsx                  # Listado + toggle estado
│   │           ├── nuevo/
│   │           │   └── page.tsx              # Form crear vehículo
│   │           └── [id]/
│   │               └── editar/
│   │                   └── page.tsx          # Form editar vehículo
│   ├── components/
│   │   ├── site-header.tsx                   # Nav sticky dark con logo
│   │   ├── site-footer.tsx                   # Footer oscuro
│   │   ├── vehicle-card.tsx                  # Card de vehículo (dark + gold)
│   │   ├── floating-whatsapp.tsx             # Botón WA fijo bottom-right
│   │   └── admin-shell.tsx                   # Layout del panel admin
│   ├── lib/
│   │   ├── supabase.ts                       # createBrowserClient, createServerClient, createAdminClient
│   │   ├── types.ts                          # Tipo Vehiculo
│   │   ├── data.ts                           # Queries a Supabase
│   │   ├── auth.ts                           # requireAdminSession()
│   │   └── utils.ts                          # formatPrice, buildSlug
│   └── middleware.ts                         # Protege /admin/* rutas
├── .env.local                                # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`

**Interfaces:**
- Produces: proyecto Next.js 15 funcional con Tailwind y fuentes Barlow configuradas

- [ ] **Step 1: Crear proyecto Next.js en el directorio existente**

```bash
cd "C:/Users/bauti/OneDrive/Desktop/PROYECTOS DE MUESTRA/autoss/posse-automotores"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

Cuando pregunte por archivos existentes, elegir continuar (los HTML no conflictúan).

- [ ] **Step 2: Instalar dependencias de Supabase**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Configurar tailwind.config.ts con colores y fuentes**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        barlow: ["var(--font-barlow)", "sans-serif"],
        condensed: ["var(--font-barlow-condensed)", "sans-serif"],
      },
      colors: {
        car: {
          black: "#0d0d12",
          gray: "#141824",
          gray2: "#1e2434",
          gold: "#C9A227",
          "gold-dark": "#a8881f",
          white: "#EEF2FF",
          muted: "#7a8aaa",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Escribir globals.css**

```css
@import "tailwindcss";

:root {
  --font-barlow: "Barlow", sans-serif;
  --font-barlow-condensed: "Barlow Condensed", sans-serif;
}

html { scroll-behavior: smooth; }

body {
  background-color: #0d0d12;
  color: #EEF2FF;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0d0d12; }
::-webkit-scrollbar-thumb { background: #C9A227; border-radius: 3px; }
```

- [ ] **Step 5: Escribir src/app/layout.tsx**

```typescript
import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "Posse Automotores | Justiniano Posse, Córdoba",
  description: "Concesionaria de autos usados y 0km en Justiniano Posse, Córdoba. Financiación, garantía y atención personalizada.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-screen bg-car-black text-car-white font-barlow antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verificar que el proyecto compila**

```bash
npm run build
```

Expected: Build exitoso sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with Tailwind and Barlow fonts"
```

---

## Task 2: Supabase — Schema y Lib

**Files:**
- Create: `.env.local`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: `createServerClient()`, `createAdminSupabaseClient()`, tipo `Vehiculo`

- [ ] **Step 1: Crear proyecto en Supabase**

Ir a supabase.com → New project. Guardar: Project URL y anon key y service_role key.

- [ ] **Step 2: Crear tabla vehiculos en el SQL Editor de Supabase**

```sql
create table vehiculos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  marca text not null,
  modelo text not null,
  anio integer not null,
  kilometraje text not null default 'Consultá km',
  combustible text not null,
  transmision text not null,
  motor text,
  tipo text,
  descripcion text,
  precio_texto text not null default 'Consultá precio',
  cover_image_url text,
  imagenes text[] default '{}',
  estado text not null default 'disponible' check (estado in ('disponible', 'vendido')),
  badge text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table vehiculos enable row level security;

create policy "Public can read available"
  on vehiculos for select
  using (deleted_at is null);

create policy "Authenticated can do all"
  on vehiculos for all
  using (auth.role() = 'authenticated');
```

- [ ] **Step 3: Crear bucket de imágenes en Supabase Storage**

En Supabase → Storage → New bucket: nombre `vehiculos`, marcar como **Public**.

- [ ] **Step 4: Crear .env.local**

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
```

- [ ] **Step 5: Escribir src/lib/supabase.ts**

```typescript
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — writes handled by middleware
        }
      },
    },
  });
}

export function createAdminSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}
```

- [ ] **Step 6: Escribir src/lib/types.ts**

```typescript
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
  estado: "disponible" | "vendido";
  badge: string | null;
  created_at: string;
  deleted_at: string | null;
};
```

- [ ] **Step 7: Commit**

```bash
git add .env.local src/lib/supabase.ts src/lib/types.ts
git commit -m "feat: add Supabase client, types, and vehiculos table"
```

---

## Task 3: Data Layer + Auth + Middleware

**Files:**
- Create: `src/lib/data.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/utils.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `createAdminSupabaseClient()`, `createServerClient()`, tipo `Vehiculo`
- Produces:
  - `getVehiculosDisponibles(): Promise<Vehiculo[]>`
  - `getVehiculosVendidos(): Promise<Vehiculo[]>`
  - `getVehiculoBySlug(slug: string): Promise<Vehiculo | null>`
  - `getAllVehiculos(): Promise<Vehiculo[]>` (admin)
  - `requireAdminSession(): Promise<void>`
  - `formatPrice(text: string): string`
  - `buildWhatsAppUrl(vehiculo: Vehiculo): string`

- [ ] **Step 1: Escribir src/lib/utils.ts**

```typescript
export function formatPrice(precioTexto: string): string {
  return precioTexto;
}

export function buildWhatsAppUrl(nombre: string, anio: number, context: "card" | "ficha" = "card"): string {
  const base = "https://wa.me/5493537662444?text=";
  const msg =
    context === "ficha"
      ? `Hola, me interesa el ${nombre} ${anio}, ¿está disponible?`
      : `Hola, quiero consultar el ${nombre} ${anio}`;
  return base + encodeURIComponent(msg);
}

export function buildSlug(nombre: string, anio: number): string {
  return `${nombre}-${anio}`
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 2: Escribir src/lib/data.ts**

```typescript
import { createAdminSupabaseClient } from "./supabase";
import type { Vehiculo } from "./types";

export async function getVehiculosDisponibles(): Promise<Vehiculo[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("estado", "disponible")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getVehiculosVendidos(): Promise<Vehiculo[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("estado", "vendido")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getVehiculoBySlug(slug: string): Promise<Vehiculo | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("slug", slug)
    .eq("estado", "disponible")
    .is("deleted_at", null)
    .single();
  if (error) return null;
  return data;
}

export async function getAllVehiculos(): Promise<Vehiculo[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getVehiculoById(id: string): Promise<Vehiculo | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) return null;
  return data;
}

export async function countVehiculos(): Promise<{ total: number; disponibles: number; vendidos: number }> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("vehiculos")
    .select("estado")
    .is("deleted_at", null);
  const all = data ?? [];
  return {
    total: all.length,
    disponibles: all.filter((v) => v.estado === "disponible").length,
    vendidos: all.filter((v) => v.estado === "vendido").length,
  };
}
```

- [ ] **Step 3: Escribir src/lib/auth.ts**

```typescript
import { redirect } from "next/navigation";
import { createServerClient, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from "./supabase";

export async function requireAdminSession() {
  if (!isSupabaseConfigured()) redirect("/admin/login");
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login");
}
```

- [ ] **Step 4: Escribir src/middleware.ts**

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/admin") &&
      !request.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/data.ts src/lib/auth.ts src/lib/utils.ts src/middleware.ts
git commit -m "feat: add data layer, auth helper, and admin middleware"
```

---

## Task 4: Componentes Compartidos

**Files:**
- Create: `src/components/site-header.tsx`
- Create: `src/components/site-footer.tsx`
- Create: `src/components/floating-whatsapp.tsx`
- Create: `src/components/admin-shell.tsx`

**Interfaces:**
- Consumes: nada de otras tareas
- Produces: `<SiteHeader />`, `<SiteFooter />`, `<FloatingWhatsApp />`, `<AdminShell>`

- [ ] **Step 1: Escribir src/components/site-header.tsx**

```typescript
"use client";
import Link from "next/link";
import { useState } from "react";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#nosotros", label: "Nosotros" },
    { href: "/catalogo", label: "Vehículos" },
    { href: "/#porque", label: "Por qué elegirnos" },
    { href: "/#contacto", label: "Contacto" },
  ];
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-car-gold/20 bg-car-black/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link href="/" className="font-condensed text-xl font-black italic tracking-wide text-car-white">
          <span className="text-car-gold">POSSE</span> AUTOMOTORES
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-semibold uppercase tracking-wide text-car-white/80 transition hover:text-car-gold">
              {l.label}
            </Link>
          ))}
          <Link
            href={`https://wa.me/5493537662444?text=${encodeURIComponent("Hola, quiero consultar un vehículo")}`}
            target="_blank" rel="noopener"
            className="rounded bg-car-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
          >
            WhatsApp
          </Link>
        </nav>
        <button
          className="flex size-10 flex-col items-center justify-center gap-1.5 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menú"
        >
          <span className={`block h-0.5 w-6 bg-car-white transition-all ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block h-0.5 w-6 bg-car-white transition-all ${open ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-6 bg-car-white transition-all ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-car-gold/20 bg-car-black/98 px-5 py-4 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block py-3 text-sm font-semibold uppercase tracking-wide text-car-white/80 hover:text-car-gold">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Escribir src/components/site-footer.tsx**

```typescript
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-car-gold/15 bg-[#070709] px-5 py-8 text-center">
      <p className="font-condensed text-xl font-black italic text-car-white">
        <span className="text-car-gold">POSSE</span> AUTOMOTORES
      </p>
      <p className="mt-2 text-sm text-car-muted">
        Justiniano Posse, Córdoba · {new Date().getFullYear()}
      </p>
      <p className="mt-1 text-xs text-car-muted">
        <Link href="/admin" className="hover:text-car-gold">Admin</Link>
      </p>
    </footer>
  );
}
```

- [ ] **Step 3: Escribir src/components/floating-whatsapp.tsx**

```typescript
import Link from "next/link";

export function FloatingWhatsApp() {
  const url = `https://wa.me/5493537662444?text=${encodeURIComponent("Hola, quiero consultar un vehículo")}`;
  return (
    <Link href={url} target="_blank" rel="noopener"
      className="group fixed bottom-7 right-7 z-50 flex size-15 items-center justify-center rounded-full bg-[#25D366] shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-transform hover:scale-110"
      aria-label="WhatsApp"
    >
      <span className="absolute right-16 hidden whitespace-nowrap rounded-full border border-[#25D366]/30 bg-car-black px-3 py-1.5 text-xs font-semibold text-car-white group-hover:block">
        Consultanos
      </span>
      <svg viewBox="0 0 24 24" fill="white" className="size-7">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </Link>
  );
}
```

- [ ] **Step 4: Escribir src/components/admin-shell.tsx**

```typescript
import Link from "next/link";
import { Car, LayoutDashboard, LogOut } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/vehiculos", label: "Vehículos", icon: Car },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-car-gray">
      <aside className="w-56 shrink-0 border-r border-white/10 bg-car-black">
        <div className="px-5 py-5">
          <p className="font-condensed text-base font-black italic text-car-white">
            <span className="text-car-gold">POSSE</span> ADMIN
          </p>
        </div>
        <nav className="px-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium text-car-white/70 transition hover:bg-white/5 hover:text-car-gold">
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-0 w-56 px-3">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium text-car-white/50 transition hover:text-car-white">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Instalar lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 6: Verificar build**

```bash
npm run build
```

Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: add site-header, site-footer, floating-whatsapp, admin-shell"
```

---

## Task 5: VehicleCard Component

**Files:**
- Create: `src/components/vehicle-card.tsx`

**Interfaces:**
- Consumes: tipo `Vehiculo`, `buildWhatsAppUrl()` de `src/lib/utils.ts`
- Produces: `<VehicleCard vehiculo={Vehiculo} />`, `<VehicleCardVendido vehiculo={Vehiculo} />`

- [ ] **Step 1: Escribir src/components/vehicle-card.tsx**

```typescript
import Link from "next/link";
import type { Vehiculo } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/utils";

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export function VehicleCard({ vehiculo }: { vehiculo: Vehiculo }) {
  return (
    <article className="overflow-hidden rounded-lg border border-white/5 bg-car-gray transition-all hover:scale-[1.02] hover:border-car-gold/40 hover:shadow-[0_12px_40px_rgba(201,162,39,0.18)]">
      <Link href={`/vehiculos/${vehiculo.slug}`} className="relative block">
        {vehiculo.cover_image_url ? (
          <img src={vehiculo.cover_image_url} alt={vehiculo.nombre}
            className="aspect-video w-full object-cover" loading="lazy" />
        ) : (
          <div className="aspect-video w-full bg-car-gray2" />
        )}
        {vehiculo.badge && (
          <span className="absolute left-3 top-3 rounded bg-car-gold px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
            {vehiculo.badge}
          </span>
        )}
      </Link>
      <div className="p-5 space-y-4">
        <div>
          <p className="font-condensed text-xl font-black italic text-car-white leading-tight">
            {vehiculo.nombre}
          </p>
          <p className="mt-1 text-sm text-car-muted">{vehiculo.anio} · {vehiculo.kilometraje}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[vehiculo.combustible, vehiculo.transmision, vehiculo.tipo].filter(Boolean).map((s) => (
            <span key={s} className="rounded-full bg-car-gray2 px-3 py-1 text-xs text-car-muted">{s}</span>
          ))}
        </div>
        <p className="font-condensed text-2xl font-black text-car-gold">{vehiculo.precio_texto}</p>
        <Link
          href={buildWhatsAppUrl(vehiculo.nombre, vehiculo.anio, "card")}
          target="_blank" rel="noopener"
          className="flex w-full items-center justify-center gap-2 rounded bg-[#25D366] py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1da851]"
        >
          <WaIcon /> Consultar por WhatsApp
        </Link>
      </div>
    </article>
  );
}

export function VehicleCardVendido({ vehiculo }: { vehiculo: Vehiculo }) {
  return (
    <article className="overflow-hidden rounded-lg border border-white/5 bg-car-gray opacity-70 grayscale">
      <div className="relative">
        {vehiculo.cover_image_url ? (
          <img src={vehiculo.cover_image_url} alt={vehiculo.nombre}
            className="aspect-video w-full object-cover" loading="lazy" />
        ) : (
          <div className="aspect-video w-full bg-car-gray2" />
        )}
        <span className="absolute left-3 top-3 rounded bg-car-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Vendido
        </span>
      </div>
      <div className="p-4">
        <p className="font-condensed text-lg font-black italic text-car-white">{vehiculo.nombre}</p>
        <p className="mt-1 text-sm text-car-muted">{vehiculo.anio}</p>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/vehicle-card.tsx
git commit -m "feat: add VehicleCard and VehicleCardVendido components"
```

---

## Task 6: Home Page

**Files:**
- Create: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getVehiculosDisponibles()`, `getVehiculosVendidos()`, `<SiteHeader>`, `<SiteFooter>`, `<FloatingWhatsApp>`, `<VehicleCard>`, `<VehicleCardVendido>`

- [ ] **Step 1: Escribir src/app/page.tsx**

```typescript
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { VehicleCard, VehicleCardVendido } from "@/components/vehicle-card";
import { getVehiculosDisponibles, getVehiculosVendidos } from "@/lib/data";

export const dynamic = "force-dynamic";

const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-7">
    <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

export default async function Home() {
  const [disponibles, vendidos] = await Promise.all([
    getVehiculosDisponibles(),
    getVehiculosVendidos(),
  ]);

  const destacados = disponibles.filter((v) => v.badge === "Destacado").slice(0, 3);
  const featured = destacados.length >= 3 ? destacados : disponibles.slice(0, 3);

  const waUrl = `https://wa.me/5493537662444?text=${encodeURIComponent("Hola, quiero consultar un vehículo")}`;

  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-24 text-center">
          <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: "url(/img/frente%20local.jpg)" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-car-black" />
          <div className="relative z-10 max-w-3xl">
            <span className="mb-6 inline-block rounded-full border border-car-gold bg-car-gold/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[3px] text-car-gold">
              Justiniano Posse · Córdoba · Argentina
            </span>
            <h1 className="font-condensed text-6xl font-black italic leading-none tracking-tight text-car-white sm:text-8xl">
              <span className="text-car-gold">POSSE</span><br />AUTOMOTORES
            </h1>
            <p className="mt-4 font-condensed text-xl font-bold italic uppercase tracking-[4px] text-car-white/50">
              Usados &amp; 0km
            </p>
            <p className="mt-6 text-lg text-car-white/80">Tu inversión en buenas manos.</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/catalogo" className="flex items-center gap-3 rounded border-2 border-white/35 bg-white/10 px-8 py-4 font-condensed text-lg font-bold uppercase tracking-wide text-car-white backdrop-blur-sm transition hover:border-car-gold hover:bg-car-gold/20 hover:text-car-gold">
                <CarIcon /> Ver catálogo
              </Link>
              <Link href={waUrl} target="_blank" rel="noopener"
                className="flex items-center gap-3 rounded bg-[#25D366] px-8 py-4 font-condensed text-lg font-bold uppercase tracking-wide text-white shadow-[0_4px_24px_rgba(37,211,102,0.3)] transition hover:bg-[#1da851]">
                Consultanos ahora
              </Link>
            </div>
          </div>
          <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-car-white/30">
            <div className="h-10 w-px bg-gradient-to-b from-car-gold to-transparent" />
            <span className="text-xs uppercase tracking-[2px]">Scroll</span>
          </div>
        </section>

        {/* STRIP */}
        <section className="border-y-2 border-car-gold bg-gradient-to-r from-[#1a1200] to-[#2a1f00] px-5 py-5">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["4.9★", "Google"],
              ["+300", "Clientes"],
              ["0km", "y Usados"],
              ["✓", "Financiación"],
            ].map(([num, label]) => (
              <div key={label} className="text-center">
                <p className="font-condensed text-3xl font-black italic text-car-gold">{num}</p>
                <p className="text-xs uppercase tracking-wide text-car-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DESTACADOS */}
        {featured.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 py-20">
            <div className="mb-10 text-center">
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Nuestro stock</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Vehículos <span className="text-car-gold">disponibles</span>
              </h2>
              <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((v) => <VehicleCard key={v.id} vehiculo={v} />)}
            </div>
            {disponibles.length > 3 && (
              <div className="mt-10 text-center">
                <Link href="/catalogo" className="inline-flex items-center gap-2 rounded bg-car-gold px-8 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark">
                  Ver catálogo completo
                </Link>
              </div>
            )}
          </section>
        )}

        {/* NOSOTROS */}
        <section id="nosotros" className="bg-car-gray px-5 py-20">
          <div className="mx-auto grid max-w-5xl gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Quiénes somos</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Tu concesionaria de <span className="text-car-gold">confianza</span>
              </h2>
              <div className="mt-4 h-0.5 w-12 bg-car-gold" />
              <p className="mt-6 leading-7 text-car-white/70">
                Somos <strong className="text-car-white">Posse Automotores</strong>, una concesionaria con raíces en Justiniano Posse y presencia en toda la región de Córdoba. Nos especializamos en la compraventa de vehículos usados y 0km, con opciones para todos los presupuestos.
              </p>
              <p className="mt-4 leading-7 text-car-white/70">
                Trabajamos con honestidad y transparencia en cada operación. Te acompañamos desde que elegís el auto hasta que te entregamos las llaves, sin letra chica ni sorpresas.
              </p>
              <div className="mt-8 flex gap-8">
                {[["4.9★", "Google"], ["+300", "Clientes"], ["0km", "y Usados"]].map(([n, l]) => (
                  <div key={l}>
                    <p className="font-condensed text-3xl font-black italic text-car-gold">{n}</p>
                    <p className="text-xs uppercase tracking-wide text-car-muted">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["⭐", "4.9 estrellas en Google", "Calificación de clientes reales"],
                ["👥", "Atención personalizada", "Te acompañamos en todo el proceso"],
                ["📍", "Presencia local", "En el corazón de Justiniano Posse"],
              ].map(([icon, title, desc], i) => (
                <div key={title} className={`rounded-lg border border-car-gold/15 bg-car-gray2 p-6 text-center transition hover:border-car-gold hover:-translate-y-1 ${i === 0 ? "col-span-2" : ""}`}>
                  <p className="mb-2 text-2xl">{icon}</p>
                  <p className="font-condensed font-bold text-car-white">{title}</p>
                  <p className="mt-1 text-xs text-car-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* POR QUÉ ELEGIRNOS */}
        <section id="porque" className="px-5 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Ventajas</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Por qué <span className="text-car-gold">elegirnos</span>
              </h2>
              <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["💳", "Financiación", "Opciones adaptadas a tu posibilidad. Cuotas accesibles."],
                ["🛡️", "Garantía", "Todos nuestros usados pasan control exhaustivo."],
                ["📄", "Trámites", "Nos encargamos de toda la documentación."],
                ["💬", "Atención 24hs", "Respondemos por WhatsApp sin demoras."],
              ].map(([icon, title, desc]) => (
                <div key={title} className="rounded-lg border border-car-gold/12 bg-car-gray p-8 text-center transition hover:border-car-gold hover:-translate-y-1.5 hover:shadow-[0_8px_32px_rgba(201,162,39,0.1)]">
                  <p className="mb-4 text-3xl">{icon}</p>
                  <p className="font-condensed text-lg font-black text-car-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-car-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VENDIDOS */}
        {vendidos.length > 0 && (
          <section className="bg-car-gray px-5 py-20">
            <div className="mx-auto max-w-7xl">
              <div className="mb-10 text-center">
                <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Historial</p>
                <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                  Ya <span className="text-car-gold">vendidos</span>
                </h2>
                <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {vendidos.slice(0, 8).map((v) => <VehicleCardVendido key={v.id} vehiculo={v} />)}
              </div>
            </div>
          </section>
        )}

        {/* CONTACTO */}
        <section id="contacto" className="px-5 py-20">
          <div className="mx-auto grid max-w-5xl gap-16 lg:grid-cols-2">
            <div>
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Encontranos</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">Contacto</h2>
              <div className="mt-4 h-0.5 w-12 bg-car-gold" />
              <table className="mt-8 w-full">
                <tbody>
                  {[
                    ["Lunes a Viernes", "9:00 – 13:00 / 16:00 – 20:00"],
                    ["Sábados", "9:00 – 13:00"],
                    ["Domingos", "Cerrado"],
                  ].map(([dia, hora]) => (
                    <tr key={dia} className="border-b border-white/5">
                      <td className="py-3 text-sm text-car-muted">{dia}</td>
                      <td className={`py-3 text-sm font-semibold ${hora === "Cerrado" ? "text-car-gold" : "text-car-white"}`}>{hora}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 flex flex-col gap-4">
                <Link href={waUrl} target="_blank" rel="noopener" className="flex items-center gap-3 text-car-white/70 transition hover:text-car-white">
                  <span className="grid size-11 place-items-center rounded-lg border border-car-gold/20 bg-car-gray2 text-xl">📱</span>
                  +54 9 3537 66-2444
                </Link>
                <Link href="https://maps.google.com/?q=Justiniano+Posse+Córdoba" target="_blank" rel="noopener" className="flex items-center gap-3 text-car-white/70 transition hover:text-car-white">
                  <span className="grid size-11 place-items-center rounded-lg border border-car-gold/20 bg-car-gray2 text-xl">📍</span>
                  Justiniano Posse, Córdoba
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-car-gold/20">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d27292.!2d-62.677!3d-33.876!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95cc6d!2sJustiniano+Posse%2C+C%C3%B3rdoba!5e0!3m2!1ses!2sar!4v1"
                width="100%" height="100%" style={{ minHeight: 280, border: 0, filter: "invert(90%) hue-rotate(180deg)" }}
                allowFullScreen loading="lazy"
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
```

- [ ] **Step 2: Copiar las imágenes del sitio HTML a /public**

```bash
cp -r "img" "public/"
```

Las rutas en el HTML (`img/frente local.jpg`) quedan como `/img/frente local.jpg` en public.

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx public/
git commit -m "feat: add home page with hero, destacados, nosotros, vendidos, contacto"
```

---

## Task 7: Catálogo Page

**Files:**
- Create: `src/app/catalogo/page.tsx`

**Interfaces:**
- Consumes: `getVehiculosDisponibles()`, `<VehicleCard>`, `<SiteHeader>`, `<SiteFooter>`, `<FloatingWhatsApp>`

- [ ] **Step 1: Escribir src/app/catalogo/page.tsx**

```typescript
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { VehicleCard } from "@/components/vehicle-card";
import { getVehiculosDisponibles } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ marca?: string; tipo?: string; combustible?: string; q?: string }>;
}) {
  const params = await searchParams;
  const vehiculos = await getVehiculosDisponibles();

  const marcas = [...new Set(vehiculos.map((v) => v.marca))].sort();
  const tipos = [...new Set(vehiculos.map((v) => v.tipo).filter(Boolean))].sort() as string[];
  const combustibles = [...new Set(vehiculos.map((v) => v.combustible))].sort();

  const filtered = vehiculos.filter((v) => {
    const okMarca = params.marca ? v.marca === params.marca : true;
    const okTipo = params.tipo ? v.tipo === params.tipo : true;
    const okCombustible = params.combustible ? v.combustible === params.combustible : true;
    const term = params.q?.toLowerCase();
    const okQ = term ? `${v.nombre} ${v.modelo} ${v.marca}`.toLowerCase().includes(term) : true;
    return okMarca && okTipo && okCombustible && okQ;
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-28">
        <div className="mb-10">
          <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Catálogo</p>
          <h1 className="mt-2 font-condensed text-5xl font-black italic text-car-white">
            Vehículos <span className="text-car-gold">disponibles</span>
          </h1>
          <div className="mt-4 h-0.5 w-12 bg-car-gold" />
        </div>

        {/* FILTROS */}
        <form className="mb-8 flex flex-wrap gap-3">
          <input name="q" defaultValue={params.q}
            placeholder="Buscar marca o modelo..."
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white placeholder:text-car-muted outline-none focus:border-car-gold" />
          <select name="marca" defaultValue={params.marca ?? ""}
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white outline-none focus:border-car-gold">
            <option value="">Todas las marcas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select name="tipo" defaultValue={params.tipo ?? ""}
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white outline-none focus:border-car-gold">
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="combustible" defaultValue={params.combustible ?? ""}
            className="h-11 rounded border border-white/15 bg-car-gray2 px-4 text-sm text-car-white outline-none focus:border-car-gold">
            <option value="">Todos los combustibles</option>
            {combustibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" className="h-11 rounded bg-car-gold px-6 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark">
            Filtrar
          </button>
          {(params.marca || params.tipo || params.combustible || params.q) && (
            <Link href="/catalogo" className="flex h-11 items-center rounded border border-white/15 px-4 text-sm text-car-muted transition hover:text-car-white">
              Limpiar
            </Link>
          )}
        </form>

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
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/catalogo/
git commit -m "feat: add catalogo page with filters"
```

---

## Task 8: Ficha de Vehículo

**Files:**
- Create: `src/app/vehiculos/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getVehiculoBySlug()`, `buildWhatsAppUrl()`, `<SiteHeader>`, `<SiteFooter>`, `<FloatingWhatsApp>`

- [ ] **Step 1: Escribir src/app/vehiculos/[slug]/page.tsx**

```typescript
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { getVehiculoBySlug } from "@/lib/data";
import { buildWhatsAppUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const v = await getVehiculoBySlug(slug);
  if (!v) return { title: "Vehículo no encontrado" };
  return {
    title: `${v.nombre} ${v.anio} | Posse Automotores`,
    description: v.descripcion ?? `${v.nombre} ${v.anio} en Posse Automotores. ${v.precio_texto}.`,
  };
}

const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default async function VehiculoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = await getVehiculoBySlug(slug);
  if (!v) notFound();

  const whatsappUrl = buildWhatsAppUrl(v.nombre, v.anio, "ficha");
  const specs = [
    ["Año", String(v.anio)],
    ["Kilometraje", v.kilometraje],
    ["Combustible", v.combustible],
    ["Transmisión", v.transmision],
    v.motor ? ["Motor", v.motor] : null,
    v.tipo ? ["Tipo", v.tipo] : null,
  ].filter(Boolean) as string[][];

  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative min-h-[480px] bg-car-black">
          {v.cover_image_url && (
            <>
              <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${v.cover_image_url})` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-car-black via-black/50 to-transparent" />
            </>
          )}
          <div className="relative mx-auto flex min-h-[480px] max-w-7xl flex-col justify-end px-5 pb-12 pt-28">
            {v.badge && (
              <span className="mb-4 w-fit rounded bg-car-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-car-black">
                {v.badge}
              </span>
            )}
            <h1 className="font-condensed text-5xl font-black italic text-car-white sm:text-7xl">{v.nombre}</h1>
            <p className="mt-3 text-lg text-car-white/70">{v.anio} · {v.kilometraje}</p>
          </div>
        </section>

        {/* SPECS STRIP */}
        <section className="border-b border-white/10 bg-car-gray">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-3 lg:grid-cols-6">
            {specs.map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-car-muted">{label}</span>
                <strong className="mt-1 text-sm text-car-white">{value}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* CONTENIDO */}
        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_340px]">
          <div className="space-y-10">
            {v.descripcion && (
              <div>
                <h2 className="font-condensed text-2xl font-black italic text-car-white">Descripción</h2>
                <p className="mt-4 leading-8 text-car-white/70">{v.descripcion}</p>
              </div>
            )}
            {v.imagenes?.length > 1 && (
              <div>
                <h2 className="font-condensed text-2xl font-black italic text-car-white">Galería</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {v.imagenes.slice(1).map((url, i) => (
                    <img key={i} src={url} alt={`${v.nombre} ${i + 2}`}
                      className="aspect-video w-full rounded object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="h-fit rounded-lg border border-car-gold/20 bg-car-gray p-6 shadow-lg lg:sticky lg:top-24">
            <p className="text-xs uppercase tracking-wide text-car-muted">Precio</p>
            <p className="mt-1 font-condensed text-4xl font-black text-car-gold">{v.precio_texto}</p>
            <p className="mt-1 text-sm text-car-muted">Consultar financiación disponible</p>
            <Link href={whatsappUrl} target="_blank" rel="noopener"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-[#25D366] py-4 font-condensed text-base font-bold uppercase tracking-wide text-white transition hover:bg-[#1da851]">
              <WaIcon /> Consultar por WhatsApp
            </Link>
            <Link href="/catalogo"
              className="mt-3 flex w-full items-center justify-center rounded border border-white/15 py-3 text-sm text-car-white/70 transition hover:border-car-gold hover:text-car-gold">
              ← Ver más vehículos
            </Link>
          </aside>
        </section>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/vehiculos/
git commit -m "feat: add vehicle detail page"
```

---

## Task 9: 404 + Route Handler Sign Out

**Files:**
- Create: `src/app/not-found.tsx`
- Create: `src/app/api/auth/signout/route.ts`

- [ ] **Step 1: Escribir src/app/not-found.tsx**

```typescript
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-car-black px-5 text-center">
      <p className="font-condensed text-8xl font-black italic text-car-gold">404</p>
      <h1 className="mt-4 font-condensed text-3xl font-black italic text-car-white">Página no encontrada</h1>
      <p className="mt-3 text-car-muted">El vehículo o página que buscás no existe.</p>
      <Link href="/catalogo" className="mt-8 rounded bg-car-gold px-6 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark">
        Ver catálogo
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Escribir src/app/api/auth/signout/route.ts**

```typescript
import { createServerClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/not-found.tsx src/app/api/
git commit -m "feat: add 404 page and sign out route"
```

---

## Task 10: Admin — Login

**Files:**
- Create: `src/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `createServerClient()` de supabase.ts

- [ ] **Step 1: Escribir src/app/admin/login/page.tsx**

```typescript
"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-car-black px-5">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-condensed text-2xl font-black italic text-car-white">
          <span className="text-car-gold">POSSE</span> ADMIN
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-car-gold/20 bg-car-gray p-8">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-car-muted">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded border border-white/15 bg-car-gray2 px-4 py-3 text-sm text-car-white outline-none focus:border-car-gold" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-car-muted">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full rounded border border-white/15 bg-car-gray2 px-4 py-3 text-sm text-car-white outline-none focus:border-car-gold" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded bg-car-gold py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/login/
git commit -m "feat: add admin login page"
```

---

## Task 11: Admin — Dashboard

**Files:**
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `countVehiculos()`, `requireAdminSession()`, `<AdminShell>`

- [ ] **Step 1: Escribir src/app/admin/page.tsx**

```typescript
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { countVehiculos } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminSession();
  const counts = await countVehiculos();

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Dashboard</h1>
        <p className="mt-1 text-sm text-car-muted">Panel de administración — Posse Automotores</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          { label: "Total vehículos", value: counts.total, color: "text-car-white" },
          { label: "Disponibles", value: counts.disponibles, color: "text-emerald-400" },
          { label: "Vendidos", value: counts.vendidos, color: "text-car-gold" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-white/10 bg-car-gray2 p-6">
            <p className="text-sm text-car-muted">{label}</p>
            <p className={`mt-2 font-condensed text-5xl font-black italic ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Link href="/admin/vehiculos/nuevo"
          className="inline-flex items-center gap-2 rounded bg-car-gold px-5 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark">
          + Agregar vehículo
        </Link>
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add admin dashboard with vehicle counters"
```

---

## Task 12: Admin — Listado de Vehículos + Toggle Estado

**Files:**
- Create: `src/app/admin/vehiculos/page.tsx`
- Create: `src/app/admin/vehiculos/actions.ts`

**Interfaces:**
- Consumes: `getAllVehiculos()`, `requireAdminSession()`, `<AdminShell>`
- Produces: Server Actions `toggleEstado(id, estado)`, `softDeleteVehiculo(id)`

- [ ] **Step 1: Escribir src/app/admin/vehiculos/actions.ts**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase";

export async function toggleEstado(id: string, estadoActual: string) {
  const nuevoEstado = estadoActual === "disponible" ? "vendido" : "disponible";
  const supabase = createAdminSupabaseClient();
  await supabase.from("vehiculos").update({ estado: nuevoEstado }).eq("id", id);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
}

export async function softDeleteVehiculo(id: string) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("vehiculos").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
}
```

- [ ] **Step 2: Escribir src/app/admin/vehiculos/page.tsx**

```typescript
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { getAllVehiculos } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";
import { toggleEstado, softDeleteVehiculo } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminVehiculosPage() {
  await requireAdminSession();
  const vehiculos = await getAllVehiculos();

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Vehículos</h1>
        <Link href="/admin/vehiculos/nuevo"
          className="rounded bg-car-gold px-4 py-2 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark text-sm">
          + Agregar
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-car-gray2 text-xs uppercase tracking-wide text-car-muted">
              <th className="px-4 py-3 text-left">Vehículo</th>
              <th className="px-4 py-3 text-left">Año</th>
              <th className="px-4 py-3 text-left">Precio</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.map((v) => (
              <tr key={v.id} className="border-b border-white/5 bg-car-gray transition hover:bg-car-gray2">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {v.cover_image_url && (
                      <img src={v.cover_image_url} alt={v.nombre} className="size-12 rounded object-cover" />
                    )}
                    <div>
                      <p className="font-semibold text-car-white">{v.nombre}</p>
                      <p className="text-xs text-car-muted">{v.marca}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-car-muted">{v.anio}</td>
                <td className="px-4 py-3 text-car-gold">{v.precio_texto}</td>
                <td className="px-4 py-3">
                  <form action={toggleEstado.bind(null, v.id, v.estado)}>
                    <button type="submit"
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        v.estado === "disponible"
                          ? "bg-emerald-900/50 text-emerald-400"
                          : "bg-car-gold/15 text-car-gold"
                      }`}>
                      {v.estado}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/admin/vehiculos/${v.id}/editar`}
                      className="rounded border border-white/15 px-3 py-1 text-xs text-car-white transition hover:border-car-gold hover:text-car-gold">
                      Editar
                    </Link>
                    <form action={softDeleteVehiculo.bind(null, v.id)}
                      onSubmit={(e) => { if (!confirm("¿Eliminar este vehículo?")) e.preventDefault(); }}>
                      <button type="submit"
                        className="rounded border border-red-900 px-3 py-1 text-xs text-red-400 transition hover:bg-red-900/30">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vehiculos.length === 0 && (
          <p className="py-10 text-center text-car-muted">No hay vehículos cargados aún.</p>
        )}
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/vehiculos/page.tsx src/app/admin/vehiculos/actions.ts
git commit -m "feat: add admin vehicles list with toggle estado and soft delete"
```

---

## Task 13: Admin — Formulario Crear / Editar Vehículo

**Files:**
- Create: `src/app/admin/vehiculos/nuevo/page.tsx`
- Create: `src/app/admin/vehiculos/[id]/editar/page.tsx`
- Create: `src/app/admin/vehiculos/form-actions.ts`

**Interfaces:**
- Consumes: `getVehiculoById()`, `requireAdminSession()`, `createAdminSupabaseClient()`, `buildSlug()`, `<AdminShell>`

- [ ] **Step 1: Escribir src/app/admin/vehiculos/form-actions.ts**

```typescript
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { buildSlug } from "@/lib/utils";

export async function createVehiculo(formData: FormData) {
  const supabase = createAdminSupabaseClient();
  const nombre = formData.get("nombre") as string;
  const anio = Number(formData.get("anio"));
  const slug = buildSlug(nombre, anio);

  const imagenesRaw = formData.get("imagenes") as string;
  const imagenes = imagenesRaw ? imagenesRaw.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  const coverImageUrl = imagenes[0] ?? null;

  const { error } = await supabase.from("vehiculos").insert({
    slug,
    nombre,
    marca: formData.get("marca") as string,
    modelo: formData.get("modelo") as string,
    anio,
    kilometraje: (formData.get("kilometraje") as string) || "Consultá km",
    combustible: formData.get("combustible") as string,
    transmision: formData.get("transmision") as string,
    motor: (formData.get("motor") as string) || null,
    tipo: (formData.get("tipo") as string) || null,
    descripcion: (formData.get("descripcion") as string) || null,
    precio_texto: (formData.get("precio_texto") as string) || "Consultá precio",
    cover_image_url: coverImageUrl,
    imagenes,
    estado: (formData.get("estado") as string) || "disponible",
    badge: (formData.get("badge") as string) || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
  redirect("/admin/vehiculos");
}

export async function updateVehiculo(id: string, formData: FormData) {
  const supabase = createAdminSupabaseClient();
  const nombre = formData.get("nombre") as string;
  const anio = Number(formData.get("anio"));
  const slug = buildSlug(nombre, anio);

  const imagenesRaw = formData.get("imagenes") as string;
  const imagenes = imagenesRaw ? imagenesRaw.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  const coverImageUrl = imagenes[0] ?? null;

  const { error } = await supabase.from("vehiculos").update({
    slug,
    nombre,
    marca: formData.get("marca") as string,
    modelo: formData.get("modelo") as string,
    anio,
    kilometraje: (formData.get("kilometraje") as string) || "Consultá km",
    combustible: formData.get("combustible") as string,
    transmision: formData.get("transmision") as string,
    motor: (formData.get("motor") as string) || null,
    tipo: (formData.get("tipo") as string) || null,
    descripcion: (formData.get("descripcion") as string) || null,
    precio_texto: (formData.get("precio_texto") as string) || "Consultá precio",
    cover_image_url: coverImageUrl,
    imagenes,
    estado: (formData.get("estado") as string) || "disponible",
    badge: (formData.get("badge") as string) || null,
  }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehiculos");
  revalidatePath("/");
  redirect("/admin/vehiculos");
}
```

- [ ] **Step 2: Crear componente de formulario compartido (inline en nuevo/page.tsx)**

```typescript
// src/app/admin/vehiculos/nuevo/page.tsx
import { requireAdminSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { createVehiculo } from "../form-actions";
import { VehiculoForm } from "../vehiculo-form";

export const dynamic = "force-dynamic";

export default async function NuevoVehiculoPage() {
  await requireAdminSession();
  return (
    <AdminShell>
      <h1 className="mb-6 font-condensed text-3xl font-black italic text-car-white">Agregar vehículo</h1>
      <VehiculoForm action={createVehiculo} />
    </AdminShell>
  );
}
```

- [ ] **Step 3: Escribir src/app/admin/vehiculos/vehiculo-form.tsx**

```typescript
"use client";
import type { Vehiculo } from "@/lib/types";

const inputClass = "w-full rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold";
const labelClass = "mb-1.5 block text-xs uppercase tracking-wide text-car-muted";

export function VehiculoForm({
  action,
  vehiculo,
}: {
  action: (formData: FormData) => Promise<void>;
  vehiculo?: Vehiculo;
}) {
  const imagenesStr = vehiculo?.imagenes?.join("\n") ?? "";

  return (
    <form action={action} className="max-w-2xl space-y-5 rounded-lg border border-white/10 bg-car-gray p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Nombre completo *</label>
          <input name="nombre" defaultValue={vehiculo?.nombre} required className={inputClass} placeholder="VW Amarok V6 Extreme" />
        </div>
        <div>
          <label className={labelClass}>Marca *</label>
          <input name="marca" defaultValue={vehiculo?.marca} required className={inputClass} placeholder="Volkswagen" />
        </div>
        <div>
          <label className={labelClass}>Modelo *</label>
          <input name="modelo" defaultValue={vehiculo?.modelo} required className={inputClass} placeholder="Amarok V6 Extreme" />
        </div>
        <div>
          <label className={labelClass}>Año *</label>
          <input name="anio" type="number" defaultValue={vehiculo?.anio} required className={inputClass} placeholder="2025" />
        </div>
        <div>
          <label className={labelClass}>Kilometraje</label>
          <input name="kilometraje" defaultValue={vehiculo?.kilometraje ?? "Consultá km"} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Combustible *</label>
          <select name="combustible" defaultValue={vehiculo?.combustible ?? "Nafta"} required className={inputClass}>
            {["Nafta", "Diesel", "Híbrido", "Eléctrico", "GNC"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Transmisión *</label>
          <select name="transmision" defaultValue={vehiculo?.transmision ?? "Manual"} required className={inputClass}>
            <option value="Manual">Manual</option>
            <option value="Automático">Automático</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Motor</label>
          <input name="motor" defaultValue={vehiculo?.motor ?? ""} className={inputClass} placeholder="V6 3.0" />
        </div>
        <div>
          <label className={labelClass}>Tipo</label>
          <select name="tipo" defaultValue={vehiculo?.tipo ?? ""} className={inputClass}>
            <option value="">— Sin especificar —</option>
            {["Sedán", "Hatchback", "SUV", "Pick-up", "Camioneta", "Moto", "Utilitario"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Precio</label>
          <input name="precio_texto" defaultValue={vehiculo?.precio_texto ?? "Consultá precio"} className={inputClass} placeholder="Consultá precio" />
        </div>
        <div>
          <label className={labelClass}>Estado</label>
          <select name="estado" defaultValue={vehiculo?.estado ?? "disponible"} className={inputClass}>
            <option value="disponible">Disponible</option>
            <option value="vendido">Vendido</option>
          </select>
        </div>
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
      <div>
        <label className={labelClass}>Descripción</label>
        <textarea name="descripcion" defaultValue={vehiculo?.descripcion ?? ""} rows={4} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>URLs de imágenes (una por línea — la primera es la principal)</label>
        <textarea name="imagenes" defaultValue={imagenesStr} rows={4} className={inputClass}
          placeholder={"https://ejemplo.com/foto1.jpg\nhttps://ejemplo.com/foto2.jpg"} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="rounded bg-car-gold px-6 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark">
          Guardar vehículo
        </button>
        <a href="/admin/vehiculos" className="rounded border border-white/15 px-6 py-3 text-sm text-car-muted transition hover:text-car-white">
          Cancelar
        </a>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Escribir src/app/admin/vehiculos/[id]/editar/page.tsx**

```typescript
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { getVehiculoById } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";
import { updateVehiculo } from "../../form-actions";
import { VehiculoForm } from "../../vehiculo-form";

export const dynamic = "force-dynamic";

export default async function EditarVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  const vehiculo = await getVehiculoById(id);
  if (!vehiculo) notFound();

  const updateWithId = updateVehiculo.bind(null, id);

  return (
    <AdminShell>
      <h1 className="mb-6 font-condensed text-3xl font-black italic text-car-white">Editar vehículo</h1>
      <VehiculoForm action={updateWithId} vehiculo={vehiculo} />
    </AdminShell>
  );
}
```

- [ ] **Step 5: Build final y verificación**

```bash
npm run build
```

Expected: Build exitoso sin errores de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/vehiculos/
git commit -m "feat: add admin create/edit vehicle forms"
```

---

## Self-Review

**Spec coverage:**
- ✅ Identidad visual dark/gold con Barlow Condensed
- ✅ Tabla `vehiculos` con todos los campos del spec
- ✅ Páginas públicas: `/`, `/catalogo`, `/vehiculos/[slug]`
- ✅ Panel admin: login, dashboard, listado, crear, editar
- ✅ Toggle disponible ↔ vendido desde el listado
- ✅ Soft delete
- ✅ Middleware protege `/admin/*`
- ✅ Sección "Vendidos" en home en escala de grises
- ✅ WhatsApp con número real `5493537662444` y mensajes contextuales
- ✅ 404 personalizada
- ✅ Filtros en catálogo por marca/tipo/combustible
- ✅ VehicleCard con badge y specs pills
- ✅ FloatingWhatsApp

**Placeholders:** Ninguno encontrado.

**Tipos consistentes:** `Vehiculo` definido en Task 2 y usado uniformemente. `buildWhatsAppUrl(nombre, anio, context)` consistente en Tasks 3, 5, 8. `toggleEstado.bind(null, v.id, v.estado)` consistente entre actions y page.
