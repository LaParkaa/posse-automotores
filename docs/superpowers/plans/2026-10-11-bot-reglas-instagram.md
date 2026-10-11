# Bot de Instagram por reglas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la capa de IA del bot de Instagram por un motor de conversacion por reglas (sin modelo), que entiende palabras clave coloquiales, identifica el auto de las respuestas a historias, muestra tarjetas con imagen del catalogo, cierra por WhatsApp con Nati, se calla cuando el dueño contesta a mano y suena humano.

**Architecture:** Un motor puro `conversar()` (sin red ni base de datos) recibe el mensaje, la sesion y el catalogo y devuelve mensajes, la sesion nueva y efectos (lead, aprendizaje de historia). Un `handler` con dependencias inyectadas orquesta: deduplicar, pausa humana, cargar sesion/catalogo, llamar al motor, aplicar efectos y enviar (visto, escribiendo, texto, tarjetas con respaldo en texto). La persistencia vive en Supabase (`ig_sesiones`, `ig_historias`, `ig_mensajes`). El webhook, la firma, el dedupe y los leads se reutilizan.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase, Vitest. Sin modelos de IA ni servicios externos aparte de Supabase y la Graph API de Meta.

Spec: `docs/superpowers/specs/2026-10-11-bot-reglas-instagram-design.md` (leerlo antes de empezar).

## Global Constraints

- **Cero IA con modelo**: ningun `fetch` a proveedores de IA, ninguna dependencia de IA. Solo Supabase y la Graph API (`https://graph.facebook.com/v21.0/me/messages`; token en el header `Authorization: Bearer`, nunca en la URL ni en un log).
- Con firma valida el `POST` del webhook **siempre** responde 200 (salvo JSON invalido: 400). Firma invalida: 401.
- El bot **nunca inventa datos**: autos, precios y datos del negocio salen del catalogo (`vehiculos_posse`) o de `negocio.ts`. Dato ausente → "lo confirma Nati" + boton de WhatsApp.
- Catalogo: tabla `vehiculos_posse`, `deleted_at is null`; estados `disponible`, `reservado`, `vendido`. Solo columnas publicas (nunca `sale_price`, `sale_notes`, `sold_at`). Sin fallback a datos locales de `src/lib/data.ts`.
- Mensajes de texto de Instagram: maximo **1000 bytes** UTF-8 por mensaje (ya resuelto por `partirTexto`). Tarjetas: hasta 10 elementos, titulo ≤ 80, subtitulo ≤ 80, hasta 3 botones, titulo de boton ≤ 20 caracteres, solo botones de enlace (`web_url`).
- WhatsApp del local (Nati): `5493537558947` (visible: `+54 9 3537 55-8947`); una sola fuente: la constante `WHATSAPP_LOCAL` de `src/lib/utils.ts`.
- Tono: español rioplatense coloquial, 1-3 emojis por mensaje, ≤ 5 lineas, sin markdown, sin formulas corporativas ("estimado", "le informamos", "a la brevedad", "su consulta"). **No finge ser una persona**: si le preguntan si es un bot, responde que es el asistente virtual y ofrece a Nati.
- Maximo 3 mensajes (texto o tarjetas) por turno. Tiempo total de "escribiendo..." por turno ≤ 3 s.
- Variables de entorno: `IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `PAGE_ACCESS_TOKEN`, `SITE_URL`. Ya **no** se usan `ANTHROPIC_API_KEY` ni `LLM_*`.
- Estilo: identificadores y comentarios en español, comentarios que explican el porque; imports relativos dentro de `src/lib`, alias `@/` en `src/app`. Tests Vitest en `src/**/*.test.ts`. TDD.
- `whatsapp-bot/` no se toca. Nunca `git add -A`: stagear solo los archivos de la tarea.
- Commits: trailer exacto `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Estado de partida de la rama

La rama `feat/bot-instagram` ya tiene el webhook, la firma, `graph.ts`, `payload.ts`, `conversations.ts` (dedupe), `leads.ts`, y una capa de IA (`ai.ts`, `prompt.ts`, `stock.ts`, `handler.ts`, `deps.ts`) que **esta tarea reemplaza**. Para mantener la suite en verde entre tareas, las Tasks 1-10 son **aditivas** (modulos nuevos o funciones nuevas junto a las viejas); la Task 11 reemplaza `handler`/`deps`/ruta y la Task 12 elimina lo viejo.

## Estructura de archivos

| Archivo | Tarea | Responsabilidad |
|---|---|---|
| `src/lib/bot/types.ts` | 1 | Tipos compartidos (se agregan los del catalogo y mensajes de salida) |
| `src/lib/bot/negocio.ts` | 1 | Datos del negocio editables (`NEGOCIO`) |
| `src/lib/bot/sesion.ts` | 1 | Tipo `Sesion`, creacion, vigencia, lectura defensiva |
| `src/lib/bot/__fixtures__/catalogo.ts`, `tono.ts` | 1 | Catalogo de ejemplo y verificador de tono para tests |
| `src/lib/utils.ts` | 1 | `WHATSAPP_LOCAL` y link de WhatsApp con origen Instagram |
| `supabase/schema-instagram-reglas.sql` | 1 | `ig_sesiones`, `ig_historias`, `ig_mensajes.nota` |
| `src/lib/instagram/payload.ts` | 2 | `extraerEventos` (mensajes con historia/adjuntos y ecos) |
| `src/lib/instagram/graph.ts` | 3 | Envio con `message_id`, tarjetas, acciones, perfil |
| `src/lib/bot/nlu/normalizar.ts` | 4 | Normalizacion, tokens, emojis, distancia de edicion |
| `src/lib/bot/nlu/vocabulario.ts` | 4 | Diccionarios (tipos, combustibles, transmision, marcas) |
| `src/lib/bot/nlu/intenciones.ts` | 5 | `detectarIntenciones` |
| `src/lib/bot/nlu/entidades.ts` | 6 | `extraerEntidades` |
| `src/lib/bot/busqueda.ts` | 7 | Buscar, relajar filtros, similares, recientes |
| `src/lib/bot/respuestas.ts` | 8 | Helpers de formato: precio, links, tarjetas, variantes |
| `src/lib/bot/motor.ts` | 9 | `conversar()` (maquina de estados) + conversaciones doradas |
| `src/lib/bot/catalogo.ts`, `sesiones.ts`, `conversations.ts` | 10 | Persistencia en Supabase |
| `src/lib/bot/handler.ts`, `deps.ts`, `src/app/api/instagram/webhook/route.ts` | 11 | Orquestacion y cableado |
| (eliminaciones) | 12 | Limpieza de la capa de IA |

---

### Task 1: Tipos base, datos del negocio, sesion, link de WhatsApp y migracion

**Files:**
- Modify: `src/lib/bot/types.ts`
- Create: `src/lib/bot/negocio.ts`, `src/lib/bot/negocio.test.ts`
- Create: `src/lib/bot/sesion.ts`, `src/lib/bot/sesion.test.ts`
- Create: `src/lib/bot/__fixtures__/catalogo.ts`, `src/lib/bot/__fixtures__/tono.ts`
- Modify: `src/lib/utils.ts`, `src/lib/utils.test.ts`
- Create: `supabase/schema-instagram-reglas.sql`

**Interfaces:**
- Produces (`types.ts`): `EstadoVehiculo`, `VehiculoCatalogo`, `Boton`, `Tarjeta`, `MensajeSalida`, `Perfil`.
- Produces (`negocio.ts`): `type Negocio`, `NEGOCIO`.
- Produces (`sesion.ts`): `Paso`, `Oferta`, `Filtros`, `Sesion`, `sesionNueva(ahora)`, `sesionVigente(sesion, ahora, horas?)`, `normalizarSesion(raw, ahora)`.
- Produces (`utils.ts`): `WHATSAPP_LOCAL`, `buildWhatsAppUrlInstagram(vehiculo | null)`.
- Produces (fixtures): `CATALOGO: VehiculoCatalogo[]`, `violacionesDeTono(texto): string[]`.

- [ ] **Step 1: Tipos compartidos**

Append to `src/lib/bot/types.ts` (deja intactos `TurnoHistorial`, `LeadInput`, `RespuestaIA`: se eliminan en la Task 12):

```ts
export type EstadoVehiculo = "disponible" | "reservado" | "vendido";

/** Vehiculo tal como lo ve el bot: solo columnas publicas de vehiculos_posse. */
export type VehiculoCatalogo = {
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
  estado: EstadoVehiculo;
  created_at: string;
};

export type Boton = { titulo: string; url: string };

export type Tarjeta = {
  titulo: string;
  subtitulo: string;
  imagenUrl: string | null;
  botones: Boton[];
};

/** Lo que el motor le pide al handler que envie. */
export type MensajeSalida =
  | { tipo: "texto"; texto: string }
  // `alternativaTexto` se manda si Instagram rechaza la tarjeta (formato de imagen, etc.).
  | { tipo: "tarjetas"; tarjetas: Tarjeta[]; alternativaTexto: string };

export type Perfil = { nombre?: string; usuario?: string };
```

- [ ] **Step 2: Link de WhatsApp con origen Instagram — tests primero**

Append to `src/lib/utils.test.ts` (importar `buildWhatsAppUrlInstagram` y `WHATSAPP_LOCAL` junto a lo que ya se importa de `./utils`):

```ts
describe("buildWhatsAppUrlInstagram", () => {
  it("arma el link al WhatsApp del local con el mensaje de un auto desde Instagram", () => {
    const url = buildWhatsAppUrlInstagram({ nombre: "Peugeot 206 1.6", tipo: "Hatchback" });

    expect(url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram 📲. Me interesa el Peugeot 206 1.6 🚗. ¿Sigue disponible?",
    );
  });

  it("usa 'la' y la moto para las motos", () => {
    const url = buildWhatsAppUrlInstagram({ nombre: "Honda XR 150", tipo: "Moto" });

    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram 📲. Me interesa la Honda XR 150 🏍️. ¿Sigue disponible?",
    );
  });

  it("sin auto manda una consulta general", () => {
    const url = buildWhatsAppUrlInstagram(null);

    expect(decodeURIComponent(url.split("?text=")[1])).toBe(
      "Hola, te escribo desde Instagram 📲. Quiero consultar por un vehículo.",
    );
  });

  it("el numero compartido es el de Nati", () => {
    expect(WHATSAPP_LOCAL).toBe("5493537558947");
  });
});
```

Run: `npx vitest run src/lib/utils.test.ts` → Expected: FAIL (no existen los exports).

- [ ] **Step 3: Implementar el link**

En `src/lib/utils.ts`: agregar la constante arriba, hacer que `buildWhatsAppUrl` la use (el resultado no cambia) y agregar la funcion nueva. Reemplazar `const base = "https://wa.me/5493537558947?text=";` por `const base = \`https://wa.me/${WHATSAPP_LOCAL}?text=\`;` y agregar:

```ts
/** Unica fuente del numero de WhatsApp del local (Nati). */
export const WHATSAPP_LOCAL = "5493537558947";

/**
 * Link de WhatsApp para el cierre desde Instagram. El mensaje dice de donde viene y por que
 * auto, asi quien atiende el WhatsApp no tiene que preguntar.
 */
export function buildWhatsAppUrlInstagram(
  vehiculo: Pick<Vehiculo, "nombre" | "tipo"> | null,
): string {
  const base = `https://wa.me/${WHATSAPP_LOCAL}?text=`;
  if (!vehiculo) {
    return base + encodeURIComponent("Hola, te escribo desde Instagram 📲. Quiero consultar por un vehículo.");
  }
  const esMoto = vehiculo.tipo === "Moto";
  const articulo = esMoto ? "la" : "el";
  const emoji = esMoto ? "🏍️" : "🚗";
  return (
    base +
    encodeURIComponent(
      `Hola, te escribo desde Instagram 📲. Me interesa ${articulo} ${vehiculo.nombre} ${emoji}. ¿Sigue disponible?`,
    )
  );
}
```

Run: `npx vitest run src/lib/utils.test.ts` → Expected: PASS (los tests viejos y los nuevos).

- [ ] **Step 4: Datos del negocio — test primero**

Create `src/lib/bot/negocio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WHATSAPP_LOCAL } from "../utils";
import { NEGOCIO } from "./negocio";

describe("NEGOCIO", () => {
  it("usa el numero de WhatsApp compartido, solo digitos con codigo de pais", () => {
    expect(NEGOCIO.whatsappNumero).toBe(WHATSAPP_LOCAL);
    expect(NEGOCIO.whatsappNumero).toMatch(/^\d{11,15}$/);
  });

  it("tiene el nombre de la secretaria y el numero visible", () => {
    expect(NEGOCIO.secretaria).toBe("Nati");
    expect(NEGOCIO.whatsappVisible).toBe("+54 9 3537 55-8947");
  });

  it("los datos no confirmados son null (el bot dice que Nati los confirma)", () => {
    expect(NEGOCIO.horarios).toBeNull();
    expect(NEGOCIO.direccion).toBeNull();
  });

  it("la pausa cuando contesta una persona es de horas positivas", () => {
    expect(NEGOCIO.pausaHumanoHoras).toBeGreaterThan(0);
  });
});
```

Create `src/lib/bot/negocio.ts`:

```ts
import { WHATSAPP_LOCAL } from "../utils";

/**
 * Datos del negocio que el bot puede decir. UNICO archivo a editar para cambiarlos.
 * `null` = pendiente de confirmar: el bot NO inventa, responde que lo confirma la secretaria
 * y manda el boton de WhatsApp.
 */
export type Negocio = {
  nombre: string;
  ciudad: string;
  secretaria: string;
  whatsappNumero: string;
  whatsappVisible: string;
  horarios: string | null;
  direccion: string | null;
  financiacion: string | null;
  permutas: string | null;
  pagos: string | null;
  garantia: string | null;
  documentacion: string | null;
  /** Horas que el bot se calla en un chat cuando contesta una persona desde la cuenta. */
  pausaHumanoHoras: number;
};

export const NEGOCIO: Negocio = {
  nombre: "Posse Automotores",
  ciudad: "Justiniano Posse, Córdoba",
  secretaria: "Nati",
  whatsappNumero: WHATSAPP_LOCAL,
  whatsappVisible: "+54 9 3537 55-8947",

  // PENDIENTE: completar con los horarios reales. Mientras sea null, el bot dice que los confirma Nati.
  horarios: null,
  // PENDIENTE: direccion exacta (hoy solo se sabe la ciudad).
  direccion: null,

  // Tomado de las respuestas del bot de WhatsApp anterior: CONFIRMAR que siguen vigentes.
  financiacion: "Trabajamos con financiación bancaria y propia. Las condiciones dependen del auto, te las pasa Nati.",
  permutas: "Tomamos tu usado como parte de pago: lo tasamos en el local.",
  pagos: "Efectivo, transferencia bancaria y financiación.",
  garantia: "Todos los vehículos tienen garantía legal y verificación previa.",
  documentacion: "Para comprar: DNI. Para financiar, además, comprobante de ingresos.",

  pausaHumanoHoras: 6,
};
```

Run: `npx vitest run src/lib/bot/negocio.test.ts` → PASS.

- [ ] **Step 5: Sesion — test primero**

Create `src/lib/bot/sesion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizarSesion, sesionNueva, sesionVigente } from "./sesion";

const AHORA = new Date("2026-10-11T15:00:00Z");

describe("sesionNueva", () => {
  it("arranca libre, sin contexto y con la fecha de ahora", () => {
    const s = sesionNueva(AHORA);

    expect(s.paso).toBe("libre");
    expect(s.filtros).toEqual({});
    expect(s.vehiculoActualId).toBeNull();
    expect(s.historiaActualId).toBeNull();
    expect(s.mostradosIds).toEqual([]);
    expect(s.vistosIds).toEqual([]);
    expect(s.lead).toEqual({});
    expect(s.preguntaPendiente).toBeNull();
    expect(s.historiaPendienteId).toBeNull();
    expect(s.ofrecio).toBeNull();
    expect(s.fallos).toBe(0);
    expect(s.saludado).toBe(false);
    expect(s.ultimaActividad).toBe(AHORA.toISOString());
  });
});

describe("sesionVigente", () => {
  it("es vigente dentro de las 24 h y vencida despues", () => {
    const s = sesionNueva(new Date("2026-10-10T16:00:00Z"));

    expect(sesionVigente(s, AHORA)).toBe(true); // 23 h
    expect(sesionVigente(s, new Date("2026-10-11T17:00:00Z"))).toBe(false); // 25 h
  });

  it("acepta otra vigencia en horas", () => {
    const s = sesionNueva(new Date("2026-10-11T10:00:00Z"));

    expect(sesionVigente(s, AHORA, 4)).toBe(false); // 5 h > 4 h
    expect(sesionVigente(s, AHORA, 6)).toBe(true);
  });
});

describe("normalizarSesion", () => {
  it("devuelve una sesion nueva si lo guardado no es un objeto valido", () => {
    for (const basura of [null, undefined, "x", 3, [], {}]) {
      expect(normalizarSesion(basura, AHORA)).toEqual(sesionNueva(AHORA));
    }
  });

  it("conserva los campos validos y completa los que faltan", () => {
    const s = normalizarSesion(
      { paso: "pidiendo_telefono", vehiculoActualId: "v-206", saludado: true, ultimaActividad: AHORA.toISOString() },
      AHORA,
    );

    expect(s.paso).toBe("pidiendo_telefono");
    expect(s.vehiculoActualId).toBe("v-206");
    expect(s.saludado).toBe(true);
    expect(s.mostradosIds).toEqual([]);
    expect(s.fallos).toBe(0);
  });

  it("descarta valores de tipo equivocado", () => {
    const s = normalizarSesion({ paso: "inventado", fallos: "mucho", mostradosIds: "no" }, AHORA);

    expect(s.paso).toBe("libre");
    expect(s.fallos).toBe(0);
    expect(s.mostradosIds).toEqual([]);
  });
});
```

Run: `npx vitest run src/lib/bot/sesion.test.ts` → FAIL (modulo inexistente).

Create `src/lib/bot/sesion.ts`:

```ts
export type Paso = "libre" | "pidiendo_nombre" | "pidiendo_telefono" | "eligiendo_historia";

