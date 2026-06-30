# Posse Automotores — Diseño del sitio Next.js + Admin

**Fecha:** 2026-06-30  
**Proyecto:** Posse Automotores  
**Ubicación:** `C:\Users\bauti\OneDrive\Desktop\PROYECTOS DE MUESTRA\autoss\posse-automotores`

---

## Objetivo

Convertir el sitio HTML/CSS estático de Posse Automotores en una aplicación Next.js 15 + Supabase con panel admin para gestionar el stock de vehículos. Se mantiene la identidad visual (negro/dorado, Barlow Condensed) pero el código se reescribe con Tailwind CSS para mayor mantenibilidad.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Base de datos:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Estilos:** Tailwind CSS
- **Fuentes:** Barlow Condensed + Barlow (Google Fonts)
- **Deploy:** Netlify

---

## Identidad Visual

| Token | Valor |
|-------|-------|
| Fondo principal | `#0d0d12` |
| Fondo secundario | `#141824` |
| Fondo tarjetas | `#1e2434` |
| Acento dorado | `#C9A227` |
| Dorado oscuro | `#a8881f` |
| Texto principal | `#EEF2FF` |
| Texto muted | `#7a8aaa` |

Tema: 100% dark. Sin versión clara.

---

## Base de Datos

### Tabla: `vehiculos`

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid | PK, auto |
| `slug` | text unique | URL amigable |
| `nombre` | text | Ej: "VW Amarok V6 Extreme" |
| `marca` | text | Ej: "Volkswagen" |
| `modelo` | text | Ej: "Amarok V6 Extreme" |
| `anio` | integer | Ej: 2025 |
| `kilometraje` | text | "30.000 km" o "Consultá km" |
| `combustible` | text | "Nafta" / "Diesel" / "Híbrido" |
| `transmision` | text | "Manual" / "Automático" |
| `motor` | text | Ej: "V6 3.0" |
| `tipo` | text | "Sedán" / "Pick-up" / "Hatchback" / "SUV" / "Moto" |
| `descripcion` | text | Texto largo |
| `precio_texto` | text | "Consultá precio" o "$45.000.000" |
| `cover_image_url` | text | URL imagen principal |
| `imagenes` | text[] | Array de URLs para galería |
| `estado` | text | `disponible` / `vendido` |
| `badge` | text | "Nuevo ingreso" / "Destacado" / null |
| `created_at` | timestamptz | Auto |
| `deleted_at` | timestamptz | Soft delete (null = activo) |

---

## Páginas Públicas

### `/` — Home
- **Hero:** imagen de fondo (frente del local), logo POSSE AUTOMOTORES en Barlow Condensed italic, slogan, botones "Ver catálogo" + "Consultanos por WhatsApp"
- **Strip de confianza:** 4 ítems (Financiación · Garantía · Presencia local · 4.9★ Google)
- **Vehículos destacados:** 3 cards con `badge = 'Destacado'` o los 3 más recientes disponibles
- **Nosotros:** texto + stats (4.9★, +300 clientes, 0km y usados)
- **Por qué elegirnos:** grid de 4 cards (Financiación, Garantía, Trámites, Atención)
- **Vendidos:** sección con vehículos en `estado = 'vendido'` en escala de grises + badge "Vendido"
- **Contacto:** horarios + links de contacto + iframe Google Maps

### `/catalogo` — Catálogo completo
- Solo vehículos con `estado = 'disponible'`
- Filtros por: marca, tipo, combustible, transmisión
- Buscador por nombre/modelo
- Grid de VehicleCards

### `/vehiculos/[slug]` — Ficha de vehículo
- Galería de imágenes
- Specs completas (año, km, combustible, transmisión, motor, tipo)
- Descripción larga
- Sidebar sticky: precio + botón WhatsApp con mensaje pre-armado
- Solo accesible si `estado = 'disponible'` y `deleted_at IS NULL`

### `not-found.tsx` — 404 personalizada
- Diseño dark con mensaje y link al catálogo

---

## Panel Admin

### Protección
- Middleware de Next.js protege todas las rutas `/admin/*`
- Redirige a `/admin/login` si no hay sesión válida

### Rutas

| Ruta | Descripción |
|------|-------------|
| `/admin/login` | Login con email/contraseña via Supabase Auth |
| `/admin` | Dashboard: contadores (total, disponibles, vendidos) |
| `/admin/vehiculos` | Tabla con todos los vehículos + estado + acciones |
| `/admin/vehiculos/nuevo` | Formulario para crear vehículo |
| `/admin/vehiculos/[id]/editar` | Formulario para editar vehículo |

### Funcionalidades del admin
- Crear / editar / eliminar (soft delete) vehículos
- Toggle rápido disponible ↔ vendido desde el listado
- Subida de imágenes a Supabase Storage
- Formulario con todos los campos de la tabla `vehiculos`

---

## Componentes Principales

### `VehicleCard`
- Fondo `#141824`, borde con acento dorado al hover
- Badge posicionado sobre la imagen (arriba izquierda)
- Imagen 16:9
- Nombre en Barlow Condensed italic bold
- Pills de specs: combustible · transmisión · tipo
- Precio en dorado
- Botón WhatsApp verde con mensaje pre-armado por vehículo

### `SiteHeader`
- Fondo `rgba(13,13,18,0.92)` con blur, sticky
- Logo POSSE AUTOMOTORES en Barlow Condensed italic
- Links: Nosotros · Vehículos · Por qué elegirnos · Contacto
- CTA WhatsApp en dorado
- Hamburger en mobile

### `SiteFooter`
- Fondo `#070709`
- Logo + texto de copyright
- Links rápidos

### `FloatingWhatsApp`
- Botón circular verde fijo bottom-right
- Label "Consultanos" al hover
- Animación de pulso

### `AdminShell`
- Reutiliza el patrón de Nuevo Rumbo adaptado a vehículos

---

## WhatsApp

**Número:** `5493537662444` (ya en el HTML actual)

**Mensajes pre-armados por contexto:**
- Home/Header: `Hola, quiero consultar un vehículo`
- Card de vehículo: `Hola, quiero consultar el {nombre} {anio}`
- Ficha de vehículo: `Hola, me interesa el {nombre} {anio}, ¿está disponible?`

---

## Datos Iniciales

Los 5 vehículos del `vehiculos.json` existente se cargan manualmente desde el admin al arrancar:
- VW Amarok V6 Extreme 2025
- Toyota Corolla XEI 2011
- VW Vento 2.5 AT 2014
- Fiat Punto 1.4 2012
- Renault Clio 1.2 2007