/** Lo ultimo que ofrecio el bot: un "si" del cliente se interpreta segun esto. */
export type Oferta = "contacto" | "mas" | "aviso";

export type Filtros = {
  /** Marca tal cual figura en el catalogo (ej. "Peugeot"). */
  marca?: string;
  /** Claves de tipo normalizadas (ej. ["pickup"]). Varias para palabras como "camioneta". */
  tipos?: string[];
  combustible?: string;
  transmision?: string;
  anio?: number;
};

export type Sesion = {
  paso: Paso;
  filtros: Filtros;
  /** Auto del que se esta hablando ("ese", "cuanto sale?"). */
  vehiculoActualId: string | null;
  /** Historia que origino `vehiculoActualId`; sirve para olvidarla si dice "no es ese". */
  historiaActualId: string | null;
  /** Autos del ultimo listado, en orden (para "el segundo"). */
  mostradosIds: string[];
  /** Todos los ya mostrados en la busqueda actual (para "ver mas" sin repetir). */
  vistosIds: string[];
  lead: { nombre?: string; telefono?: string; vehiculoInteres?: string; motivo?: string };
  /** Pregunta del cliente que quedo sin responder mientras se identifica la historia. */
  preguntaPendiente: string | null;
  historiaPendienteId: string | null;
  ofrecio: Oferta | null;
  /** Mensajes seguidos que el bot no entendio. */
  fallos: number;
  saludado: boolean;
  ultimaActividad: string;
};

const PASOS: Paso[] = ["libre", "pidiendo_nombre", "pidiendo_telefono", "eligiendo_historia"];
const OFERTAS: Oferta[] = ["contacto", "mas", "aviso"];

export function sesionNueva(ahora: Date): Sesion {
  return {
    paso: "libre",
    filtros: {},
    vehiculoActualId: null,
    historiaActualId: null,
    mostradosIds: [],
    vistosIds: [],
    lead: {},
    preguntaPendiente: null,
    historiaPendienteId: null,
    ofrecio: null,
    fallos: 0,
    saludado: false,
    ultimaActividad: ahora.toISOString(),
  };
}

/** Pasadas `horas` sin actividad el contexto se reinicia (el cliente vuelve por otra cosa). */
export function sesionVigente(sesion: Sesion, ahora: Date, horas = 24): boolean {
  const ultima = Date.parse(sesion.ultimaActividad);
  if (Number.isNaN(ultima)) return false;
  return ahora.getTime() - ultima <= horas * 60 * 60 * 1000;
}

const esTexto = (v: unknown): v is string => typeof v === "string";
const textoONulo = (v: unknown): string | null => (esTexto(v) ? v : null);
const listaDeTextos = (v: unknown): string[] => (Array.isArray(v) ? v.filter(esTexto) : []);

/** Lee lo guardado en la base (jsonb) sin confiar en su forma: lo invalido se descarta. */
export function normalizarSesion(crudo: unknown, ahora: Date): Sesion {
  const base = sesionNueva(ahora);
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return base;
  const c = crudo as Record<string, unknown>;

  const lead = typeof c.lead === "object" && c.lead !== null && !Array.isArray(c.lead) ? (c.lead as Record<string, unknown>) : {};
  const filtros =
    typeof c.filtros === "object" && c.filtros !== null && !Array.isArray(c.filtros)
      ? (c.filtros as Record<string, unknown>)
      : {};

  return {
    paso: PASOS.includes(c.paso as Paso) ? (c.paso as Paso) : base.paso,
    filtros: {
      ...(esTexto(filtros.marca) ? { marca: filtros.marca } : {}),
      ...(Array.isArray(filtros.tipos) ? { tipos: listaDeTextos(filtros.tipos) } : {}),
      ...(esTexto(filtros.combustible) ? { combustible: filtros.combustible } : {}),
      ...(esTexto(filtros.transmision) ? { transmision: filtros.transmision } : {}),
      ...(typeof filtros.anio === "number" ? { anio: filtros.anio } : {}),
    },
    vehiculoActualId: textoONulo(c.vehiculoActualId),
    historiaActualId: textoONulo(c.historiaActualId),
    mostradosIds: listaDeTextos(c.mostradosIds),
    vistosIds: listaDeTextos(c.vistosIds),
    lead: {
      ...(esTexto(lead.nombre) ? { nombre: lead.nombre } : {}),
      ...(esTexto(lead.telefono) ? { telefono: lead.telefono } : {}),
      ...(esTexto(lead.vehiculoInteres) ? { vehiculoInteres: lead.vehiculoInteres } : {}),
      ...(esTexto(lead.motivo) ? { motivo: lead.motivo } : {}),
    },
    preguntaPendiente: textoONulo(c.preguntaPendiente),
    historiaPendienteId: textoONulo(c.historiaPendienteId),
    ofrecio: OFERTAS.includes(c.ofrecio as Oferta) ? (c.ofrecio as Oferta) : null,
    fallos: typeof c.fallos === "number" ? c.fallos : 0,
    saludado: c.saludado === true,
    ultimaActividad: esTexto(c.ultimaActividad) ? c.ultimaActividad : base.ultimaActividad,
  };
}
```

Run: `npx vitest run src/lib/bot/sesion.test.ts` → PASS.

- [ ] **Step 6: Fixtures para los tests de las tareas siguientes**

Create `src/lib/bot/__fixtures__/catalogo.ts`:

```ts
import type { VehiculoCatalogo } from "../types";

type Parcial = Partial<VehiculoCatalogo> &
  Pick<VehiculoCatalogo, "id" | "slug" | "nombre" | "marca" | "modelo" | "anio" | "created_at">;

function auto(p: Parcial): VehiculoCatalogo {
  return {
    kilometraje: "Consultá km",
    combustible: "Nafta",
    transmision: "Manual",
    motor: null,
    tipo: "Hatchback",
    descripcion: null,
    precio_texto: "Consultá precio",
    cover_image_url: `https://img.example/${p.slug}.jpg`,
    estado: "disponible",
    ...p,
  };
}

/**
 * Catalogo de ejemplo para los tests. Orden de created_at (mas nuevo primero):
 * amarok, 206, 208, vento, kangoo, xr150 (reservada), partner (vendida), corolla.
 */
export const CATALOGO: VehiculoCatalogo[] = [
  auto({
    id: "v-206", slug: "peugeot-206-1-6-2011", nombre: "Peugeot 206 1.6", marca: "Peugeot", modelo: "206 1.6",
    anio: 2011, kilometraje: "177.000 km", motor: "1.6", precio_texto: "$9.500.000", created_at: "2026-10-05T10:00:00Z",
  }),
  auto({
    id: "v-208", slug: "peugeot-208-style-2023", nombre: "Peugeot 208 Style", marca: "Peugeot", modelo: "208 Style",
    anio: 2023, kilometraje: "48.000 km", motor: "1.6", precio_texto: "Consultá precio", created_at: "2026-10-04T10:00:00Z",
  }),
  auto({
    id: "v-vento", slug: "vw-vento-2-5-advance-2015", nombre: "Volkswagen Vento 2.5 Advance", marca: "Volkswagen",
    modelo: "Vento 2.5 Advance", anio: 2015, kilometraje: "130.000 km", transmision: "Automático", tipo: "Sedán",
    motor: "2.5", precio_texto: "USD 14.500", created_at: "2026-10-03T10:00:00Z",
  }),
  auto({
    id: "v-amarok", slug: "vw-amarok-v6-extreme-2025", nombre: "Volkswagen Amarok V6 Extreme", marca: "Volkswagen",
    modelo: "Amarok V6 Extreme", anio: 2025, kilometraje: "0 km", combustible: "Diésel", transmision: "Automático",
    tipo: "Pick-up", precio_texto: "USD 62.000", created_at: "2026-10-06T10:00:00Z",
  }),
  auto({
    id: "v-corolla", slug: "toyota-corolla-xei-2011", nombre: "Toyota Corolla XEI", marca: "Toyota", modelo: "Corolla XEI",
    anio: 2011, kilometraje: "180.000 km", tipo: "Sedán", motor: "1.8", precio_texto: "USD 9.500", created_at: "2026-09-15T10:00:00Z",
  }),
  auto({
    id: "v-partner", slug: "peugeot-partner-2014", nombre: "Peugeot Partner", marca: "Peugeot", modelo: "Partner",
    anio: 2014, kilometraje: "150.000 km", tipo: "Utilitario", estado: "vendido", created_at: "2026-09-20T10:00:00Z",
  }),
  auto({
    id: "v-kangoo", slug: "renault-kangoo-2016", nombre: "Renault Kangoo", marca: "Renault", modelo: "Kangoo",
    anio: 2016, kilometraje: "120.000 km", tipo: "Utilitario", precio_texto: "$11.000.000", created_at: "2026-10-02T10:00:00Z",
  }),
  auto({
    id: "v-xr150", slug: "honda-xr-150-2022", nombre: "Honda XR 150", marca: "Honda", modelo: "XR 150",
    anio: 2022, kilometraje: "12.000 km", tipo: "Moto", estado: "reservado", precio_texto: "$3.200.000", created_at: "2026-10-01T10:00:00Z",
  }),
];
```

Create `src/lib/bot/__fixtures__/tono.ts`:

```ts
const CORPORATIVO = /estimad|le informamos|a la brevedad|su consulta|quedamos a su disposici|lo saludamos/i;

/** Reglas de tono que TODO texto que mande el bot debe cumplir. Devuelve las que se violan. */
export function violacionesDeTono(texto: string): string[] {
  const v: string[] = [];
  if (new TextEncoder().encode(texto).length > 1000) v.push("supera 1000 bytes");
  if (texto.split("\n").filter((l) => l.trim() !== "").length > 5) v.push("mas de 5 lineas");
  if (/\*|`|^#/m.test(texto)) v.push("usa markdown");
  if (CORPORATIVO.test(texto)) v.push("usa formulas corporativas");
  return v;
}
```

- [ ] **Step 7: Migracion SQL**

Create `supabase/schema-instagram-reglas.sql`:

```sql
-- Bot de Instagram por reglas: estado de la conversacion y vinculo historia -> auto.
-- Correr en el SQL Editor de Supabase (proyecto de Posse), DESPUES de schema-instagram.sql.

-- Una fila por cliente de Instagram: contexto de la conversacion, pausa cuando contesta una
-- persona y perfil (nombre y @usuario) para saludar y para identificar los leads.
create table if not exists public.ig_sesiones (
  ig_user_id text primary key,
  estado jsonb not null default '{}'::jsonb,
  pausa_hasta timestamptz,
  perfil jsonb,
  actualizado timestamptz not null default now()
);

-- Vinculo "historia de Instagram -> auto". El bot lo aprende cuando un cliente confirma de
-- que auto era la historia; los siguientes clientes de esa historia se resuelven solos.
create table if not exists public.ig_historias (
  story_id text primary key,
  vehiculo_id uuid not null references public.vehiculos_posse(id) on delete cascade,
  confirmaciones integer not null default 1,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Sin politicas a proposito: solo la service_role key (que ignora RLS) accede.
alter table public.ig_sesiones enable row level security;
alter table public.ig_historias enable row level security;

-- Marca los mensajes que el bot no entendio ("no_entendido") para mejorar el diccionario.
alter table public.ig_mensajes add column if not exists nota text;
```

- [ ] **Step 8: Verificar y commitear**

Run: `npx vitest run` y `npx tsc --noEmit` → todo en verde.

```bash
git add src/lib/bot/types.ts src/lib/bot/negocio.ts src/lib/bot/negocio.test.ts src/lib/bot/sesion.ts src/lib/bot/sesion.test.ts src/lib/bot/__fixtures__/catalogo.ts src/lib/bot/__fixtures__/tono.ts src/lib/utils.ts src/lib/utils.test.ts supabase/schema-instagram-reglas.sql
git commit -m "feat: tipos, datos del negocio, sesion y link de WhatsApp de Instagram para el bot por reglas" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Eventos del webhook (historias, adjuntos y ecos)

**Files:**
- Modify: `src/lib/instagram/payload.ts`
- Modify: `src/lib/instagram/payload.test.ts`

**Interfaces:**
- Produces: `type EventoEntrante` y `extraerEventos(body: unknown): EventoEntrante[]`. Se mantienen `MensajeEntrante`/`extraerMensajes` hasta la Task 12.

```ts
export type EventoEntrante =
  | { tipo: "mensaje"; senderId: string; mid: string; texto: string | null; historiaId: string | null; adjuntos: string[] }
  | { tipo: "eco"; destinatarioId: string; mid: string };
```

- [ ] **Step 1: Tests que fallan**

Append to `src/lib/instagram/payload.test.ts` (importar `extraerEventos` junto a `extraerMensajes`):

```ts
describe("extraerEventos", () => {
  const evento = (message: Record<string, unknown>, sender = "111", recipient = "999") => ({
    sender: { id: sender },
    recipient: { id: recipient },
    timestamp: 1700000000000,
    message,
  });
  const webhook = (messaging: unknown[]) => ({ object: "instagram", entry: [{ id: "999", time: 1, messaging }] });

  it("extrae un mensaje de texto", () => {
    expect(extraerEventos(webhook([evento({ mid: "m1", text: "  Hola  " })]))).toEqual([
      { tipo: "mensaje", senderId: "111", mid: "m1", texto: "Hola", historiaId: null, adjuntos: [] },
    ]);
  });

  it("extrae el id de la historia cuando responde a una historia", () => {
    const body = webhook([
      evento({ mid: "m2", text: "me decis el precio?", reply_to: { story: { id: "st-1", url: "https://cdn/x" } } }),
    ]);

    expect(extraerEventos(body)[0]).toMatchObject({ tipo: "mensaje", texto: "me decis el precio?", historiaId: "st-1" });
  });

  it("devuelve los tipos de adjunto y texto null si solo hay adjunto", () => {
    const body = webhook([
      evento({ mid: "m3", attachments: [{ type: "audio", payload: { url: "https://cdn/a" } }] }),
      evento({ mid: "m4", attachments: [{ type: "image", payload: { url: "https://cdn/i" } }, { type: "ig_reel", payload: {} }] }),
    ]);

    expect(extraerEventos(body)).toEqual([
      { tipo: "mensaje", senderId: "111", mid: "m3", texto: null, historiaId: null, adjuntos: ["audio"] },
      { tipo: "mensaje", senderId: "111", mid: "m4", texto: null, historiaId: null, adjuntos: ["image", "ig_reel"] },
    ]);
  });

  it("conserva los ecos: el destinatario es el cliente", () => {
    const body = webhook([evento({ mid: "m5", text: "Hola, te cuento...", is_echo: true }, "999", "111")]);

    expect(extraerEventos(body)).toEqual([{ tipo: "eco", destinatarioId: "111", mid: "m5" }]);
  });

  it("ignora mensajes borrados, eventos sin mensaje y objetos que no son de Instagram", () => {
    expect(extraerEventos(webhook([evento({ mid: "m6", is_deleted: true })]))).toEqual([]);
    expect(extraerEventos(webhook([{ sender: { id: "1" }, read: { mid: "m" } }]))).toEqual([]);
    expect(extraerEventos({ object: "page", entry: [] })).toEqual([]);
  });

  it("descarta mensajes sin sender.id o sin mid, y tolera basura", () => {
    expect(extraerEventos(webhook([{ sender: {}, message: { mid: "m7", text: "x" } }]))).toEqual([]);
    expect(extraerEventos(webhook([evento({ text: "sin mid" })]))).toEqual([]);
    for (const basura of [null, undefined, "x", 3, [], {}, { object: "instagram" }, { object: "instagram", entry: [null, { messaging: "x" }] }]) {
      expect(extraerEventos(basura)).toEqual([]);
    }
  });

  it("descarta un eco sin destinatario", () => {
    const body = webhook([{ sender: { id: "999" }, message: { mid: "m8", is_echo: true, text: "x" } }]);

    expect(extraerEventos(body)).toEqual([]);
  });
});
```

Run: `npx vitest run src/lib/instagram/payload.test.ts` → FAIL (`extraerEventos` no existe).

- [ ] **Step 2: Implementar**

Add to `src/lib/instagram/payload.ts` (reusa `Objeto` y `esObjeto` que ya estan en el archivo; no tocar `extraerMensajes`):

```ts
export type EventoEntrante =
  | {
      tipo: "mensaje";
      senderId: string;
      mid: string;
      /** null cuando no trae texto (audio, foto, reel compartido...). */
      texto: string | null;
      /** Id de la historia cuando el mensaje es una respuesta a una historia. */
      historiaId: string | null;
      /** Tipos de adjunto tal como los manda Meta ("audio", "image", "ig_reel", "story_mention"...). */
      adjuntos: string[];
    }
  // Mensaje enviado DESDE la cuenta (por el bot o por una persona). Sirve para pausar el bot.
  | { tipo: "eco"; destinatarioId: string; mid: string };

function historiaDe(mensaje: Objeto): string | null {
  const respuestaA = mensaje.reply_to;
  if (!esObjeto(respuestaA) || !esObjeto(respuestaA.story)) return null;
  const id = respuestaA.story.id;
  return typeof id === "string" && id !== "" ? id : null;
}

function adjuntosDe(mensaje: Objeto): string[] {
  if (!Array.isArray(mensaje.attachments)) return [];
  return mensaje.attachments.flatMap((a) => (esObjeto(a) && typeof a.type === "string" ? [a.type] : []));
}

/**
 * Como `extraerMensajes`, pero conserva lo que el bot nuevo necesita: de que historia viene
 * el mensaje, que adjuntos trae y los ecos (que el bot viejo descartaba).
 */
export function extraerEventos(body: unknown): EventoEntrante[] {
  if (!esObjeto(body) || body.object !== "instagram" || !Array.isArray(body.entry)) return [];

  const eventos: EventoEntrante[] = [];

  for (const entry of body.entry) {
    if (!esObjeto(entry) || !Array.isArray(entry.messaging)) continue;

    for (const evento of entry.messaging) {
      if (!esObjeto(evento) || !esObjeto(evento.message)) continue;

      const { mid, text, is_echo: esEco, is_deleted: estaBorrado } = evento.message;
      if (typeof mid !== "string" || estaBorrado === true) continue;

      if (esEco === true) {
        const destinatario = esObjeto(evento.recipient) ? evento.recipient.id : undefined;
        if (typeof destinatario === "string") eventos.push({ tipo: "eco", destinatarioId: destinatario, mid });
        continue;
      }

      const senderId = esObjeto(evento.sender) ? evento.sender.id : undefined;
      if (typeof senderId !== "string") continue;

      eventos.push({
        tipo: "mensaje",
        senderId,
        mid,
        texto: typeof text === "string" && text.trim() !== "" ? text.trim() : null,
        historiaId: historiaDe(evento.message),
        adjuntos: adjuntosDe(evento.message),
      });
    }
  }

  return eventos;
}
```

Run: `npx vitest run src/lib/instagram/payload.test.ts` → PASS (viejos y nuevos). `npx tsc --noEmit` limpio.

- [ ] **Step 3: Commit**

```bash
git add src/lib/instagram/payload.ts src/lib/instagram/payload.test.ts
git commit -m "feat: extraer historias, adjuntos y ecos de los eventos del webhook" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Envio por Graph API (ids de mensaje, tarjetas, acciones y perfil)

**Files:**
- Modify: `src/lib/instagram/graph.ts`, `src/lib/instagram/graph.test.ts`
- Modify: `src/lib/bot/deps.ts` (solo el adaptador `enviar`, para mantener `tsc` limpio hasta la Task 11)

**Interfaces:**
- Consumes: `Tarjeta`, `Perfil` de `../bot/types`.
- Produces:
  - `enviarMensajeInstagram(destinatarioId, texto): Promise<string[]>` (ids de cada parte enviada).
  - `enviarTarjetas(destinatarioId, tarjetas: Tarjeta[]): Promise<string[]>`.
  - `enviarAccion(destinatarioId, accion: "mark_seen" | "typing_on"): Promise<boolean>` (mejor esfuerzo, nunca lanza).
  - `obtenerPerfil(igsid): Promise<Perfil | null>` (mejor esfuerzo, nunca lanza).

- [ ] **Step 1: Tests que fallan**

En `src/lib/instagram/graph.test.ts` agregar los imports nuevos (`enviarAccion`, `enviarTarjetas`, `obtenerPerfil`) y estos bloques. Reusan el patron de stubs de `fetch` que ya usa el archivo (`vi.stubGlobal("fetch", fetchMock)`, `vi.stubEnv("PAGE_ACCESS_TOKEN", ...)`):

```ts
describe("enviarMensajeInstagram devuelve los ids", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("devuelve el message_id de cada parte enviada", async () => {
    let n = 0;
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ recipient_id: "1", message_id: `m${++n}` }), { status: 200 }));
    const texto = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" ");

    const ids = await enviarMensajeInstagram("1", texto);

    expect(ids.length).toBeGreaterThan(1);
    expect(ids[0]).toBe("m1");
    expect(ids).toHaveLength(fetchMock.mock.calls.length);
  });

  it("si la respuesta no trae message_id no inventa uno", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));

    expect(await enviarMensajeInstagram("1", "Hola")).toEqual([]);
  });
});

describe("enviarTarjetas", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ message_id: "t1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const tarjeta = (n: number) => ({
    titulo: `Auto ${n}`,
    subtitulo: "180.000 km · Nafta",
    imagenUrl: `https://img.example/${n}.jpg`,
    botones: [
      { titulo: "Ver en la web", url: "https://posse.example/vehiculos/a" },
      { titulo: "Hablar con Nati", url: "https://wa.me/5493537558947?text=hola" },
    ],
  });

  it("manda una plantilla generica con imagen, titulo, subtitulo y botones de enlace", async () => {
    const ids = await enviarTarjetas("111", [tarjeta(1)]);

    expect(ids).toEqual(["t1"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/me/messages");
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
    expect(JSON.parse(init.body)).toEqual({
      recipient: { id: "111" },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: "Auto 1",
                subtitle: "180.000 km · Nafta",
                image_url: "https://img.example/1.jpg",
                buttons: [
                  { type: "web_url", url: "https://posse.example/vehiculos/a", title: "Ver en la web" },
                  { type: "web_url", url: "https://wa.me/5493537558947?text=hola", title: "Hablar con Nati" },
                ],
              },
            ],
          },
        },
      },
    });
  });

  it("omite image_url cuando no hay imagen", async () => {
    await enviarTarjetas("111", [{ ...tarjeta(1), imagenUrl: null }]);

    const elemento = JSON.parse(fetchMock.mock.calls[0][1].body).message.attachment.payload.elements[0];
    expect(elemento).not.toHaveProperty("image_url");
  });

  it("respeta los limites de Instagram: 10 elementos, 3 botones, textos recortados", async () => {
    const larga = { ...tarjeta(1), titulo: "T".repeat(120), subtitulo: "S".repeat(120), botones: Array.from({ length: 5 }, (_, i) => ({ titulo: "B".repeat(40), url: `https://x/${i}` })) };

    await enviarTarjetas("111", [larga, ...Array.from({ length: 14 }, (_, i) => tarjeta(i + 2))]);

    const elementos = JSON.parse(fetchMock.mock.calls[0][1].body).message.attachment.payload.elements;
    expect(elementos).toHaveLength(10);
    expect(elementos[0].title.length).toBeLessThanOrEqual(80);
    expect(elementos[0].subtitle.length).toBeLessThanOrEqual(80);
    expect(elementos[0].buttons).toHaveLength(3);
    expect(elementos[0].buttons[0].title.length).toBeLessThanOrEqual(20);
  });

  it("no manda nada si no hay tarjetas", async () => {
    expect(await enviarTarjetas("111", [])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lanza si la Graph API rechaza la tarjeta (el handler cae al texto)", async () => {
    fetchMock.mockImplementation(async () => new Response('{"error":{"message":"bad image"}}', { status: 400 }));

    await expect(enviarTarjetas("111", [tarjeta(1)])).rejects.toThrow(/Graph API 400/);
  });
});

describe("enviarAccion", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("manda sender_action y devuelve true", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));

    expect(await enviarAccion("111", "typing_on")).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ recipient: { id: "111" }, sender_action: "typing_on" });
  });

  it("nunca lanza: devuelve false si falla (son un adorno)", async () => {
    fetchMock.mockImplementation(async () => new Response("no", { status: 500 }));
    expect(await enviarAccion("111", "mark_seen")).toBe(false);

    fetchMock.mockImplementation(async () => {
      throw new Error("red caida");
    });
    expect(await enviarAccion("111", "mark_seen")).toBe(false);
  });
});

describe("obtenerPerfil", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("pide name y username con el token en el header y devuelve el perfil", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ name: " Juan Perez ", username: "juancenturion94" }), { status: 200 }));

    expect(await obtenerPerfil("111")).toEqual({ nombre: "Juan Perez", usuario: "juancenturion94" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/111?fields=name,username");
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
  });

  it("devuelve null si falla o no trae nada util (el bot sigue sin nombre)", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    expect(await obtenerPerfil("111")).toBeNull();

    fetchMock.mockImplementation(async () => new Response("no", { status: 403 }));
    expect(await obtenerPerfil("111")).toBeNull();

    fetchMock.mockImplementation(async () => {
      throw new Error("timeout");
    });
    expect(await obtenerPerfil("111")).toBeNull();
  });

  it("devuelve null sin token y no llama a la red", async () => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "");

    expect(await obtenerPerfil("111")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run src/lib/instagram/graph.test.ts` → FAIL.

- [ ] **Step 2: Implementar**

En `src/lib/instagram/graph.ts` dejar `GRAPH_URL`, `TIMEOUT_MS`, `MAX_BYTES_MENSAJE` y `partirTexto` como estan. Agregar `import type { Perfil, Tarjeta } from "../bot/types";` y reemplazar `enviarMensajeInstagram` por esto (+ funciones nuevas):

```ts
/** POST al endpoint de mensajes. Devuelve el message_id si Meta lo informa. Lanza si la API rechaza. */
async function postMensajes(cuerpo: unknown): Promise<string | null> {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("Falta la variable de entorno PAGE_ACCESS_TOKEN");

  const respuesta = await fetch(GRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`Graph API ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = (await respuesta.json().catch(() => null)) as { message_id?: unknown } | null;
  return typeof datos?.message_id === "string" ? datos.message_id : null;
}

/**
 * Envia un texto. Devuelve los message_id de cada parte: el bot los guarda para reconocer sus
 * propios mensajes cuando Meta los devuelve como "eco" (y no confundirlos con una persona).
 */
export async function enviarMensajeInstagram(destinatarioId: string, texto: string): Promise<string[]> {
  const ids: string[] = [];

  // En orden y de a uno: si se mandaran en paralelo podrian llegar desordenados.
  for (const parte of partirTexto(texto)) {
    const id = await postMensajes({ recipient: { id: destinatarioId }, message: { text: parte } });
    if (id) ids.push(id);
  }

  return ids;
}

function recortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

/** Tarjetas (plantilla generica): hasta 10 con imagen, titulo, subtitulo y 3 botones de enlace. */
export async function enviarTarjetas(destinatarioId: string, tarjetas: Tarjeta[]): Promise<string[]> {
  const elementos = tarjetas.slice(0, 10).map((t) => ({
    title: recortar(t.titulo, 80),
    subtitle: recortar(t.subtitulo, 80),
    ...(t.imagenUrl ? { image_url: t.imagenUrl } : {}),
    buttons: t.botones.slice(0, 3).map((b) => ({ type: "web_url", url: b.url, title: recortar(b.titulo, 20) })),
  }));
  if (elementos.length === 0) return [];

  const id = await postMensajes({
    recipient: { id: destinatarioId },
    message: { attachment: { type: "template", payload: { template_type: "generic", elements: elementos } } },
  });
  return id ? [id] : [];
}

/** "Visto" y "escribiendo...": son un detalle de trato, nunca deben romper la respuesta. */
export async function enviarAccion(destinatarioId: string, accion: "mark_seen" | "typing_on"): Promise<boolean> {
  try {
    await postMensajes({ recipient: { id: destinatarioId }, sender_action: accion });
    return true;
  } catch {
    return false;
  }
}

/** Nombre y @usuario del cliente (mejor esfuerzo: sin permiso o con error, el bot sigue sin nombre). */
export async function obtenerPerfil(igsid: string): Promise<Perfil | null> {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const respuesta = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(igsid)}?fields=name,username`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) },
    );
    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as { name?: unknown; username?: unknown };
    const nombre = typeof datos.name === "string" && datos.name.trim() !== "" ? datos.name.trim() : undefined;
    const usuario = typeof datos.username === "string" && datos.username.trim() !== "" ? datos.username.trim() : undefined;
    return nombre || usuario ? { nombre, usuario } : null;
  } catch {
    return null;
  }
}
```

Los tests viejos de `enviarMensajeInstagram` que comprueban "lanza si falta PAGE_ACCESS_TOKEN y no llama a la red" y "no manda nada si el texto esta vacio" siguen validos (el token se valida dentro de `postMensajes`, antes del `fetch`).

- [ ] **Step 3: Mantener `tsc` limpio**

`DepsBot.enviar` (handler viejo) espera `Promise<void>`. En `src/lib/bot/deps.ts` reemplazar `enviar: enviarMensajeInstagram,` por:

```ts
    enviar: async (senderId, texto) => {
      await enviarMensajeInstagram(senderId, texto);
    },
```

Run: `npx vitest run src/lib/instagram/graph.test.ts src/lib/bot` y `npx tsc --noEmit` → verdes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/instagram/graph.ts src/lib/instagram/graph.test.ts src/lib/bot/deps.ts
git commit -m "feat: enviar tarjetas con imagen, acciones de visto/escribiendo y perfil por la Graph API" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: NLU base — normalizacion y vocabulario

**Files:**
- Create: `src/lib/bot/nlu/normalizar.ts`, `src/lib/bot/nlu/normalizar.test.ts`
- Create: `src/lib/bot/nlu/vocabulario.ts`, `src/lib/bot/nlu/vocabulario.test.ts`

**Interfaces:**
- Produces (`normalizar.ts`): `normalizar(texto): string`, `tokenizar(texto): string[]`, `esSoloEmojis(texto): boolean`, `distancia(a, b): number`, `coincideAprox(token, objetivo): boolean`.
- Produces (`vocabulario.ts`): `claveTipo(tipo: string): string`, `aplicarFrases(textoNormalizado: string): string`, `SINONIMOS_TIPO: Record<string, string[]>` (palabra → claves de tipo), `SINONIMOS_COMBUSTIBLE: Record<string, string>`, `SINONIMOS_TRANSMISION: Record<string, string>`, `ALIAS_MARCA: Record<string, string>`.

Reglas de `normalizar`: minusculas; sin tildes ni dieresis (`ñ`→`n`); los signos y emojis pasan a espacio **salvo** `.` y `,` entre digitos (para `1.6`, `177.000`, `9.500.000`); `$` desaparece; 3 o mas letras iguales seguidas se reducen a una (`holaaa`→`hola`, pero `sii` se queda); espacios colapsados y recortados.

- [ ] **Step 1: Tests de normalizar (fallan)**

Create `src/lib/bot/nlu/normalizar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { coincideAprox, distancia, esSoloEmojis, normalizar, tokenizar } from "./normalizar";

describe("normalizar", () => {
  it.each([
    ["¡Hola! ¿Cómo estás?", "hola como estas"],
    ["AÑO 2015", "ano 2015"],
    ["holaaaa", "hola"],
    ["sii", "sii"],
    ["Peugeot 206 1.6", "peugeot 206 1.6"],
    ["$9.500.000", "9.500.000"],
    ["177.000 km", "177.000 km"],
    ["Hola.", "hola"],
    ["  mucho   espacio ", "mucho espacio"],
    ["pick-up", "pick up"],
    ["👍 dale", "dale"],
    ["", ""],
  ])("normaliza %j → %j", (entrada, esperado) => {
    expect(normalizar(entrada)).toBe(esperado);
  });
});

describe("tokenizar", () => {
  it("separa en palabras ya normalizadas", () => {
    expect(tokenizar("me pasas más info del 206?")).toEqual(["me", "pasas", "mas", "info", "del", "206"]);
  });

  it("devuelve lista vacia para texto vacio o solo signos", () => {
    expect(tokenizar("")).toEqual([]);
    expect(tokenizar("?!...")).toEqual([]);
  });
});

describe("esSoloEmojis", () => {
  it("es true si hay emojis y ninguna letra ni numero", () => {
    expect(esSoloEmojis("👍")).toBe(true);
    expect(esSoloEmojis("👍👍 ❤️")).toBe(true);
  });

  it("es false si hay texto, esta vacio o no hay emojis", () => {
    expect(esSoloEmojis("🚗 hola")).toBe(false);
    expect(esSoloEmojis("")).toBe(false);
    expect(esSoloEmojis("...")).toBe(false);
    expect(esSoloEmojis("hola")).toBe(false);
  });
});

describe("distancia", () => {
  it("cuenta ediciones de a un caracter", () => {
    expect(distancia("amarok", "amarok")).toBe(0);
    expect(distancia("amarok", "amarrok")).toBe(1);
    expect(distancia("kitten", "sitting")).toBe(3);
    expect(distancia("", "abc")).toBe(3);
  });
});

describe("coincideAprox", () => {
  it("exige igualdad en palabras de hasta 4 letras y numeros", () => {
    expect(coincideAprox("hola", "hola")).toBe(true);
    expect(coincideAprox("hola", "ola")).toBe(false);
    expect(coincideAprox("206", "208")).toBe(false);
  });

  it("tolera 1 error en palabras de 5 a 7 letras", () => {
    expect(coincideAprox("amarrok", "amarok")).toBe(true);
    expect(coincideAprox("corola", "corolla")).toBe(true);
    expect(coincideAprox("vento", "venta")).toBe(true);
    expect(coincideAprox("vento", "viaje")).toBe(false);
  });

  it("tolera 2 errores en palabras de 8 o mas letras", () => {
    expect(coincideAprox("financiacon", "financiacion")).toBe(true);
    expect(coincideAprox("financiasion", "financiacion")).toBe(true);
    expect(coincideAprox("documentos", "documentacion")).toBe(false);
  });
});
```

Run: `npx vitest run src/lib/bot/nlu/normalizar.test.ts` → FAIL.

- [ ] **Step 2: Implementar `normalizar.ts`**

Implementacion guia (el contrato es el test): `texto.normalize("NFD").replace(/[̀-ͯ]/g, "")` para tildes (ojo: la `ñ` normalizada pasa a `n` por el mismo paso); `toLowerCase()`; reemplazar `$` por vacio; reemplazar por espacio todo caracter que no sea letra/numero/espacio **salvo** `.` o `,` rodeados de digitos (proteger con un marcador, por ejemplo `(?<=\d)[.,](?=\d)`); reducir `/([a-z])\1{2,}/g` a `$1`; colapsar espacios y `trim`. `esSoloEmojis`: sin letras ni digitos (`/[\p{L}\p{N}]/u`) y con algun caracter `\p{Extended_Pictographic}`. `distancia`: Levenshtein clasico con dos filas. `coincideAprox(token, objetivo)`: `token === objetivo` → true; si alguno tiene digitos → false; `largo = Math.max(token.length, objetivo.length)`; si `largo <= 4` → false; si `largo <= 7` → `distancia <= 1`; si no `distancia <= 2`.

Run: tests de normalizar → PASS.

- [ ] **Step 3: Tests de vocabulario (fallan)**

Create `src/lib/bot/nlu/vocabulario.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ALIAS_MARCA,
  aplicarFrases,
  claveTipo,
  SINONIMOS_COMBUSTIBLE,
  SINONIMOS_TIPO,
  SINONIMOS_TRANSMISION,
} from "./vocabulario";

describe("claveTipo", () => {
  it.each([
    ["Pick-up", "pickup"],
    ["Sedán", "sedan"],
    ["SUV", "suv"],
    ["Utilitario", "utilitario"],
    ["Moto", "moto"],
  ])("%s → %s", (tipo, clave) => {
    expect(claveTipo(tipo)).toBe(clave);
  });
});

describe("aplicarFrases", () => {
  it("junta las expresiones de varias palabras en una sola", () => {
    expect(aplicarFrases("busco una pick up nafta")).toBe("busco una pickup nafta");
    expect(aplicarFrases("quiero gas oil")).toBe("quiero gasoil");
    expect(aplicarFrases("un cero km")).toBe("un 0km");
  });
});

describe("sinonimos de tipo", () => {
  it("entiende las formas coloquiales", () => {
    expect(SINONIMOS_TIPO["chatita"]).toContain("utilitario");
    expect(SINONIMOS_TIPO["furgon"]).toContain("utilitario");
    expect(SINONIMOS_TIPO["pickup"]).toContain("pickup");
    expect(SINONIMOS_TIPO["hilux"]).toContain("pickup");
    expect(SINONIMOS_TIPO["moto"]).toContain("moto");
    expect(SINONIMOS_TIPO["hatch"]).toContain("hatchback");
    expect(SINONIMOS_TIPO["sedan"]).toContain("sedan");
  });

  it("'camioneta' abarca pick-up, camioneta y SUV", () => {
    expect([...SINONIMOS_TIPO["camioneta"]].sort()).toEqual(["camioneta", "pickup", "suv"]);
  });

  it("'auto' y 'autos' no restringen el tipo (no estan en el diccionario)", () => {
    expect(SINONIMOS_TIPO["auto"]).toBeUndefined();
    expect(SINONIMOS_TIPO["autos"]).toBeUndefined();
  });
});

describe("combustible, transmision y marcas", () => {
  it("normaliza combustibles", () => {
    expect(SINONIMOS_COMBUSTIBLE["nafta"]).toBe("nafta");
    expect(SINONIMOS_COMBUSTIBLE["naftero"]).toBe("nafta");
    expect(SINONIMOS_COMBUSTIBLE["gasoil"]).toBe("diesel");
    expect(SINONIMOS_COMBUSTIBLE["diesel"]).toBe("diesel");
    expect(SINONIMOS_COMBUSTIBLE["gnc"]).toBe("gnc");
  });

  it("normaliza transmisiones", () => {
    expect(SINONIMOS_TRANSMISION["automatico"]).toBe("automatico");
    expect(SINONIMOS_TRANSMISION["automatica"]).toBe("automatico");
    expect(SINONIMOS_TRANSMISION["at"]).toBe("automatico");
    expect(SINONIMOS_TRANSMISION["manual"]).toBe("manual");
    expect(SINONIMOS_TRANSMISION["mecanico"]).toBe("manual");
  });

  it("resuelve alias de marca", () => {
    expect(ALIAS_MARCA["vw"]).toBe("volkswagen");
    expect(ALIAS_MARCA["chevy"]).toBe("chevrolet");
  });
});
```

Run → FAIL. Implementar `vocabulario.ts`: `claveTipo = (t) => normalizar(t).replace(/\s+/g, "")`; `aplicarFrases` con reemplazos `pick up→pickup`, `gas oil→gasoil`, `cero km→0km`, `cero kilometro→0km`; los diccionarios con **al menos** estas entradas (se pueden agregar mas, son datos editables):
- `SINONIMOS_TIPO` (palabra → claves de tipo, todas en forma `claveTipo`): `hatch`/`hatchback`/`hatchbacks` → `["hatchback"]`; `sedan`/`sedanes` → `["sedan"]`; `suv`/`suvs`/`todoterreno`/`4x4` → `["suv"]`; `pickup`/`pickups`/`hilux`/`ranger`/`s10`/`frontier`/`alaskan`/`amarok`/`toro`/`saveiro` → `["pickup"]`; `camioneta`/`camionetas` → `["pickup","camioneta","suv"]`; `utilitario`/`utilitarios`/`furgon`/`furgones`/`furgoneta`/`chatita`/`chatitas`/`chato`/`kangoo`/`partner`/`berlingo`/`trafic`/`master`/`ducato`/`fiorino`/`combi` → `["utilitario"]`; `moto`/`motos`/`motocicleta`/`motito`/`scooter` → `["moto"]`.
- `SINONIMOS_COMBUSTIBLE`: `nafta`/`naftero`/`naftera` → `nafta`; `gasoil`/`gasoleo`/`diesel`/`diesell` → `diesel`; `gnc` → `gnc`; `hibrido`/`hibrida` → `hibrido`; `electrico`/`electrica` → `electrico`.
- `SINONIMOS_TRANSMISION`: `automatico`/`automatica`/`automaticos`/`automaticas`/`at`/`aut` → `automatico`; `manual`/`manuales`/`mecanico`/`mecanica`/`mt` → `manual`.
- `ALIAS_MARCA`: `vw`→`volkswagen`, `chevy`→`chevrolet`, `merce`→`mercedes`, `fiat`→`fiat`, `ford`→`ford`, `renault`→`renault`, `peugeot`→`peugeot`, `toyota`→`toyota`, `honda`→`honda`, `citroen`→`citroen`, `nissan`→`nissan`, `volkswagen`→`volkswagen`, `chevrolet`→`chevrolet`.

Run: `npx vitest run src/lib/bot/nlu` → PASS; `npx tsc --noEmit` limpio.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/nlu/normalizar.ts src/lib/bot/nlu/normalizar.test.ts src/lib/bot/nlu/vocabulario.ts src/lib/bot/nlu/vocabulario.test.ts
git commit -m "feat: normalizacion de texto y vocabulario coloquial del bot por reglas" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: NLU — intenciones

**Files:**
- Create: `src/lib/bot/nlu/intenciones.ts`, `src/lib/bot/nlu/intenciones.test.ts`

**Interfaces:**
- Consumes: `normalizar`, `tokenizar`, `coincideAprox` (Task 4), `aplicarFrases`.
- Produces:

```ts
export type Intencion =
  | "humano" | "identidad" | "avisame" | "negacion" | "precio" | "financiacion" | "permuta" | "pagos"
  | "horarios" | "ubicacion" | "garantia" | "documentacion" | "disponibilidad" | "info" | "ver_mas"
  | "catalogo" | "afirmacion" | "gracias" | "despedida" | "cortesia" | "saludo" | "desconocida";

/** Intenciones detectadas, de mas a menos prioritaria (el orden de la lista de arriba). Nunca vacia: "desconocida" si no hay ninguna. */
export function detectarIntenciones(texto: string): Intencion[];
```

**Reglas de diseno (el test es el contrato):**
- Prioridad = el orden del tipo `Intencion` de arriba. Se devuelven **todas** las que coinciden en ese orden (ej. "hola, tienen alguna pickup?" → `["catalogo", "saludo"]`).
- Frases/palabras por intencion (en forma normalizada; las palabras sueltas de **6+ letras** admiten error de tipeo con `coincideAprox(tokenDelUsuario, palabraDelDiccionario)`; las mas cortas, igualdad exacta). Son la base y se pueden ampliar:
  - `saludo`: hola, ola, buenas, "buen dia", "buenos dias", "buenas tardes", "buenas noches", "que tal", epa, "buen dia".
  - `cortesia`: "como estas", "como andas", "como va", "todo bien", "como te va", "que tal estas".
  - `gracias`: gracias, "mil gracias", genial, joya, "muy amable".
  - `despedida`: chau, chao, "hasta luego", "nos vemos", saludos, "buen finde".
  - `precio`: precio, valor, costo, "cuanto sale", "cuanto cuesta", "cuanto vale", "cuanto esta", "cuanto piden", "cuanto pedis", "a cuanto", "cuanto es", presio.
  - `info`: info, informacion, "mas info", detalles, datos, caracteristicas, ficha, km, kilometros, "cuantos km", "que motor", "que año"/"que ano".
  - `catalogo`: "que tienen", "que autos tienen", "que vehiculos", "que hay", tienen/tenes/tiene seguido de un sustantivo no es suficiente solo; usar: stock, catalogo, lista, mostrame, muestrame, "tienen alguna", "tenes alguna", "tienen algun", "tenes algun", "algun auto", "algun utilitario", "busco", "estoy buscando", "quiero un", "quiero una", "me interesa un", "me interesa una".
  - `disponibilidad`: "sigue disponible", "esta disponible", "lo tienen", "la tienen", "todavia esta", "sigue en venta", "se vendio", "esta vendido", "esta vendida".
  - `financiacion`: financiacion, financiar, financiado, financian, cuotas, credito, prestamo, anticipo, "plan de pago".
  - `permuta`: permuta, permutan, permutas, "toman usados", "tomas usados", "tomas mi auto", "toman mi auto", "parte de pago", "entrego mi auto", "entregar mi usado", "tengo un usado".
  - `pagos`: "formas de pago", "medios de pago", "como se paga", "como pago", efectivo, transferencia, cheque.
  - `horarios`: horario, horarios, "a que hora", abren, cierran, "hasta que hora", atienden, sabados, domingos.
  - `ubicacion`: "donde estan", "donde queda", direccion, ubicacion, "como llego", mapa, "donde se encuentran".
  - `garantia`: garantia.
  - `documentacion`: documentacion, papeles, "08", titulo, cedula, "libre de deuda", vtv, patente.
  - `humano`: dueno, duenio, vendedor, vendedora, asesor, asesora, secretaria, nati, "hablar con alguien", "con una persona", "con un humano", "hablo con", "me llamas", "me llaman", llamame, "pasame con", "con quien hablo" **(excepto** "con quien hablo" se resuelve como `identidad`, ver abajo), telefono, numero, whatsapp, wsp, wasap, cel.
  - (`persona`/`humano` sueltas **no** van en `humano`: "es una persona la que me atiende?" es `identidad`.)
  - `identidad`: "sos un bot", "sos bot", "es un bot", robot, "sos una persona", "sos humano", "sos real", "es una persona", "atiende una persona", "con quien hablo", "maquina", "automatico" (solo cuando aparece junto a "mensaje" o "respuesta"; si no es la transmision), "sos ia".
  - `avisame`: avisame, avisenme, "me avisan", "me avisas", "cuando entre", "cuando llegue", "si entra", "si llega", "dejame mi contacto".
  - `ver_mas`: "ver mas", "mas opciones", "que mas", "otros", "otras", "tenes otro", "tenes otra", "otro mas", siguiente, "algo mas", "mostrame mas", "muestrame mas".
  - `negacion`: solo si el texto tiene **≤ 5 tokens** y empieza con no/nop/nah/nada, o contiene "ese no", "esa no", "no es ese", "no es esa", "no gracias".
  - `afirmacion`: solo si el texto tiene **≤ 4 tokens** y su primer token es si/sii/siii/sisi/dale/ok/oka/okey/claro/bueno/perfecto/obvio/"de una"/mandale/quiero/"me interesa", o es solo emojis de afirmacion.
- `negacion` tiene prioridad sobre `gracias` ("no gracias" → `["negacion", "gracias"]`).

- [ ] **Step 1: Tests (fallan)**

Create `src/lib/bot/nlu/intenciones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectarIntenciones } from "./intenciones";

describe("detectarIntenciones — la intencion principal (primera)", () => {
  it.each([
    ["hola", "saludo"],
    ["holaaa", "saludo"],
    ["ola buenas tardes", "saludo"],
    ["Hola !como estas??", "cortesia"],
    ["como andas", "cortesia"],
    ["gracias", "gracias"],
    ["chau, nos vemos", "despedida"],
    ["me decis el precio?", "precio"],
    ["hola. me decis el precio?", "precio"],
    ["que valor tiene?", "precio"],
    ["cuanto sale el vento?", "precio"],
    ["cuánto cuesta", "precio"],
    ["a cuanto la tienen", "precio"],
    ["me pasas mas info del 206", "info"],
    ["cuantos km tiene", "info"],
    ["que autos tienen?", "catalogo"],
    ["tienen alguna pickup?", "catalogo"],
    ["algun utilitario asi?", "catalogo"],
    ["estoy buscando un auto chico", "catalogo"],
    ["sigue disponible?", "disponibilidad"],
    ["esa se vendio?", "disponibilidad"],
    ["hacen financiacion?", "financiacion"],
    ["financiasion en cuotas", "financiacion"],
    ["toman usados?", "permuta"],
    ["tengo un usado para entregar", "permuta"],
    ["formas de pago", "pagos"],
    ["a que hora abren?", "horarios"],
    ["donde estan?", "ubicacion"],
    ["tienen garantia?", "garantia"],
    ["que papeles necesito", "documentacion"],
    ["hablo con el dueño?", "humano"],
    ["quiero hablar con un vendedor", "humano"],
    ["pasame con nati", "humano"],
    ["me pasas un numero?", "humano"],
    ["sos un bot?", "identidad"],
    ["es una persona la que me atiende?", "identidad"],
    ["avisame cuando entre una hilux", "avisame"],
    ["mostrame mas", "ver_mas"],
    ["tenes otro?", "ver_mas"],
    ["si", "afirmacion"],
    ["sii dale", "afirmacion"],
    ["dale", "afirmacion"],
    ["👍", "afirmacion"],
    ["no", "negacion"],
    ["no, ese no es", "negacion"],
    ["no gracias", "negacion"],
  ])("%j → %s", (texto, esperada) => {
    expect(detectarIntenciones(texto)[0]).toBe(esperada);
  });
});

describe("detectarIntenciones — varias a la vez y orden de prioridad", () => {
  it("devuelve todas en orden de prioridad", () => {
    expect(detectarIntenciones("hola, tienen alguna pickup?")).toEqual(["catalogo", "saludo"]);
    expect(detectarIntenciones("hola buenas, cuanto sale?")).toEqual(["precio", "saludo"]);
    expect(detectarIntenciones("chau gracias")).toEqual(["gracias", "despedida"]);
    expect(detectarIntenciones("no gracias")).toEqual(["negacion", "gracias"]);
  });

  it("humano gana sobre el resto", () => {
    expect(detectarIntenciones("quiero el precio hablando con el dueño")[0]).toBe("humano");
  });
});

describe("detectarIntenciones — falsos positivos que hay que evitar", () => {
  it("'si' dentro de una frase larga no es una afirmacion", () => {
    expect(detectarIntenciones("si tienen financiacion me interesa")).not.toContain("afirmacion");
    expect(detectarIntenciones("si tienen financiacion me interesa")[0]).toBe("financiacion");
  });

  it("'no' dentro de una frase larga no es una negacion", () => {
    expect(detectarIntenciones("no se si tienen alguna pickup nafta")).not.toContain("negacion");
  });

  it("'automatico' como transmision no es identidad", () => {
    expect(detectarIntenciones("busco uno automatico")).not.toContain("identidad");
  });

  it("'cuando' no dispara 'avisame' por si solo", () => {
    expect(detectarIntenciones("cuando puedo ir a verlo")).not.toContain("avisame");
  });
});

describe("detectarIntenciones — sin coincidencias", () => {
  it("devuelve desconocida", () => {
    expect(detectarIntenciones("asdfgh")).toEqual(["desconocida"]);
    expect(detectarIntenciones("")).toEqual(["desconocida"]);
    expect(detectarIntenciones("???")).toEqual(["desconocida"]);
  });
});
```

Run: `npx vitest run src/lib/bot/nlu/intenciones.test.ts` → FAIL.

- [ ] **Step 2: Implementar**

Implementacion guia: construir una tabla `REGLAS: Array<{ intencion, frases: string[], palabras: string[] }>` ordenada segun `Intencion`. Sobre el texto `t = aplicarFrases(normalizar(texto))` y `tokens = t.split(" ")`: una **frase** coincide si `(" " + t + " ").includes(" " + frase + " ")`; una **palabra** coincide si algun token es igual o (palabra de 5+ letras) `coincideAprox(token, palabra)`. `negacion` y `afirmacion` con las reglas de largo/primer token descritas arriba. `identidad` por frases; la palabra `automatico` cuenta solo si tambien aparece `mensaje` o `respuesta`. `avisame` por frases completas (no por "cuando" suelto). Devolver las intenciones que coinciden en el orden del tipo; si ninguna, `["desconocida"]`. Si algun caso del test no se logra con las listas base, **ampliar las listas** (no tocar el test); si un caso parece imposible sin contradecir otro, reportarlo.

Run: tests de intenciones → PASS; `npx tsc --noEmit` limpio.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/nlu/intenciones.ts src/lib/bot/nlu/intenciones.test.ts
git commit -m "feat: deteccion de intenciones por palabras clave con tolerancia a errores de tipeo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: NLU — entidades

**Files:**
- Create: `src/lib/bot/nlu/entidades.ts`, `src/lib/bot/nlu/entidades.test.ts`

**Interfaces:**
- Consumes: `VehiculoCatalogo` (`../types`), `normalizar`, `tokenizar`, `coincideAprox`, `aplicarFrases`, `SINONIMOS_*`, `ALIAS_MARCA`.
- Produces:

```ts
export type Entidades = {
  /** Autos del catalogo nombrados por modelo (cualquier estado). */
  vehiculoIds: string[];
  /** Marca tal cual figura en el catalogo, si se nombro una marca (sola, sin modelo). */
  marca: string | null;
  /** Claves de tipo (ver SINONIMOS_TIPO); varias para "camioneta". */
  tipos: string[];
  combustible: string | null;
  transmision: string | null;
  anio: number | null;
  /** 1..9 para "el 2", "la primera"; -1 para "el ultimo". */
  ordinal: number | null;
  /** "ese", "esa", "el mismo": se refiere al auto del que se venia hablando. */
  deictico: boolean;
};

export function extraerEntidades(texto: string, catalogo: VehiculoCatalogo[]): Entidades;
```

**Reglas:**
- **Auto nombrado**: se toma el **primer token del `modelo`** de cada vehiculo (normalizado; ej. `206 1.6`→`206`, `Amarok V6 Extreme`→`amarok`, `XR 150`→`xr`). Un vehiculo se considera nombrado si algun token del texto es igual (numeros: igualdad exacta) o `coincideAprox` (palabras). Si dos vehiculos comparten el primer token (ej. dos `208`), se devuelven ambos.
- **Marca**: si el texto nombra una marca (token igual al normalizado de `v.marca`, o alias de `ALIAS_MARCA` cuyo valor coincide con una marca del catalogo) y **no** nombra ningun auto, `marca` = valor de `v.marca` del catalogo. Si nombra un auto, `marca` = null.
- **Año**: numero de 4 digitos entre 1980 y 2030 que sea un token completo (no parte de `9.500.000`, `177.000` ni de un modelo).
- **Ordinal**: solo si el texto tiene ≤ 4 tokens: token `1`–`9` solo (ej. "el 2"), o `primero/primera/segundo/segunda/tercero/tercera/cuarto/cuarta/quinto/quinta` → 1..5, `ultimo/ultima` → -1. Un numero de 3+ digitos (206) **no** es ordinal.
- **Deictico**: tokens `ese`, `esa`, `eso`, `mismo`, `misma` (con ≤ 5 tokens).
- **Tipos**: unir las claves de `SINONIMOS_TIPO` de todos los tokens (sin repetir); `auto/autos` no restringen. **Combustible/transmision**: primer token que figure en el diccionario.
- Siempre aplicar `aplicarFrases(normalizar(texto))` antes.
- **Diccionarios cerrados por igualdad EXACTA del token** (`SINONIMOS_TIPO`, `SINONIMOS_COMBUSTIBLE`, `SINONIMOS_TRANSMISION`, `ALIAS_MARCA`): nunca con `coincideAprox` ("Manuel" ≈ "manual", "motor" ≈ "moto"). `coincideAprox(token, palabra)` solo contra los tokens de modelo y las marcas **del catalogo**.

- [ ] **Step 1: Tests (fallan)**

Create `src/lib/bot/nlu/entidades.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATALOGO } from "../__fixtures__/catalogo";
import { extraerEntidades } from "./entidades";

const e = (texto: string) => extraerEntidades(texto, CATALOGO);

describe("autos nombrados", () => {
  it.each([
    ["me pasas mas info del 206", ["v-206"]],
    ["tienen la 208?", ["v-208"]],
    ["cuanto sale el vento?", ["v-vento"]],
    ["tenes una amarrok?", ["v-amarok"]],
    ["precio del corola", ["v-corolla"]],
    ["la partner", ["v-partner"]],
    ["tienen la xr 150?", ["v-xr150"]],
    ["peugeot 208 style", ["v-208"]],
  ])("%j → %j", (texto, ids) => {
    expect(e(texto).vehiculoIds).toEqual(ids);
  });

  it("devuelve varios si el modelo es ambiguo y ninguno si no hay", () => {
    const dos = [...CATALOGO, { ...CATALOGO[1], id: "v-208b", nombre: "Peugeot 208 Active", modelo: "208 Active" }];

    expect(extraerEntidades("la 208", dos).vehiculoIds.sort()).toEqual(["v-208", "v-208b"]);
    expect(e("hola buenas tardes").vehiculoIds).toEqual([]);
  });
});

describe("marca", () => {
  it("detecta una marca sola, con alias", () => {
    expect(e("busco algo peugeot").marca).toBe("Peugeot");
    expect(e("una vw").marca).toBe("Volkswagen");
  });

  it("no la devuelve si se nombra un auto concreto", () => {
    expect(e("peugeot 208 style").marca).toBeNull();
  });
});

describe("tipo, combustible, transmision y año", () => {
  it("tipos", () => {
    expect(e("una pickup nafta").tipos).toEqual(["pickup"]);
    expect(e("algun utilitario asi?").tipos).toEqual(["utilitario"]);
    expect(e("tienen alguna chatita?").tipos).toEqual(["utilitario"]);
    expect([...e("busco una camioneta").tipos].sort()).toEqual(["camioneta", "pickup", "suv"]);
    expect(e("busco un auto").tipos).toEqual([]);
    expect(e("una pick up").tipos).toEqual(["pickup"]);
  });

  it("combustible y transmision", () => {
    expect(e("una pickup nafta").combustible).toBe("nafta");
    expect(e("quiero gas oil").combustible).toBe("diesel");
    expect(e("automatico por favor").transmision).toBe("automatico");
    expect(e("que sea manual").transmision).toBe("manual");
    expect(e("hola").combustible).toBeNull();
  });

  it("no confunde palabras comunes con los diccionarios (no hay tolerancia a typos en ellos)", () => {
    expect(e("soy Manuel").transmision).toBeNull();
    expect(e("motor 1.6").tipos).toEqual([]);
    expect(e("mucho trafico").tipos).toEqual([]);
  });

  it("año de 4 digitos, sin confundirlo con precios, km o modelos", () => {
    expect(e("modelo 2015").anio).toBe(2015);
    expect(e("del 2011").anio).toBe(2011);
    expect(e("2015").anio).toBe(2015);
    expect(e("177 mil km").anio).toBeNull();
    expect(e("esta en $9.500.000").anio).toBeNull();
    expect(e("la 206").anio).toBeNull();
    expect(e("1999999").anio).toBeNull();
  });
});

describe("referencias a lo ya mostrado", () => {
  it("ordinales", () => {
    expect(e("el 2").ordinal).toBe(2);
    expect(e("el segundo").ordinal).toBe(2);
    expect(e("la primera").ordinal).toBe(1);
    expect(e("el ultimo").ordinal).toBe(-1);
  });

  it("un numero de modelo no es ordinal", () => {
    expect(e("el 206").ordinal).toBeNull();
    expect(e("me pasas mas info del 206").ordinal).toBeNull();
  });

  it("deicticos", () => {
    expect(e("ese").deictico).toBe(true);
    expect(e("esa me interesa").deictico).toBe(true);
    expect(e("el mismo").deictico).toBe(true);
    expect(e("tienen alguna pickup nafta y automatica de las que estan en la web").deictico).toBe(false);
  });
});

describe("texto sin contenido", () => {
  it("devuelve entidades vacias", () => {
    expect(e("")).toEqual({
      vehiculoIds: [], marca: null, tipos: [], combustible: null, transmision: null, anio: null, ordinal: null, deictico: false,
    });
  });
});
```

Run: `npx vitest run src/lib/bot/nlu/entidades.test.ts` → FAIL.

- [ ] **Step 2: Implementar y verificar**

Implementar `entidades.ts` segun las reglas. Run: `npx vitest run src/lib/bot/nlu` → PASS; `npx tsc --noEmit` limpio.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/nlu/entidades.ts src/lib/bot/nlu/entidades.test.ts
git commit -m "feat: extraccion de entidades (autos, marca, tipo, combustible, año, referencias) del texto del cliente" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Busqueda en el catalogo

**Files:**
- Create: `src/lib/bot/busqueda.ts`, `src/lib/bot/busqueda.test.ts`

**Interfaces:**
- Consumes: `VehiculoCatalogo`, `Filtros` (`./sesion`), `Entidades` (`./nlu/entidades`), `claveTipo`, `normalizar`.
- Produces:

```ts
export type ResultadoBusqueda = {
  /** Cumplen todos los filtros. Solo autos disponibles, mas nuevos primero. */
  exactos: VehiculoCatalogo[];
  /** Si no hay exactos: los que quedan al relajar filtros (vacio si hay exactos). */
  alternativos: VehiculoCatalogo[];
  /** Filtros que hubo que soltar para llegar a `alternativos`, en el orden en que se soltaron. */
  relajados: Array<keyof Filtros>;
};

export function filtrosDeEntidades(e: Entidades): Filtros;               // marca, tipos, combustible, transmision, anio (solo los que no son null/vacios)
export function buscar(catalogo: VehiculoCatalogo[], filtros: Filtros): ResultadoBusqueda;
export function similares(catalogo: VehiculoCatalogo[], de: VehiculoCatalogo, max?: number): VehiculoCatalogo[]; // max por defecto 3
export function recientes(catalogo: VehiculoCatalogo[], cantidad: number): VehiculoCatalogo[];            // cualquier estado, mas nuevos primero
```

**Reglas:** solo `estado === "disponible"` en `exactos`/`alternativos`/`similares`. Comparacion de `marca`/`combustible` por `normalizar`; `tipos` por `claveTipo(v.tipo ?? "")` incluido en la lista; `transmision` por prefijo de 6 letras normalizado (`automa…`/`manual`); `anio` igualdad. **Relajacion**, en este orden y deteniendose en el primer paso con resultados: soltar `anio`, luego `transmision`, luego `combustible`, luego `marca` (nunca `tipos`). `similares`: disponibles del mismo tipo distintos de `de`, ordenados por cercania de año (desempata el mas nuevo); si faltan, completar con la misma marca; maximo `max`.

- [ ] **Step 1: Tests (fallan)**

Create `src/lib/bot/busqueda.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { buscar, filtrosDeEntidades, recientes, similares } from "./busqueda";

const ids = (vs: { id: string }[]) => vs.map((v) => v.id);
const por = (id: string) => CATALOGO.find((v) => v.id === id)!;

describe("buscar", () => {
  it("sin filtros devuelve todos los disponibles, los mas nuevos primero", () => {
    const r = buscar(CATALOGO, {});

    expect(ids(r.exactos)).toEqual(["v-amarok", "v-206", "v-208", "v-vento", "v-kangoo", "v-corolla"]);
    expect(r.alternativos).toEqual([]);
    expect(r.relajados).toEqual([]);
  });

  it("no incluye vendidos ni reservados", () => {
    expect(ids(buscar(CATALOGO, { tipos: ["utilitario"] }).exactos)).toEqual(["v-kangoo"]);
    expect(ids(buscar(CATALOGO, { tipos: ["moto"] }).exactos)).toEqual([]);
  });

  it("filtra por tipo, marca, año, combustible y transmision", () => {
    expect(ids(buscar(CATALOGO, { tipos: ["pickup"] }).exactos)).toEqual(["v-amarok"]);
    expect(ids(buscar(CATALOGO, { marca: "Peugeot" }).exactos)).toEqual(["v-206", "v-208"]);
    expect(ids(buscar(CATALOGO, { anio: 2011 }).exactos)).toEqual(["v-206", "v-corolla"]);
    expect(ids(buscar(CATALOGO, { combustible: "diesel" }).exactos)).toEqual(["v-amarok"]);
    expect(ids(buscar(CATALOGO, { transmision: "automatico" }).exactos)).toEqual(["v-amarok", "v-vento"]);
  });

  it("si no hay coincidencia exacta relaja filtros y avisa cuales soltó", () => {
    const r = buscar(CATALOGO, { tipos: ["pickup"], combustible: "nafta" });

    expect(r.exactos).toEqual([]);
    expect(ids(r.alternativos)).toEqual(["v-amarok"]);
    expect(r.relajados).toEqual(["combustible"]);
  });

  it("relaja en orden: año, transmision, combustible, marca; nunca el tipo", () => {
    const r = buscar(CATALOGO, { tipos: ["sedan"], anio: 1990, transmision: "manual", combustible: "gnc", marca: "Honda" });

    expect(r.relajados).toEqual(["anio", "transmision", "combustible", "marca"]);
    expect(ids(r.alternativos)).toEqual(["v-vento", "v-corolla"]);
  });

  it("si ni relajando hay algo (tipo sin stock) devuelve vacio", () => {
    const r = buscar(CATALOGO, { tipos: ["moto"] });

    expect(r.exactos).toEqual([]);
    expect(r.alternativos).toEqual([]);
  });
});

describe("filtrosDeEntidades", () => {
  it("copia solo lo que el cliente dijo", () => {
    const f = filtrosDeEntidades({
      vehiculoIds: [], marca: "Peugeot", tipos: ["pickup"], combustible: null, transmision: "manual", anio: null, ordinal: null, deictico: false,
    });

    expect(f).toEqual({ marca: "Peugeot", tipos: ["pickup"], transmision: "manual" });
  });

  it("devuelve {} si no hay ninguno", () => {
    expect(
      filtrosDeEntidades({ vehiculoIds: [], marca: null, tipos: [], combustible: null, transmision: null, anio: null, ordinal: null, deictico: false }),
    ).toEqual({});
  });
});

describe("similares", () => {
  it("de un auto vendido devuelve los disponibles del mismo tipo", () => {
    expect(ids(similares(CATALOGO, por("v-partner")))).toEqual(["v-kangoo"]);
  });

  it("prioriza el mismo tipo por cercania de año y completa con la misma marca", () => {
    expect(ids(similares(CATALOGO, por("v-206")))).toEqual(["v-208"]);
  });

  it("no incluye al propio auto y respeta el maximo", () => {
    const r = similares(CATALOGO, por("v-corolla"), 1);

    expect(r).toHaveLength(1);
    expect(r[0].id).not.toBe("v-corolla");
    expect(r[0].tipo).toBe("Sedán");
  });
});

describe("recientes", () => {
  it("devuelve los ultimos cargados de cualquier estado", () => {
    expect(ids(recientes(CATALOGO, 5))).toEqual(["v-amarok", "v-206", "v-208", "v-vento", "v-kangoo"]);
    expect(ids(recientes(CATALOGO, 20))).toHaveLength(CATALOGO.length);
  });
});
```

Run → FAIL. Implementar `busqueda.ts`. Run: `npx vitest run src/lib/bot/busqueda.test.ts` → PASS; `npx tsc --noEmit` limpio.

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/busqueda.ts src/lib/bot/busqueda.test.ts
git commit -m "feat: busqueda en el catalogo con relajacion de filtros, similares y recientes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Respuestas — helpers de formato

**Files:**
- Create: `src/lib/bot/respuestas.ts`, `src/lib/bot/respuestas.test.ts`

**Interfaces:**
- Consumes: `VehiculoCatalogo`, `Tarjeta`, `Boton`, `Perfil` (`./types`), `Negocio` (`./negocio`), `buildWhatsAppUrlInstagram` (`../utils`).
- Produces (el motor de la Task 9 puede agregar mas helpers a este archivo):

```ts
export type Contexto = { negocio: Negocio; siteUrl: string };

export function elegir(variantes: readonly string[], semilla: string): string;           // determinista: misma semilla → misma variante
export function precioDe(v: VehiculoCatalogo): string | null;                             // null si esta vacio o dice "consult..."
export function linkFicha(v: VehiculoCatalogo, siteUrl: string): string;                  // `${siteUrl}/vehiculos/${slug}` (sin barra doble)
export function urlImagen(v: VehiculoCatalogo, siteUrl: string): string | null;           // https absoluta o null
export function datosVehiculo(v: VehiculoCatalogo): string;                               // "2011 · 177.000 km · Nafta · Manual"
export function botonNati(v: VehiculoCatalogo | null, negocio: Negocio): Boton;           // "Hablar con Nati" → wa.me con origen Instagram
export function tarjetaDe(v: VehiculoCatalogo, ctx: Contexto): Tarjeta;                   // foto + datos + [Ver en la web, Hablar con Nati]
export function tarjetaContacto(v: VehiculoCatalogo | null, ctx: Contexto): Tarjeta;      // solo contacto (sin auto)
export function alternativaTexto(vehiculos: VehiculoCatalogo[], ctx: Contexto): string;   // lista en texto con links (respaldo de las tarjetas)
export function primerNombre(perfil: Perfil | null): string | null;                       // "Juan Perez" → "Juan"
```

**Reglas:**
- `precioDe`: `null` si `precio_texto` esta vacio o coincide con `/consult/i`; si no, el texto recortado.
- `alternativaTexto`: **una linea por auto, sin encabezado, maximo 5 autos** ("• {nombre} {anio} · {precio o 'precio con Nati'} · {link}"): tiene que cumplir las reglas de tono (≤ 5 lineas, ≤ 1000 bytes).
- `urlImagen`: si `cover_image_url` empieza con `https://` se devuelve tal cual; si empieza con `/` y hay `siteUrl` https, se antepone `siteUrl` (sin barra final); si no, `null` (Instagram solo acepta https).
- `tarjetaDe`: `titulo = "{nombre} {anio}"`; `subtitulo = "{km} · {combustible} · {precio ?? 'precio con ' + secretaria}"` (si el km es "Consulta..." se omite); botones `[ {titulo:"Ver en la web", url: linkFicha}, botonNati ]`; `imagenUrl = urlImagen`.
- `botonNati`: `titulo = "Hablar con " + negocio.secretaria` (≤ 20 caracteres), `url = buildWhatsAppUrlInstagram(v)`.
- `elegir`: hash simple de la semilla (suma de codigos de caracter) modulo la cantidad de variantes; con una lista vacia lanza error.

- [ ] **Step 1: Tests (fallan)**

Create `src/lib/bot/respuestas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { NEGOCIO } from "./negocio";
import {
  alternativaTexto,
  botonNati,
  datosVehiculo,
  elegir,
  linkFicha,
  precioDe,
  primerNombre,
  tarjetaContacto,
  tarjetaDe,
  urlImagen,
} from "./respuestas";

const por = (id: string) => CATALOGO.find((v) => v.id === id)!;
const ctx = { negocio: NEGOCIO, siteUrl: "https://posse.example" };

describe("elegir", () => {
  it("es determinista y siempre devuelve una de las variantes", () => {
    const vs = ["a", "b", "c"];

    expect(elegir(vs, "mid.1")).toBe(elegir(vs, "mid.1"));
    for (const s of ["x", "mid.2", "mid.99", ""]) expect(vs).toContain(elegir(vs, s));
  });

  it("reparte entre las variantes segun la semilla", () => {
    const usadas = new Set(Array.from({ length: 30 }, (_, i) => elegir(["a", "b", "c"], `mid.${i}`)));

    expect(usadas.size).toBeGreaterThan(1);
  });

  it("lanza con una lista vacia", () => {
    expect(() => elegir([], "x")).toThrow();
  });
});

describe("precioDe", () => {
  it("devuelve el precio cargado", () => {
    expect(precioDe(por("v-206"))).toBe("$9.500.000");
    expect(precioDe(por("v-vento"))).toBe("USD 14.500");
  });

  it("devuelve null si esta vacio o dice 'Consulta...'", () => {
    expect(precioDe(por("v-208"))).toBeNull();
    expect(precioDe({ ...por("v-206"), precio_texto: "" })).toBeNull();
    expect(precioDe({ ...por("v-206"), precio_texto: "Consultar" })).toBeNull();
    expect(precioDe({ ...por("v-206"), precio_texto: "  consulta por precio " })).toBeNull();
  });
});

describe("linkFicha", () => {
  it("arma el link a la ficha sin barras dobles", () => {
    expect(linkFicha(por("v-206"), "https://posse.example")).toBe("https://posse.example/vehiculos/peugeot-206-1-6-2011");
    expect(linkFicha(por("v-206"), "https://posse.example/")).toBe("https://posse.example/vehiculos/peugeot-206-1-6-2011");
  });

  it("sin siteUrl devuelve la ruta relativa", () => {
    expect(linkFicha(por("v-206"), "")).toBe("/vehiculos/peugeot-206-1-6-2011");
  });
});

describe("urlImagen", () => {
  it("acepta https absoluta", () => {
    expect(urlImagen(por("v-206"), "https://posse.example")).toBe("https://img.example/peugeot-206-1-6-2011.jpg");
  });

  it("completa rutas del propio sitio y rechaza lo que Instagram no acepta", () => {
    expect(urlImagen({ ...por("v-206"), cover_image_url: "/img/206.jpg" }, "https://posse.example/")).toBe("https://posse.example/img/206.jpg");
    expect(urlImagen({ ...por("v-206"), cover_image_url: "/img/206.jpg" }, "")).toBeNull();
    expect(urlImagen({ ...por("v-206"), cover_image_url: "http://x/y.jpg" }, "https://posse.example")).toBeNull();
    expect(urlImagen({ ...por("v-206"), cover_image_url: null }, "https://posse.example")).toBeNull();
  });
});

describe("datosVehiculo", () => {
  it("resume año, km, combustible y transmision", () => {
    expect(datosVehiculo(por("v-206"))).toBe("2011 · 177.000 km · Nafta · Manual");
  });

  it("omite el km si no esta cargado", () => {
    expect(datosVehiculo({ ...por("v-206"), kilometraje: "Consultá km" })).toBe("2011 · Nafta · Manual");
  });
});

describe("botonNati y tarjetas", () => {
  it("el boton abre el WhatsApp de Nati con el mensaje del auto", () => {
    const b = botonNati(por("v-206"), NEGOCIO);

    expect(b.titulo).toBe("Hablar con Nati");
    expect(b.titulo.length).toBeLessThanOrEqual(20);
    expect(b.url.startsWith("https://wa.me/5493537558947?text=")).toBe(true);
    expect(decodeURIComponent(b.url)).toContain("Peugeot 206 1.6");
  });

  it("sin auto, el boton manda una consulta general", () => {
    expect(decodeURIComponent(botonNati(null, NEGOCIO).url)).toContain("Quiero consultar por un vehículo");
  });

  it("tarjetaDe lleva foto, datos, precio y los dos botones", () => {
    const t = tarjetaDe(por("v-206"), ctx);

    expect(t.titulo).toBe("Peugeot 206 1.6 2011");
    expect(t.subtitulo).toContain("177.000 km");
    expect(t.subtitulo).toContain("$9.500.000");
    expect(t.imagenUrl).toBe("https://img.example/peugeot-206-1-6-2011.jpg");
    expect(t.botones.map((b) => b.titulo)).toEqual(["Ver en la web", "Hablar con Nati"]);
    expect(t.botones[0].url).toBe("https://posse.example/vehiculos/peugeot-206-1-6-2011");
  });

  it("sin precio cargado el subtitulo manda a consultarlo con Nati", () => {
    const t = tarjetaDe(por("v-208"), ctx);

    expect(t.subtitulo).toContain("Nati");
    expect(t.subtitulo).not.toMatch(/consult[aá] precio/i);
  });

  it("tarjetaContacto es una tarjeta sin foto con solo el boton de Nati", () => {
    const t = tarjetaContacto(null, ctx);

    expect(t.imagenUrl).toBeNull();
    expect(t.botones).toHaveLength(1);
    expect(t.botones[0].titulo).toBe("Hablar con Nati");
  });
});

describe("alternativaTexto", () => {
  it("lista los autos con su precio y su link para el caso en que falle la tarjeta", () => {
    const t = alternativaTexto([por("v-206"), por("v-208")], ctx);

    expect(t).toContain("Peugeot 206 1.6");
    expect(t).toContain("$9.500.000");
    expect(t).toContain("https://posse.example/vehiculos/peugeot-206-1-6-2011");
    expect(t).toContain("https://posse.example/vehiculos/peugeot-208-style-2023");
  });
});

describe("primerNombre", () => {
  it("toma la primera palabra del nombre del perfil", () => {
    expect(primerNombre({ nombre: "Juan Perez" })).toBe("Juan");
    expect(primerNombre({ nombre: "  ana  " })).toBe("ana");
  });

  it("devuelve null si no hay nombre", () => {
    expect(primerNombre(null)).toBeNull();
    expect(primerNombre({ usuario: "juan94" })).toBeNull();
    expect(primerNombre({ nombre: "   " })).toBeNull();
  });
});
```

Run → FAIL. Implementar `respuestas.ts` segun las reglas. Run: `npx vitest run src/lib/bot/respuestas.test.ts` → PASS; `npx tsc --noEmit` limpio.

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/respuestas.ts src/lib/bot/respuestas.test.ts
git commit -m "feat: helpers de formato del bot (precio, links, tarjetas con boton a Nati, variantes deterministas)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: El motor de conversacion (`conversar`) y las conversaciones doradas

Esta es la tarea central. Los **tests son el contrato**: las respuestas se verifican por contenido (datos del auto, "Nati", links, estado de la sesion) y por reglas de tono, no por frases exactas, para que el texto pueda sonar natural y variar.

**Files:**
- Create: `src/lib/bot/motor.ts`, `src/lib/bot/motor.test.ts`
- Modify (si hace falta): `src/lib/bot/respuestas.ts` y `respuestas.test.ts` (agregar helpers; no cambiar los existentes)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:

```ts
export type EntradaMotor = {
  /** null si el mensaje no trae texto (adjunto). */
  texto: string | null;
  adjuntos: string[];
  historiaId: string | null;
  /** Auto vinculado a `historiaId` en la base (null si la historia no se conoce). */
  vehiculoDeHistoria: string | null;
  mid: string;                    // semilla de las variantes de texto
  sesion: Sesion;
  catalogo: VehiculoCatalogo[];
  perfil: Perfil | null;
  ahora: Date;
  siteUrl: string;
  negocio: Negocio;
};

export type ResultadoMotor = {
  mensajes: MensajeSalida[];                                   // maximo 3
  sesion: Sesion;                                              // la nueva (con ultimaActividad = ahora)
  lead: LeadInput | null;                                      // para guardar en leads
  aprenderHistoria: { storyId: string; vehiculoId: string } | null;
  olvidarHistoria: string | null;                              // story_id cuyo vinculo hay que borrar
  noEntendido: boolean;
  /** false = no hay que contestar nada (emoji suelto sin contexto, mencion en historia). */
  responder: boolean;
};

export function conversar(e: EntradaMotor): ResultadoMotor;
```

**Reglas del motor** (orden de evaluacion; la primera que aplica responde):
1. **Sesion**: si `!sesionVigente(e.sesion, e.ahora)` se parte de `sesionNueva(e.ahora)`. Al final `ultimaActividad = e.ahora`.
2. **Sin texto**: `adjuntos` solo `["story_mention"]` → `responder:false`. Con `audio` → "no puedo escuchar audios por acá, ¿me lo escribís?". Cualquier otro adjunto (imagen, video, reel/post compartido) → dice que por aca no puede ver la foto/imagen y pide que cuente por escrito que auto busca o cual es (el texto debe mencionar la palabra "foto" o "imagen"). En ambos casos `responder:true`.
3. **Solo emojis** (`esSoloEmojis`): **sin contexto** (paso libre, sin `vehiculoActualId`, sin `ofrecio`, sin historia) → `responder:false`, sea cual sea el emoji. **Con contexto**, 👍 👌 🙌 ✅ 🙏 💪 cuentan como afirmacion (se trata como `afirmacion` segun `ofrecio`) y cualquier otro emoji → `responder:false`.
4. **Pasos de captacion** (`pidiendo_nombre`, `pidiendo_telefono`): "cancelar"/"no"/"dejalo" salen del paso con un cierre amable. Nombre: 1-4 palabras sin digitos → guarda y pide telefono; si no parece un nombre, repregunta una vez. Telefono: se valida con 8 a 13 digitos (se guarda el texto recortado tal cual); valido → `lead = { nombre, telefono, vehiculo_interes: lead.vehiculoInteres, mensaje: lead.motivo }` + confirmacion (+ tarjeta de contacto con Nati); invalido → repregunta una vez, y a la segunda manda el boton de Nati y sale.
5. **Paso `eligiendo_historia`**: resuelve con ordinal (1-5 sobre `sesion.mostradosIds`, que son `recientes(catalogo, 5)`), con un auto nombrado, o con "ninguno/otro/no es ninguno" (→ muestra el catalogo y sale del paso). Al resolver: `aprenderHistoria = { storyId: historiaPendienteId, vehiculoId }`, `vehiculoActualId` = ese, y se **responde la `preguntaPendiente`** sobre ese auto. Si no entiende, repregunta (cuenta como fallo).
6. **Mensaje que es respuesta a una historia** (`historiaId != null`):
   - `vehiculoDeHistoria` conocido → ese es el auto (`vehiculoActualId`, `historiaActualId = historiaId`).
   - desconocido y el texto nombra **un** auto → ese; `aprenderHistoria`.
   - nombra **varios** → pregunta cual de esos (lista corta).
   - no nombra ninguno → `paso = "eligiendo_historia"`, `historiaPendienteId`, `preguntaPendiente = texto`; pregunta "¿por cuál auto de la historia me escribís?" mostrando `recientes(catalogo, 5)` numerados en el texto (1) 2) …). **Preferido:** mostrar esos 5 como tarjetas con foto (el cliente reconoce el auto por la imagen) mas una linea de texto que mencione la historia; `mostradosIds` = esos 5 ids, en orden. Si se muestran como texto, la lista va en pocas lineas compactas (varios items por linea) para no pasar de 5 lineas.
   Luego se procesa el resto del texto con ese auto en contexto (precio, info, saludo…).
7. **Correccion**: `negacion` ("no es ese", "ese no") cuando hay `historiaActualId` → `olvidarHistoria = historiaActualId`, se limpia `vehiculoActualId`, `historiaPendienteId = historiaActualId` (para volver a aprenderla con la eleccion), `preguntaPendiente = null`, y se vuelve a preguntar cual (paso `eligiendo_historia`).
8. **Intenciones** (de `detectarIntenciones`, en orden):
   - `humano` → mensaje calido + tarjeta de contacto/boton de Nati.
   - `identidad` → respuesta honesta: es el asistente virtual de la concesionaria y Nati atiende por WhatsApp (con boton).
   - `avisame` → "dale, te aviso cuando entre": guarda en `lead.motivo` lo pedido (texto) y pasa a `pidiendo_nombre`.
   - `precio` / `info` / `disponibilidad` → necesitan auto: `vehiculoIds` del texto (si hay uno), o `deictico`/`ordinal` sobre `mostradosIds`, o `vehiculoActualId`; si hay varios candidatos, pregunta cual; si no hay ninguno, pregunta de que auto habla (y ofrece el catalogo). Con auto: `presentarVehiculo`.
   - `financiacion` / `permuta` / `pagos` / `horarios` / `ubicacion` / `garantia` / `documentacion` → texto de `negocio` si no es `null`; si es `null`, "eso te lo confirma Nati" + boton de Nati. (Sin inventar.)
   - **Auto nombrado sin otra intencion especifica** (el texto nombra exactamente un auto y las intenciones son solo `desconocida`/`saludo`/`gracias`/`catalogo`): se presenta ese auto (`presentarVehiculo`). Ej.: "tienen la 206?", "la partner", "tienen la xr 150?".
   - `catalogo` o filtros en las entidades → `buscar`; mostrar hasta 5 como tarjetas + una linea. Si hubo relajacion: decir que no hay con eso exacto y mostrar lo mas cercano. Sin nada: decir que no hay ahora y ofrecer avisar ("¿querés que te avise cuando entre?" → `ofrecio = "aviso"`). Guardar `filtros`, `mostradosIds`, `vistosIds`.
   - `ver_mas` → los siguientes 5 de la busqueda actual que no esten en `vistosIds`; si no quedan, lo dice y ofrece a Nati.
   - `afirmacion` segun `ofrecio`: `contacto` → boton de Nati; `mas` → como `ver_mas`; `aviso` → `pidiendo_nombre`; sin `ofrecio` → pregunta que busca.
   - `negacion` sin contexto → "sin problema" y deja la puerta abierta.
   - `gracias` / `despedida` / `cortesia` / `saludo` → conversacion natural. El saludo usa `primerNombre(perfil)` solo la primera vez (`saludado`). Un saludo con otra intencion antepone el saludo breve.
   - `desconocida` → `fallos+1`, `noEntendido = true`: 1.º repregunta con ejemplos ("¿buscás auto, moto o utilitario?"); 2.º en adelante menu corto + boton de Nati.
9. **`presentarVehiculo(v)`**: `disponible` → texto con datos + precio (o "el precio te lo pasa Nati") + `tarjetaDe`; `reservado` → dice que esta reservado y ofrece avisar si se libera / ver parecidos; `vendido` → "ese ya se vendió" + `similares` como tarjetas (si no hay, ofrece avisar). Siempre setea `vehiculoActualId`, `ofrecio = "contacto"` si es disponible.
10. **Invariantes**: ≤ 3 mensajes por turno; cada texto cumple `violacionesDeTono(...) === []` (incluida `alternativaTexto` de cada tarjeta); sin markdown; nunca afirmar datos que no esten en el catalogo/negocio; emojis con naturalidad.
11. **Estilo** (para escribir las variantes con `elegir(variantes, e.mid + <clave>)`): coloquial rioplatense como escribe el equipo ("¡Hola Juanma! 👋", "Dale, te cuento 😊", "Sii, esa es de las que más preguntan 😉", "Uh, esa ya se vendió 😕 pero mirá estas que tengo parecidas 👇", "¿Querés que Nati te pase el precio por WhatsApp? 💬"); 2 a 4 variantes por situacion; frases cortas.

- [ ] **Step 1: Tests (fallan)**

Create `src/lib/bot/motor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { violacionesDeTono } from "./__fixtures__/tono";
import { conversar, type ResultadoMotor } from "./motor";
import { NEGOCIO, type Negocio } from "./negocio";
import { sesionNueva, type Sesion } from "./sesion";
import type { VehiculoCatalogo } from "./types";

const AHORA = new Date("2026-10-11T15:00:00Z");
const SITE = "https://posse.example";

type Turno = string | { texto?: string | null; historiaId?: string; adjuntos?: string[] };
type Opciones = {
  historias?: Record<string, string>;
  catalogo?: VehiculoCatalogo[];
  negocio?: Negocio;
  perfil?: { nombre?: string; usuario?: string } | null;
  sesion?: Sesion;
  ahora?: Date;
};

/** Simula una charla: encadena la sesion de cada turno en el siguiente. */
function charlar(turnos: Turno[], o: Opciones = {}): ResultadoMotor[] {
  let sesion = o.sesion ?? sesionNueva(AHORA);
  return turnos.map((turno, i) => {
    const t = typeof turno === "string" ? { texto: turno } : turno;
    const r = conversar({
      texto: t.texto ?? null,
      adjuntos: t.adjuntos ?? [],
      historiaId: t.historiaId ?? null,
      vehiculoDeHistoria: t.historiaId ? (o.historias?.[t.historiaId] ?? null) : null,
      mid: `mid.${i}`,
      sesion,
      catalogo: o.catalogo ?? CATALOGO,
      perfil: o.perfil ?? null,
      ahora: o.ahora ?? AHORA,
      siteUrl: SITE,
      negocio: o.negocio ?? NEGOCIO,
    });
    sesion = r.sesion;
    return r;
  });
}

const textos = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "texto" ? [m.texto] : [m.alternativaTexto]));
const tarjetas = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas : []));
const todo = (r: ResultadoMotor) =>
  [...textos(r), ...tarjetas(r).flatMap((t) => [t.titulo, t.subtitulo, ...t.botones.map((b) => b.titulo)])].join("\n");
const urls = (r: ResultadoMotor) => tarjetas(r).flatMap((t) => t.botones.map((b) => b.url));
const hayBotonNati = (r: ResultadoMotor) => urls(r).some((u) => u.startsWith("https://wa.me/5493537558947?text="));
const titulos = (r: ResultadoMotor) => tarjetas(r).map((t) => t.titulo);

describe("respuestas a historias (los casos reales)", () => {
  it("historia conocida + 'me decis el precio?' → precio del auto y boton a Nati", () => {
    const [r] = charlar([{ texto: "hola. me decis el precio?", historiaId: "st-206" }], { historias: { "st-206": "v-206" } });

    expect(r.responder).toBe(true);
    expect(todo(r)).toContain("206");
    expect(todo(r)).toContain("$9.500.000");
    expect(tarjetas(r)).toHaveLength(1);
    expect(hayBotonNati(r)).toBe(true);
    expect(r.sesion.vehiculoActualId).toBe("v-206");
    expect(r.sesion.historiaActualId).toBe("st-206");
    expect(r.aprenderHistoria).toBeNull();
  });

  it("historia de un auto sin precio cargado → Nati lo pasa por WhatsApp", () => {
    const [r] = charlar([{ texto: "hola, me decis el precio?", historiaId: "st-208" }], { historias: { "st-208": "v-208" } });

    expect(todo(r)).toContain("208");
    expect(todo(r)).toContain("Nati");
    expect(todo(r)).not.toMatch(/consult[aá] precio/i);
    expect(hayBotonNati(r)).toBe(true);
  });

  it("historia del Vento + 'hola que valor tiene?'", () => {
    const [r] = charlar([{ texto: "Hola qué valor tiene?", historiaId: "st-vento" }], { historias: { "st-vento": "v-vento" } });

    expect(todo(r)).toContain("Vento");
    expect(todo(r)).toContain("USD 14.500");
  });

  it("historia desconocida sin nombrar el auto → pregunta cual (con la lista) y recuerda la pregunta", () => {
    const [r] = charlar([{ texto: "hola que valor tiene?", historiaId: "st-nueva" }]);

    expect(textos(r).join("\n")).toMatch(/historia/i);
    expect(textos(r).join("\n")).toContain("206");
    expect(r.sesion.paso).toBe("eligiendo_historia");
    expect(r.sesion.historiaPendienteId).toBe("st-nueva");
    expect(r.sesion.preguntaPendiente).toContain("valor");
    expect(r.aprenderHistoria).toBeNull();
  });

  it("... y cuando el cliente elige, aprende la historia y responde la pregunta pendiente", () => {
    const [, r] = charlar([{ texto: "hola que valor tiene?", historiaId: "st-nueva" }, "el 2"]);

    // la lista es: 1 amarok, 2 206, 3 208, 4 vento, 5 kangoo
    expect(r.aprenderHistoria).toEqual({ storyId: "st-nueva", vehiculoId: "v-206" });
    expect(todo(r)).toContain("$9.500.000");
    expect(r.sesion.paso).toBe("libre");
    expect(r.sesion.vehiculoActualId).toBe("v-206");
    expect(r.sesion.historiaActualId).toBe("st-nueva");
  });

  it("... tambien se puede elegir nombrando el auto", () => {
    const [, r] = charlar([{ texto: "cuanto sale?", historiaId: "st-x" }, "el vento"]);

    expect(r.aprenderHistoria).toEqual({ storyId: "st-x", vehiculoId: "v-vento" });
    expect(todo(r)).toContain("USD 14.500");
  });

  it("historia desconocida pero el texto nombra el auto → responde ese auto y aprende, sin preguntar", () => {
    const [r] = charlar([{ texto: "Hola buenas tardes, me pasas mas info del 206, gracias", historiaId: "st-206b" }]);

    expect(r.aprenderHistoria).toEqual({ storyId: "st-206b", vehiculoId: "v-206" });
    expect(todo(r)).toContain("177.000 km");
    expect(r.sesion.paso).toBe("libre");
    expect(textos(r).join("\n")).not.toMatch(/por cu[aá]l auto/i);
  });

  it("si el cliente dice que no es ese auto, olvida el vinculo y vuelve a preguntar", () => {
    const [, r] = charlar(
      [{ texto: "me decis el precio?", historiaId: "st-206" }, "no, ese no es"],
      { historias: { "st-206": "v-206" } },
    );

    expect(r.olvidarHistoria).toBe("st-206");
    expect(r.sesion.vehiculoActualId).toBeNull();
    expect(r.sesion.paso).toBe("eligiendo_historia");
  });
});

describe("autos vendidos, reservados y pedidos coloquiales", () => {
  it("foto sin texto → pide que cuente cual es; despues 'la partner' (vendida) → avisa y ofrece utilitarios parecidos", () => {
    const [a, b, c] = charlar([{ adjuntos: ["image"] }, "esa es la que había visto, la partner", "algún utilitario así?"]);

    expect(todo(a)).toMatch(/foto|imagen/i);
    expect(a.responder).toBe(true);

    expect(todo(b)).toMatch(/vendi/i);
    expect(titulos(b).join(" ")).toContain("Kangoo");
    expect(titulos(b).join(" ")).not.toContain("Partner");

    expect(titulos(c).join(" ")).toContain("Kangoo");
    expect(titulos(c).join(" ")).not.toContain("Partner");
  });

  it("entiende 'chatita'", () => {
    const [r] = charlar(["tienen alguna chatita?"]);

    expect(titulos(r).join(" ")).toContain("Kangoo");
  });

  it("un auto reservado se dice reservado", () => {
    const [r] = charlar(["tienen la xr 150?"]);

    expect(todo(r)).toMatch(/reservad/i);
  });

  it("tolera errores de tipeo en los modelos", () => {
    expect(todo(charlar(["cuanto sale el vento?"])[0])).toContain("USD 14.500");
    expect(titulos(charlar(["tenes una amarrok?"])[0]).join(" ")).toContain("Amarok");
    expect(todo(charlar(["precio del corola"])[0])).toContain("USD 9.500");
  });
});

describe("catalogo y busquedas", () => {
  it("'que autos tienen?' → carrusel de hasta 5 disponibles, sin vendidos ni reservados", () => {
    const [r] = charlar(["que autos tienen?"]);

    expect(tarjetas(r).length).toBeGreaterThan(0);
    expect(tarjetas(r).length).toBeLessThanOrEqual(5);
    expect(titulos(r).join(" ")).not.toContain("Partner");
    expect(titulos(r).join(" ")).not.toContain("XR 150");
    expect(r.sesion.mostradosIds.length).toBe(tarjetas(r).length);
  });

  it("'ver mas' muestra los que faltan sin repetir", () => {
    const [a, b] = charlar(["que autos tienen?", "mostrame mas"]);

    const primeros = titulos(a);
    expect(titulos(b).length).toBeGreaterThan(0);
    for (const t of titulos(b)) expect(primeros).not.toContain(t);
  });

  it("pickup nafta (no hay) → lo dice y muestra la pickup mas cercana", () => {
    const [r] = charlar(["busco una pickup nafta"]);

    expect(textos(r).join("\n")).toMatch(/no (tengo|hay)/i);
    expect(titulos(r).join(" ")).toContain("Amarok");
  });

  it("sin nada parecido ofrece avisar cuando entre", () => {
    const [r] = charlar(["tienen alguna moto 250?"]);

    expect(textos(r).join("\n")).toMatch(/avis/i);
    expect(r.sesion.ofrecio).toBe("aviso");
  });
});

describe("derivacion, identidad y datos del negocio", () => {
  it("'hablo con el dueño?' → boton de WhatsApp con Nati, sin pedir datos", () => {
    const [r] = charlar(["hablo con el dueño?"]);

    expect(todo(r)).toContain("Nati");
    expect(hayBotonNati(r)).toBe(true);
    expect(r.sesion.paso).toBe("libre");
  });

  it("'sos un bot?' → respuesta honesta y boton a Nati", () => {
    const [r] = charlar(["sos un bot?"]);

    expect(todo(r)).toMatch(/asistente virtual/i);
    expect(todo(r)).toContain("Nati");
    expect(hayBotonNati(r)).toBe(true);
  });

  it("financiacion: usa el texto del negocio si esta cargado", () => {
    const [r] = charlar(["hacen financiacion?"], { negocio: { ...NEGOCIO, financiacion: "Financiamos hasta 60% con cuotas fijas." } });

    expect(todo(r)).toContain("Financiamos hasta 60% con cuotas fijas.");
  });

  it("financiacion pendiente (null) → no inventa: lo confirma Nati", () => {
    const [r] = charlar(["hacen financiacion?"], { negocio: { ...NEGOCIO, financiacion: null } });

    expect(todo(r)).toContain("Nati");
    expect(hayBotonNati(r)).toBe(true);
  });

  it("horarios: pendiente → Nati; cargados → los dice", () => {
    expect(todo(charlar(["a que hora abren?"])[0])).toContain("Nati");
    expect(todo(charlar(["a que hora abren?"], { negocio: { ...NEGOCIO, horarios: "Lunes a viernes de 9 a 13 y de 16 a 20" } })[0])).toContain(
      "Lunes a viernes de 9 a 13 y de 16 a 20",
    );
  });
});

describe("captacion de datos (secundaria)", () => {
  it("'avisame cuando entre una hilux' → pide nombre, despues telefono, y entrega el lead", () => {
    const [a, b, c] = charlar(["avisame cuando entre una hilux", "Juan Pérez", "3537 123456"]);

    expect(a.sesion.paso).toBe("pidiendo_nombre");
    expect(b.sesion.paso).toBe("pidiendo_telefono");
    expect(c.lead).toMatchObject({ nombre: "Juan Pérez", telefono: "3537 123456" });
    expect(c.lead?.mensaje ?? "").toMatch(/hilux/i);
    expect(c.sesion.paso).toBe("libre");
  });

  it("un telefono invalido se repregunta; 'cancelar' sale del paso", () => {
    const [, , c, d] = charlar(["avisame cuando entre una hilux", "Juan", "hola", "cancelar"]);

    expect(c.lead).toBeNull();
    expect(c.sesion.paso).toBe("pidiendo_telefono");
    expect(d.sesion.paso).toBe("libre");
    expect(d.lead).toBeNull();
  });
});

describe("conversacion natural", () => {
  it("'Hola !como estas??' → saluda y pregunta que busca, sin tarjetas", () => {
    const [r] = charlar(["Hola !como estas??"]);

    expect(tarjetas(r)).toHaveLength(0);
    expect(textos(r).join("\n")).toMatch(/\?/);
  });

  it("el primer saludo usa el nombre del perfil", () => {
    const [r] = charlar(["hola"], { perfil: { nombre: "Juanma Centurion" } });

    expect(todo(r)).toContain("Juanma");
  });

  it("agradecer y despedirse cierran amable", () => {
    const [r] = charlar(["gracias, chau"]);

    expect(r.responder).toBe(true);
    expect(tarjetas(r)).toHaveLength(0);
  });

  it("no entendido: repregunta la primera vez y ofrece a Nati la segunda", () => {
    const [a, b] = charlar(["asdfgh", "qwerty"]);

    expect(a.noEntendido).toBe(true);
    expect(b.noEntendido).toBe(true);
    expect(a.sesion.fallos).toBe(1);
    expect(b.sesion.fallos).toBe(2);
    expect(hayBotonNati(a)).toBe(false);
    expect(hayBotonNati(b)).toBe(true);
  });

  it("entender algo despues de un fallo reinicia el contador", () => {
    const [, b] = charlar(["asdfgh", "que autos tienen?"]);

    expect(b.noEntendido).toBe(false);
    expect(b.sesion.fallos).toBe(0);
  });
});

describe("mensajes que no son texto", () => {
  it("audio → pide que lo escriba", () => {
    const [r] = charlar([{ adjuntos: ["audio"] }]);

    expect(r.responder).toBe(true);
    expect(todo(r)).toMatch(/audio/i);
    expect(todo(r)).toMatch(/escrib/i);
  });

  it("emoji suelto sin contexto → no responde", () => {
    expect(charlar(["🎉"])[0].responder).toBe(false);
    expect(charlar(["👍"])[0].responder).toBe(false);
  });

  it("mencion en una historia → no responde", () => {
    expect(charlar([{ adjuntos: ["story_mention"] }])[0].responder).toBe(false);
  });

  it("un 👍 dentro de una conversacion cuenta como afirmacion", () => {
    const [, r] = charlar(["tienen la 206?", "👍"]);

    expect(r.responder).toBe(true);
    expect(hayBotonNati(r)).toBe(true);
  });
});

describe("sesion", () => {
  it("una sesion vencida (25 h) arranca sin contexto", () => {
    const vieja = { ...sesionNueva(new Date("2026-10-10T14:00:00Z")), vehiculoActualId: "v-206", saludado: true };
    const [r] = charlar(["cuanto sale?"], { sesion: vieja });

    expect(r.sesion.vehiculoActualId).toBeNull();
    expect(textos(r).join("\n")).toMatch(/cu[aá]l|qu[eé] auto/i);
  });

  it("'cuanto sale?' sin auto en contexto pregunta de cual habla", () => {
    const [r] = charlar(["cuanto sale?"]);

    expect(textos(r).join("\n")).toMatch(/cu[aá]l|qu[eé] auto/i);
    expect(r.noEntendido).toBe(false);
  });

  it("'y el precio?' despues de mostrar un auto usa ese auto", () => {
    const [, r] = charlar(["tienen la 206?", "y el precio?"]);

    expect(todo(r)).toContain("$9.500.000");
  });

  it("actualiza la ultima actividad", () => {
    expect(charlar(["hola"])[0].sesion.ultimaActividad).toBe(AHORA.toISOString());
  });
});

describe("invariantes de tono y de formato en cualquier respuesta", () => {
  const entradas: Turno[] = [
    "hola", "Hola !como estas??", "que autos tienen?", "tienen alguna chatita?", "busco una pickup nafta",
    "hablo con el dueño?", "sos un bot?", "hacen financiacion?", "toman usados?", "a que hora abren?", "donde estan?",
    "tienen garantia?", "que papeles necesito", "formas de pago", "avisame cuando entre una hilux", "asdfgh", "gracias",
    "tienen alguna moto 250?", "la partner", "cuanto sale?", { adjuntos: ["audio"] }, { adjuntos: ["image"] },
    { texto: "me decis el precio?", historiaId: "st-206" }, { texto: "que valor tiene?", historiaId: "st-nueva" },
  ];

  it("todo texto cumple las reglas de tono y nunca pasa de 3 mensajes", () => {
    for (const entrada of entradas) {
      const [r] = charlar([entrada], { historias: { "st-206": "v-206" } });

      expect(r.mensajes.length).toBeLessThanOrEqual(3);
      for (const t of textos(r)) expect(violacionesDeTono(t), `${JSON.stringify(entrada)} → ${t}`).toEqual([]);
    }
  });

  it("las tarjetas respetan los limites de Instagram", () => {
    for (const entrada of entradas) {
      const [r] = charlar([entrada], { historias: { "st-206": "v-206" } });

      for (const m of r.mensajes) {
        if (m.tipo !== "tarjetas") continue;
        expect(m.tarjetas.length).toBeLessThanOrEqual(10);
        for (const t of m.tarjetas) {
          expect(t.botones.length).toBeLessThanOrEqual(3);
          for (const b of t.botones) expect(b.titulo.length).toBeLessThanOrEqual(20);
          if (t.imagenUrl) expect(t.imagenUrl.startsWith("https://")).toBe(true);
        }
      }
    }
  });

  it("es determinista: la misma entrada da la misma respuesta", () => {
    expect(charlar(["hola"])).toEqual(charlar(["hola"]));
  });

  it("nunca menciona datos que no estan en el catalogo", () => {
    const [r] = charlar(["cuanto sale la 208?"]);

    expect(todo(r)).not.toMatch(/\$\s?\d|USD\s?\d/);
  });
});
```

Run: `npx vitest run src/lib/bot/motor.test.ts` → FAIL (modulo inexistente).

- [ ] **Step 2: Implementar `motor.ts` hasta que pasen**

Implementar segun las reglas (usar `normalizar`, `detectarIntenciones`, `extraerEntidades`, `buscar`, `similares`, `recientes`, `filtrosDeEntidades` y los helpers de `respuestas.ts`). Reglas de trabajo:
- Iterar con `npx vitest run src/lib/bot/motor.test.ts` hasta verde.
- **No cambiar los tests para que pasen.** Si un test parece imposible o contradice a otro, o si una regla del spec choca con el test, detenerse y reportarlo como `DONE_WITH_CONCERNS`/`NEEDS_CONTEXT` con el caso exacto.
- Si para que pasen los tests hay que agregar sinonimos o frases a `vocabulario.ts`/`intenciones.ts`, se puede (son datos), y se corren tambien sus tests.
- Mantener el motor **puro**: sin `Date.now()`, sin `Math.random()`, sin I/O (el tiempo entra por `e.ahora`, la variacion por `e.mid`).
- Agregar a `motor.test.ts` los casos que se descubran necesarios, nunca quitar los de arriba.

Run: `npx vitest run` (suite completa) y `npx tsc --noEmit` → verdes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/motor.ts src/lib/bot/motor.test.ts src/lib/bot/respuestas.ts src/lib/bot/respuestas.test.ts src/lib/bot/nlu
git commit -m "feat: motor de conversacion por reglas con historias, vendidos, derivacion a Nati y tono humano" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(Stagear solo los archivos que realmente se hayan modificado.)

---

### Task 10: Persistencia en Supabase

**Files:**
- Create: `src/lib/bot/catalogo.ts`, `src/lib/bot/catalogo.test.ts`
- Create: `src/lib/bot/sesiones.ts`, `src/lib/bot/sesiones.test.ts`
- Modify: `src/lib/bot/conversations.ts`, `src/lib/bot/conversations.test.ts` (agregar funciones; no tocar las existentes)

**Interfaces:** todas reciben `db: SupabaseClient` (solo `import type` de `@supabase/supabase-js`; sin `next/*`).

```ts
// catalogo.ts
export async function obtenerCatalogo(db: SupabaseClient): Promise<VehiculoCatalogo[] | null>; // null si falla (log), nunca lanza

// sesiones.ts
export type EstadoChat = { sesion: Sesion | null; pausaHasta: Date | null; perfil: Perfil | null };
export async function cargarChat(db, igUserId, ahora: Date): Promise<EstadoChat>;               // sin fila → todo null; error → todo null (log)
export async function guardarSesion(db, igUserId, sesion: Sesion): Promise<void>;               // upsert {ig_user_id, estado, actualizado}; lanza si falla
export async function pausarChat(db, igUserId, hasta: Date): Promise<void>;                     // upsert {ig_user_id, pausa_hasta, actualizado}
export async function guardarPerfil(db, igUserId, perfil: Perfil): Promise<void>;               // upsert {ig_user_id, perfil}
export async function vehiculoDeHistoria(db, storyId: string): Promise<string | null>;
export async function aprenderHistoria(db, storyId: string, vehiculoId: string): Promise<void>; // si ya apunta al mismo auto: confirmaciones+1; si no, reemplaza con confirmaciones 1
export async function olvidarHistoria(db, storyId: string): Promise<void>;

// conversations.ts (agregados)
export async function guardarSalida(db, igUserId, partes: Array<{ texto: string; mid: string | null }>): Promise<void>; // una fila role='assistant' por parte, con su mid
export async function esMidPropio(db, mid: string): Promise<boolean>;                           // existe una fila con ese mid
export async function marcarNoEntendido(db, mid: string): Promise<void>;                        // update ig_mensajes set nota='no_entendido' where mid=...
```

**Reglas:** `obtenerCatalogo`: `from("vehiculos_posse").select("id, slug, nombre, marca, modelo, anio, kilometraje, combustible, transmision, motor, tipo, descripcion, precio_texto, cover_image_url, estado, created_at").in("estado", ["disponible","reservado","vendido"]).is("deleted_at", null).order("created_at", { ascending: false }).limit(120)`. **Nunca** seleccionar `sale_price`, `sale_notes` ni `sold_at`. `cargarChat` convierte `pausa_hasta` a `Date`, `estado` con `normalizarSesion(estado, ahora)` y `perfil` a `Perfil | null`.

- [ ] **Step 1: Tests (fallan)**

Los tests usan fakes de Supabase encadenables, como los de `stock.test.ts`/`conversations.test.ts`. Escribir y hacer pasar, como minimo:

`catalogo.test.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { obtenerCatalogo } from "./catalogo";

function dbCon(resultado: { data: unknown; error: { message: string } | null }) {
  const llamadas: Record<string, unknown[]> = {};
  const registrar = (nombre: string) => (...args: unknown[]) => {
    (llamadas[nombre] ??= []).push(args);
    return consulta;
  };
  const consulta: Record<string, (...args: unknown[]) => unknown> = {
    select: registrar("select"),
    in: registrar("in"),
    is: registrar("is"),
    order: registrar("order"),
    limit: async (...args: unknown[]) => {
      (llamadas["limit"] ??= []).push(args);
      return resultado;
    },
  };
  let tabla = "";
  const db = { from: (t: string) => ((tabla = t), consulta) } as unknown as SupabaseClient;
  return { db, llamadas, tabla: () => tabla };
}

describe("obtenerCatalogo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lee vehiculos_posse con estados visibles, sin borrados, y sin columnas de venta", async () => {
    const { db, llamadas, tabla } = dbCon({ data: CATALOGO, error: null });

    const r = await obtenerCatalogo(db);

    expect(r).toEqual(CATALOGO);
    expect(tabla()).toBe("vehiculos_posse");
    const columnas = String((llamadas["select"][0] as unknown[])[0]);
    for (const c of ["id", "slug", "precio_texto", "cover_image_url", "estado", "created_at"]) expect(columnas).toContain(c);
    for (const privada of ["sale_price", "sale_notes", "sold_at"]) expect(columnas).not.toContain(privada);
    expect(llamadas["in"][0]).toEqual(["estado", ["disponible", "reservado", "vendido"]]);
    expect(llamadas["is"][0]).toEqual(["deleted_at", null]);
  });

  it("devuelve null (sin lanzar) si Supabase falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await obtenerCatalogo(dbCon({ data: null, error: { message: "caido" } }).db)).toBeNull();
  });
});
```

`sesiones.test.ts`: cubrir con fakes — `cargarChat` (sin fila → `{sesion:null, pausaHasta:null, perfil:null}`; con fila → sesion normalizada, `pausaHasta` como `Date`, perfil; error → todo null), `guardarSesion`/`pausarChat`/`guardarPerfil` (assert del `upsert` con `onConflict: "ig_user_id"` y de las columnas que se mandan; lanzan si el error viene de la base), `vehiculoDeHistoria` (devuelve `vehiculo_id` o null), `aprenderHistoria` (existente al mismo auto → update `confirmaciones+1`; otro auto o sin fila → upsert con `confirmaciones: 1`), `olvidarHistoria` (delete por `story_id`).

`conversations.test.ts` (agregar): `guardarSalida` inserta una fila `role:'assistant'` por parte con su `mid` (y `mid: null` si no hay); `esMidPropio` true/false segun exista la fila y false ante error; `marcarNoEntendido` hace `update({ nota: "no_entendido" }).eq("mid", mid)`.

Run: `npx vitest run src/lib/bot` → FAIL; implementar; PASS. `npx tsc --noEmit` limpio.

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/catalogo.ts src/lib/bot/catalogo.test.ts src/lib/bot/sesiones.ts src/lib/bot/sesiones.test.ts src/lib/bot/conversations.ts src/lib/bot/conversations.test.ts
git commit -m "feat: persistencia del bot por reglas (catalogo, sesiones, historias, pausa y mensajes propios)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Handler, cableado y webhook

**Files:**
- Rewrite: `src/lib/bot/handler.ts`, `src/lib/bot/handler.test.ts`
- Rewrite: `src/lib/bot/deps.ts`
- Modify: `src/app/api/instagram/webhook/route.ts`, `src/app/api/instagram/webhook/route.test.ts`

**Interfaces:**

```ts
// handler.ts
import type { EventoEntrante } from "../instagram/payload";

export const MENSAJE_ERROR_TECNICO: string;   // incluye el WhatsApp visible de Nati
export const MENSAJE_LEAD_FALLIDO: string;    // incluye el WhatsApp visible de Nati

export type DepsBot = {
  reclamarMensaje(senderId: string, mid: string, contenido: string): Promise<boolean>;
  cargarChat(senderId: string): Promise<{ sesion: Sesion | null; pausaHasta: Date | null; perfil: Perfil | null }>;
  guardarSesion(senderId: string, sesion: Sesion): Promise<void>;
  catalogo(): Promise<VehiculoCatalogo[] | null>;
  vehiculoDeHistoria(storyId: string): Promise<string | null>;
  aprenderHistoria(storyId: string, vehiculoId: string): Promise<void>;
  olvidarHistoria(storyId: string): Promise<void>;
  obtenerPerfil(senderId: string): Promise<Perfil | null>;       // mejor esfuerzo
  guardarPerfil(senderId: string, perfil: Perfil): Promise<void>;
  guardarLead(senderId: string, lead: LeadInput): Promise<void>;
  marcarVisto(senderId: string): Promise<void>;                    // mejor esfuerzo
  escribiendo(senderId: string): Promise<void>;                    // mejor esfuerzo
  enviarTexto(senderId: string, texto: string): Promise<string[]>; // lanza si falla; devuelve message_ids
  enviarTarjetas(senderId: string, tarjetas: Tarjeta[]): Promise<string[]>; // lanza si falla
  guardarSalida(senderId: string, partes: Array<{ texto: string; mid: string | null }>): Promise<void>;
  marcarNoEntendido(mid: string): Promise<void>;
  esMidPropio(mid: string): Promise<boolean>;
  pausar(senderId: string, hasta: Date): Promise<void>;
  esperar(ms: number): Promise<void>;
  ahora(): Date;
  siteUrl: string;
  negocio: Negocio;
};

export async function procesarEventos(eventos: EventoEntrante[], deps: DepsBot): Promise<void>; // nunca lanza
```

**Flujo por evento** (cada evento en su propio `try/catch`; el lote se procesa en orden):

- **`eco`**: `await deps.esperar(3000)` (el eco puede llegar antes de que el bot registre sus propios `mid`); si `await deps.esMidPropio(mid)` es `false` → lo mando una persona: `deps.pausar(destinatarioId, ahora + negocio.pausaHumanoHoras horas)`. Si es propio, no hace nada.
- **`mensaje`**:
  1. `reclamarMensaje(senderId, mid, texto ?? "[adjunto]")`; si es duplicado, termina.
  2. `cargarChat`; si `pausaHasta > ahora()` → **termina sin responder** (el mensaje quedo registrado).
  3. En paralelo (mejor esfuerzo, sin frenar la respuesta si fallan): `marcarVisto`, `catalogo()`, `vehiculoDeHistoria(historiaId)` si hay historia, y `obtenerPerfil` si todavia no hay perfil (si lo obtiene, `guardarPerfil`).
  4. Si `catalogo()` devuelve `null` → manda `MENSAJE_ERROR_TECNICO` (texto) y termina.
  5. `resultado = conversar({...})`. Si `!responder` → `guardarSesion` y termina.
  6. **Efectos**: `lead` → `guardarLead` (con `try/catch`: si falla, **reemplazar** los mensajes por `[MENSAJE_LEAD_FALLIDO]` y loguear); `aprenderHistoria`/`olvidarHistoria` (mejor esfuerzo, log si fallan); `guardarSesion` (mejor esfuerzo, log); `noEntendido` → `marcarNoEntendido(mid)` (mejor esfuerzo).
  7. **Envio**, mensaje por mensaje: `escribiendo` + `esperar(demora)` con `demora = min(1200, 400 + 12 * largoDelTexto)` y un **tope acumulado de 3000 ms por turno**; `texto` → `enviarTexto`; `tarjetas` → `enviarTarjetas` y, si lanza, `enviarTexto(alternativaTexto)` (y se loguea el motivo). Se juntan los `{texto, mid}` enviados.
  8. `guardarSalida(senderId, partes)` (mejor esfuerzo, log).
- **Errores**: si algo lanza fuera de lo "mejor esfuerzo", `console.error` y un intento de `enviarTexto(MENSAJE_ERROR_TECNICO)` (con su propio `try/catch`).

**`deps.ts`**: `crearDeps()` arma todo con `createAdminSupabaseClient()` y las funciones de `graph.ts`, `catalogo.ts`, `sesiones.ts`, `conversations.ts`, `leads.ts` (`guardarLead: (id, lead) => guardarLeadInstagram(db, id, lead)`), `esperar: (ms) => new Promise((r) => setTimeout(r, ms))`, `ahora: () => new Date()`, `siteUrl: process.env.SITE_URL ?? ""`, `negocio: NEGOCIO`. `marcarVisto`/`escribiendo` → `enviarAccion(id, "mark_seen"|"typing_on")` ignorando el resultado.

**`route.ts`**: usar `extraerEventos(payload)` y `procesarEventos(eventos, crearDeps())` (misma estructura y garantias: firma, 400/401/500/200).

- [ ] **Step 1: Tests del handler (fallan)**

Reescribir `handler.test.ts` con un `crearDeps()` falso (todas las deps como `vi.fn`, `esperar` instantaneo, `ahora` fija, catalogo = `CATALOGO`, `negocio = NEGOCIO`) y cubrir **al menos**:

1. Flujo normal: `reclamarMensaje` → `cargarChat` → `catalogo` → se envia la respuesta (`enviarTexto` y/o `enviarTarjetas`) → `guardarSesion` → `guardarSalida` con los `mid` devueltos.
2. Duplicado: `reclamarMensaje` false → no hace nada mas.
3. Pausado (`pausaHasta` futura): no envia nada, no llama al motor ni al catalogo.
4. Pausa vencida (`pausaHasta` pasada): responde normal.
5. Eco **propio** (`esMidPropio` true): no pausa. Eco **ajeno** (false): `pausar(destinatarioId, ahora + 6 h)`; ambos esperan 3000 ms antes de decidir (`esperar` llamado con 3000).
6. Tarjeta rechazada: `enviarTarjetas` lanza → se manda `alternativaTexto` por `enviarTexto`.
7. Lead: el motor devuelve `lead` → `guardarLead` se llama; si falla → se envia `MENSAJE_LEAD_FALLIDO` en lugar de la confirmacion y NO la confirmacion.
8. Historia: `aprenderHistoria`/`olvidarHistoria` se llaman con lo que devuelve el motor; si fallan, la respuesta igual sale.
9. Catalogo `null` → se envia `MENSAJE_ERROR_TECNICO`, sin llamar al motor.
10. `responder:false` → no envia; igual guarda la sesion.
11. Fallos "mejor esfuerzo" (`marcarVisto`, `escribiendo`, `obtenerPerfil`, `guardarSesion`, `guardarSalida`, `marcarNoEntendido`) no impiden que la respuesta salga.
12. Un evento que falla no frena a los siguientes del lote, y `procesarEventos` nunca lanza (ni aunque `enviarTexto` falle siempre).
13. `noEntendido` → `marcarNoEntendido(mid)`.
14. Demora: el tiempo total pedido a `esperar` por turno (sumando) no supera 3000 ms con 3 mensajes largos.
15. Perfil nuevo: si `cargarChat` no trae perfil y `obtenerPerfil` lo devuelve, se llama `guardarPerfil` y el motor recibe ese perfil.

Run: `npx vitest run src/lib/bot/handler.test.ts` → FAIL; implementar `handler.ts` y `deps.ts`; PASS.

- [ ] **Step 2: Webhook**

Actualizar `route.ts` y `route.test.ts` (los mocks pasan a `procesarEventos` y a la nueva firma; mantener todos los tests de GET/firma/400/401/500/200, mas: un POST firmado con un eco llama a `procesarEventos` con el evento `eco`; un POST con respuesta a historia llega con `historiaId`).

Run: `npx vitest run` (suite completa) y `npx tsc --noEmit` → verdes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/handler.ts src/lib/bot/handler.test.ts src/lib/bot/deps.ts src/app/api/instagram/webhook/route.ts src/app/api/instagram/webhook/route.test.ts
git commit -m "feat: handler del bot por reglas con pausa humana, visto/escribiendo y tarjetas con respaldo en texto" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Limpieza, documentacion y verificacion final

**Files:**
- Delete: `src/lib/bot/ai.ts`, `ai.test.ts`, `prompt.ts`, `prompt.test.ts`, `stock.ts`, `stock.test.ts`
- Modify: `src/lib/instagram/payload.ts` y `payload.test.ts` (eliminar `extraerMensajes`/`MensajeEntrante` viejos), `src/lib/bot/types.ts` (eliminar `TurnoHistorial` y `RespuestaIA`), `src/lib/bot/conversations.ts` y su test (eliminar `normalizarHistorial`, `obtenerHistorial`, `guardarRespuesta` si ya nadie los usa)
- Modify: `.env.example`, `docs/superpowers/specs/2026-10-06-bot-instagram-design.md` (nota de reemplazo)

- [ ] **Step 1: Confirmar que nada usa lo viejo**

Run: `grep -rn -E "from \"(\./|\.\./bot/|@/lib/bot/)(ai|prompt|stock)\"|extraerMensajes|TurnoHistorial|RespuestaIA|obtenerHistorial|normalizarHistorial" src` → lo unico que debe aparecer son las propias definiciones a eliminar. Si algo mas las usa, arreglarlo antes de borrar.

- [ ] **Step 2: Eliminar y ajustar**

Borrar los archivos de la lista y los exports viejos. `.env.example`: quitar `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_REASONING_EFFORT` (y cualquier `ANTHROPIC_*`) y dejar `IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `PAGE_ACCESS_TOKEN`, `SITE_URL`, `BOT_HORARIO` ya no se usa: quitarlo (los horarios viven en `negocio.ts`). En el spec del 2026-10-06 agregar al principio: `> **Reemplazado en lo referido a la IA por** docs/superpowers/specs/2026-10-11-bot-reglas-instagram-design.md`.

- [ ] **Step 3: Verificacion completa**

Run, y todo debe quedar en verde sin ruido:
- `npx vitest run`
- `npx tsc --noEmit`
- `npx eslint src/lib/bot src/lib/instagram src/app/api/instagram src/lib/utils.ts`
- `grep -rn -i -E "anthropic|groq|openai|LLM_" src package.json .env.example` → sin resultados en codigo fuente.
- `npm run build` → compila y lista `ƒ /api/instagram/webhook`. Despues, `git checkout -- next-env.d.ts` si el build lo modifico.

- [ ] **Step 4: Commit**

```bash
git add -A src/lib src/app/api/instagram .env.example docs/superpowers/specs/2026-10-06-bot-instagram-design.md
git status --short   # revisar que solo estan los archivos esperados antes del commit
git commit -m "chore: eliminar la capa de IA y dejar el bot de Instagram solo con reglas" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(En este commit se permite `git add -A` **acotado a esos paths** porque incluye eliminaciones; no incluir nada fuera de ellos.)

---

## Puesta en marcha (acciones del dueño, no de los subagentes)

1. **Supabase**: correr `supabase/schema-instagram-reglas.sql` (despues de `schema-instagram.sql`, que ya esta aplicado).
2. **Completar `src/lib/bot/negocio.ts`**: horarios, direccion y confirmar financiacion, permutas, pagos, garantia y documentacion (los precargados vienen del bot de WhatsApp anterior).
3. **Apagar la respuesta automatica de Instagram** ("respuesta instantanea"/saludo automatico) para que el cliente no reciba dos mensajes.
4. **Vercel**: variables `IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `PAGE_ACCESS_TOKEN`, `SITE_URL`; **no** hacen falta `ANTHROPIC_API_KEY` ni `LLM_*`. Mergear el PR y redesplegar.
5. **Meta**: crear la app, vincular la cuenta, webhook con el campo `messages`, app en modo Live (ver `docs/superpowers/plans/2026-10-06-bot-instagram.md`, Task 11).
6. **Prueba real** con una cuenta con rol en la app, en este orden: respuesta a una historia, auto vendido, "hablo con el dueño?", un audio, y **contestar vos a mano** para comprobar que el bot se calla.

## Supuestos a validar con trafico real (de la seccion 9 del spec)

Que los ecos llegan por el campo `messages`; que las tarjetas se ven bien en tu cuenta y las imagenes del catalogo tienen un formato aceptado (si no, cae al texto con link); que la API de perfil devuelve nombre y usuario con el permiso actual; como llega la reaccion a una historia; que 3 s alcanzan para distinguir el eco del bot del de una persona.
