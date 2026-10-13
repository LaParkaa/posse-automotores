# Postulaciones de vendedor por Instagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando alguien responda a la historia de "buscamos vendedor" (o escriba "cv", "busco trabajo"...), el bot pide los datos de un CV de a uno, los guarda en una tabla nueva y deriva al candidato a Marcos por WhatsApp, con una pantalla `/admin/postulantes` para verlas.

**Architecture:** Una intención nueva `empleo` en el NLU y un paso nuevo `postulando` en el motor puro `conversar()`, con un módulo propio `postulacion.ts` (mismo molde que `captacion.ts`). El motor devuelve `postulacion` como efecto, igual que `lead`; el `handler` la guarda por una dependencia inyectada (`guardarPostulacion`) y, si falla, no confirma y manda el botón a Marcos. La persistencia es una tabla `postulantes` (una fila por cuenta de Instagram, solo accesible con la service role).

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase, Vitest. Sin modelos de IA.

**Spec:** `docs/superpowers/specs/2026-10-13-postulaciones-vendedor-design.md` (leerlo antes de empezar). Contexto del bot: `docs/superpowers/specs/2026-10-11-bot-reglas-instagram-design.md`.

## Global Constraints

- **Rama:** todo el trabajo va en `feat/postulaciones` (ya creada desde `main`). Nunca `git add -A`: stagear solo los archivos de cada tarea. Commits con el trailer exacto `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. **No hacer push ni merge**: eso lo pide el dueño al final.
- **Cero IA con modelo.** El motor `conversar()` sigue siendo **puro**: sin red, sin base de datos, sin reloj ni azar. Toda la persistencia pasa por `DepsBot`.
- **Derivación a Marcos** (no a Nati): `+54 9 3537 66-2444`, dígitos `5493537662444`. Nati (`5493537558947`, constante `WHATSAPP_LOCAL`) sigue siendo el contacto de clientes.
- **Mensaje prearmado de WhatsApp sin emojis** (el navegador de Instagram los rompe en `wa.me`).
- **Tono:** rioplatense, **1 a 3 emojis por mensaje de texto**, máximo 5 líneas, sin markdown, sin fórmulas corporativas y sin afirmar ser una persona. Máximo 3 mensajes por turno. Texto de Instagram: máximo 1000 bytes.
- **Tarjetas de Instagram:** título ≤ 80, subtítulo ≤ 80, título de botón ≤ 20 caracteres, al menos un botón.
- **Datos pedidos, en este orden:** `nombre`, `edad`, `localidad`, `telefono`, `experiencia_ventas`, `experiencia_rubro`, `financiaciones`, `disponibilidad`. Edad válida de 16 a 75. Respuestas libres recortadas a 300 caracteres.
- **Detección solo por palabras clave.** "vendedor" suelto y "trabajo" suelto **no** disparan la postulación.
- **Nombre obligatorio** para guardar. Dos fallos seguidos en una pregunta: si es el nombre, se deriva a Marcos sin guardar; si es otro dato, se saltea y se sigue.
- Estilo: identificadores y comentarios en español, comentarios que explican el porqué; imports relativos dentro de `src/lib`, alias `@/` en `src/app`. Tests Vitest en `src/**/*.test.ts`. TDD.
- `whatsapp-bot/` no se toca.

## Review Focus

Entradas y fallas que el spec implica pero que ningún texto de la spec nombra. Cada una tiene su test en la tarea indicada:

1. **"quiero hablar con un vendedor", "lo necesito para trabajo", "un auto popular"** no arrancan una postulación (Task 2 y Task 6). Un cliente que quiere comprar nunca debe caer en el flujo de empleo.
2. **Respuestas libres con palabras de otras intenciones** ("tengo experiencia en financiaciones", "vendía a comisión", "mi horario de trabajo actual es de 8 a 16", "el precio lo negociaba yo") se guardan como respuesta y no sacan del flujo (Task 6).
3. **Responder "cv" a una historia que el bot no conoce** no pregunta "¿de qué auto era la historia?" (Task 5).
4. **Sesiones guardadas antes de este cambio** (sin `postulacion`) y jsonb corrupto no rompen el bot (Task 3).
5. **Respuestas larguísimas o con emojis** no rompen el límite de 1000 bytes ni el link de WhatsApp (Task 1 y Task 5).
6. **El candidato manda su CV como foto, audio o archivo** durante el flujo: el bot responde algo útil y manda el botón a Marcos, sin perder la pregunta pendiente (Task 6).

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/utils.ts` | modificar | `WHATSAPP_RECLUTADOR` y `buildWhatsAppUrlPostulacion` |
| `src/lib/bot/negocio.ts` | modificar | `NEGOCIO.reclutador` (Marcos) |
| `src/lib/bot/nlu/intenciones.ts` | modificar | intención `empleo` |
| `src/lib/bot/types.ts` | modificar | `PostulacionInput` |
| `src/lib/bot/sesion.ts` | modificar | paso `postulando`, `Sesion.postulacion`, normalización |
| `src/lib/bot/textos.ts` | modificar | textos de la postulación |
| `src/lib/bot/respuestas.ts` | modificar | `tarjetaPostulacion` |
| `src/lib/bot/turno.ts` | modificar | `Turno.postulacion`, `reclutador`, `mostrarContactoReclutador` |
| `src/lib/bot/postulacion.ts` | **crear** | el flujo de preguntas (`iniciarPostulacion`, `pasoPostulacion`) |
| `src/lib/bot/captacion.ts` | modificar | exportar `nombreDe` y `telefonoEn`; `empleo` cambia de tema |
| `src/lib/bot/motor.ts` | modificar | cablear el flujo y devolver `postulacion` |
| `src/lib/bot/postulaciones.ts` | **crear** | `guardarPostulacionInstagram` (upsert) |
| `src/lib/bot/handler.ts` | modificar | guardar la postulación y manejar el fallo |
| `src/lib/bot/deps.ts` | modificar | cablear `guardarPostulacion` |
| `supabase/schema-postulantes.sql` | **crear** | tabla `postulantes` |
| `src/app/admin/postulantes/page.tsx` | **crear** | pantalla de solo lectura |
| `src/components/admin-shell.tsx` | modificar | ítem de menú |
| `src/app/privacidad/page.tsx` | modificar | párrafo sobre postulaciones |
| tests | crear/modificar | uno por módulo (ver cada tarea) |

---

### Task 1: Datos de Marcos y link de WhatsApp de la postulación

**Files:**
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/bot/negocio.ts`
- Test: `src/lib/utils.test.ts`, `src/lib/bot/negocio.test.ts`

**Interfaces:**
- Produces:
  - `WHATSAPP_RECLUTADOR: string` (`"5493537662444"`), exportada desde `src/lib/utils.ts`.
  - `buildWhatsAppUrlPostulacion(datos: { nombre?: string | null; edad?: number | null; localidad?: string | null }, reclutador: { nombre: string; whatsappNumero: string }): string`.
  - `Reclutador = { nombre: string; whatsappNumero: string; whatsappVisible: string }` y `Negocio.reclutador: Reclutador`, exportados desde `src/lib/bot/negocio.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/lib/utils.test.ts`, cambiar el import de la línea 2 por:

```ts
import {
  buildWhatsAppUrl,
  buildWhatsAppUrlInstagram,
  buildWhatsAppUrlPostulacion,
  WHATSAPP_LOCAL,
  WHATSAPP_RECLUTADOR,
} from "./utils";
```

y agregar al final del archivo:

```ts
describe("buildWhatsAppUrlPostulacion", () => {
  const MARCOS = { nombre: "Marcos", whatsappNumero: WHATSAPP_RECLUTADOR };
  const textoDe = (url: string) => decodeURIComponent(url.split("?text=")[1]);

  it("arma el link al WhatsApp de Marcos con el resumen del candidato", () => {
    const url = buildWhatsAppUrlPostulacion(
      { nombre: "Juan Pérez", edad: 28, localidad: "Justiniano Posse" },
      MARCOS,
    );

    expect(url.startsWith(`https://wa.me/${WHATSAPP_RECLUTADOR}?text=`)).toBe(true);
    expect(textoDe(url)).toBe(
      "Hola Marcos, te escribo desde Instagram por el puesto de vendedor. Soy Juan Pérez, tengo 28 años y vivo en Justiniano Posse. Te mando mi CV.",
    );
  });

  it("usa solo lo que hay", () => {
    expect(textoDe(buildWhatsAppUrlPostulacion({ nombre: "Ana" }, MARCOS))).toBe(
      "Hola Marcos, te escribo desde Instagram por el puesto de vendedor. Soy Ana. Te mando mi CV.",
    );
    expect(textoDe(buildWhatsAppUrlPostulacion({ nombre: "Ana", localidad: "Posse" }, MARCOS))).toBe(
      "Hola Marcos, te escribo desde Instagram por el puesto de vendedor. Soy Ana y vivo en Posse. Te mando mi CV.",
    );
    expect(textoDe(buildWhatsAppUrlPostulacion({}, MARCOS))).toBe(
      "Hola Marcos, te escribo desde Instagram por el puesto de vendedor. Te mando mi CV.",
    );
  });

  it("no lleva emojis aunque la localidad los traiga (Instagram los rompe en el link)", () => {
    const texto = textoDe(buildWhatsAppUrlPostulacion({ nombre: "Ana", localidad: "Posse 🚗📍" }, MARCOS));

    expect(texto).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(texto).toContain("vivo en Posse.");
  });

  it("recorta nombre y localidad larguisimos: el link no crece sin limite", () => {
    const url = buildWhatsAppUrlPostulacion({ nombre: "a".repeat(500), localidad: "b ".repeat(500) }, MARCOS);

    expect(url.length).toBeLessThan(700);
  });

  it("no usa el WhatsApp de Nati", () => {
    expect(buildWhatsAppUrlPostulacion({ nombre: "Ana" }, MARCOS)).not.toContain(WHATSAPP_LOCAL);
  });
});
```

En `src/lib/bot/negocio.test.ts`, cambiar el import de la línea 2 por `import { WHATSAPP_LOCAL, WHATSAPP_RECLUTADOR } from "../utils";` y agregar dentro del `describe("NEGOCIO", ...)`, antes de la última llave de cierre:

```ts
  it("el reclutador es Marcos, con su propio numero (distinto del de Nati)", () => {
    expect(WHATSAPP_RECLUTADOR).toBe("5493537662444");
    expect(NEGOCIO.reclutador).toEqual({
      nombre: "Marcos",
      whatsappNumero: WHATSAPP_RECLUTADOR,
      whatsappVisible: "+54 9 3537 66-2444",
    });
    expect(NEGOCIO.reclutador.whatsappNumero).toMatch(/^\d{11,15}$/);
    expect(NEGOCIO.reclutador.whatsappNumero).not.toBe(NEGOCIO.whatsappNumero);
  });
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run src/lib/utils.test.ts src/lib/bot/negocio.test.ts`
Expected: FAIL (`buildWhatsAppUrlPostulacion`/`WHATSAPP_RECLUTADOR` no existen).

- [ ] **Step 3: Implementar**

En `src/lib/utils.ts`, agregar justo después de `export const WHATSAPP_LOCAL = "5493537558947";`:

```ts
/** WhatsApp de Marcos, que recibe las postulaciones de vendedor (el de Nati es WHATSAPP_LOCAL). */
export const WHATSAPP_RECLUTADOR = "5493537662444";
```

y agregar al final del archivo:

```ts
const MAX_DATO_EN_LINK = 80;

/** Sin emojis ni invisibles: el navegador de Instagram los rompe al abrir wa.me; y con tope de largo. */
function limpioParaLink(texto: string | null | undefined): string {
  const sinEmojis = (texto ?? "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s+/g, " ").trim();
  return Array.from(sinEmojis).slice(0, MAX_DATO_EN_LINK).join("").trim();
}

/** ["a"] → "a"; ["a", "b"] → "a y b"; ["a", "b", "c"] → "a, b y c". */
function unirConY(partes: string[]): string {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Link de WhatsApp a Marcos para que el candidato le mande su CV. El mensaje dice de donde viene y
 * quien es, asi Marcos no tiene que preguntar. Sin emojis (ver `limpioParaLink`).
 */
export function buildWhatsAppUrlPostulacion(
  datos: { nombre?: string | null; edad?: number | null; localidad?: string | null },
  reclutador: { nombre: string; whatsappNumero: string },
): string {
  const nombre = limpioParaLink(datos.nombre);
  const localidad = limpioParaLink(datos.localidad);
  const partes = [
    nombre !== "" ? `Soy ${nombre}` : null,
    datos.edad ? `tengo ${datos.edad} años` : null,
    localidad !== "" ? `vivo en ${localidad}` : null,
  ].filter((parte): parte is string => parte !== null);
  const quien = partes.length > 0 ? ` ${unirConY(partes)}.` : "";
  const mensaje = `Hola ${reclutador.nombre}, te escribo desde Instagram por el puesto de vendedor.${quien} Te mando mi CV.`;
  return `https://wa.me/${reclutador.whatsappNumero}?text=${encodeURIComponent(mensaje)}`;
}
```

En `src/lib/bot/negocio.ts`:

1. Cambiar la primera línea a `import { WHATSAPP_LOCAL, WHATSAPP_RECLUTADOR } from "../utils";`
2. Antes de `export type Negocio`, agregar:

```ts
/** Quien recibe las postulaciones de vendedor (no es la secretaria): el candidato le escribe por WhatsApp. */
export type Reclutador = {
  nombre: string;
  whatsappNumero: string;
  whatsappVisible: string;
};
```

3. Dentro de `export type Negocio = { ... }`, agregar después de `whatsappVisible: string;`:

```ts
  reclutador: Reclutador;
```

4. Dentro de `export const NEGOCIO: Negocio = { ... }`, agregar el bloque nuevo justo después de la línea `whatsappVisible: "+54 9 3537 55-8947",` (ese es el número visible de **Nati**; el de Marcos va en el bloque nuevo):

```ts

  // Las postulaciones de vendedor van a Marcos (numero del flyer), no a Nati.
  reclutador: { nombre: "Marcos", whatsappNumero: WHATSAPP_RECLUTADOR, whatsappVisible: "+54 9 3537 66-2444" },
```

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `npx vitest run src/lib/utils.test.ts src/lib/bot/negocio.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts src/lib/bot/negocio.ts src/lib/bot/negocio.test.ts
git commit -m "feat: datos de Marcos y link de WhatsApp para las postulaciones" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Intención `empleo` en el NLU

**Files:**
- Modify: `src/lib/bot/nlu/intenciones.ts`
- Test: `src/lib/bot/nlu/intenciones.test.ts`

**Interfaces:**
- Produces: `Intencion` incluye `"empleo"`; `detectarIntenciones(texto)` la devuelve **primera** cuando el mensaje pide trabajo (gana sobre `humano`, que contiene "vendedor").

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/bot/nlu/intenciones.test.ts` (ya importa `describe`, `expect`, `it` y `detectarIntenciones`):

```ts
describe("detectarIntenciones — empleo (postulacion de vendedor)", () => {
  it.each([
    "cv",
    "CV",
    "Mando mi CV",
    "C.V.",
    "quiero dejar mi curriculum",
    "curriculum vitae",
    "curriculun",
    "busco trabajo",
    "busco laburo",
    "tienen laburo?",
    "hay empleo?",
    "me quiero postular",
    "buscan vendedor?",
    "necesitan un vendedor",
    "quiero trabajar con ustedes",
    "puesto de vendedor",
  ])("'%s' es empleo", (texto) => {
    expect(detectarIntenciones(texto)[0]).toBe("empleo");
  });

  it("gana sobre 'humano': 'buscan vendedor' no es pedir hablar con alguien", () => {
    const intenciones = detectarIntenciones("buscan vendedor");

    expect(intenciones[0]).toBe("empleo");
  });

  it.each([
    "quiero hablar con un vendedor",
    "lo necesito para trabajo",
    "busco un auto para trabajo",
    "busco una camioneta para trabajar",
    "es un auto popular",
    "hola",
    "tienen alguna pickup?",
    "cuanto sale el vento?",
    "me interesa el vento",
    "tienen financiacion?",
  ])("'%s' NO es empleo", (texto) => {
    expect(detectarIntenciones(texto)).not.toContain("empleo");
  });

  it("'no, busco trabajo' sigue siendo empleo (el 'no' no la vuelve una negativa)", () => {
    const intenciones = detectarIntenciones("no, busco trabajo");

    expect(intenciones).toContain("empleo");
    expect(intenciones).not.toContain("negacion");
  });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run src/lib/bot/nlu/intenciones.test.ts`
Expected: FAIL (los casos "es empleo" devuelven otra intención).

- [ ] **Step 3: Implementar**

En `src/lib/bot/nlu/intenciones.ts`:

1. En el tipo `Intencion`, agregar `"empleo"` como **primera** alternativa (antes de `"humano"`) y actualizar el comentario de arriba para que lo diga:

```ts
// El orden del tipo es la prioridad: "empleo" y "humano" ganan sobre todo (pedir trabajo manda sobre pedir
// "un vendedor") y "ver_mas" va antes que "catalogo" para que "mostrame mas" no se lea como un pedido de catalogo.
export type Intencion =
  | "empleo"
  | "humano"
```

2. En el `Set` `INTENCIONES_CONTENIDO`, agregar `"empleo",` como primer elemento (así un "no, busco trabajo" no se lee como negativa).

3. En el arreglo `REGLAS`, agregar **antes** de la regla `humano` (primera del arreglo):

```ts
  {
    intencion: "empleo",
    // "vendedor" y "trabajo" sueltos NO van: "quiero hablar con un vendedor" es pedir a alguien de ventas y
    // "lo necesito para trabajo" es de autos. Solo frases que piden empleo.
    frases: [
      "curriculum vitae",
      "c v",
      "busco trabajo",
      "busco laburo",
      "trabajar con ustedes",
      "trabajar en la agencia",
      "trabajar en posse",
      "trabajar con posse",
      "buscan vendedor",
      "buscan un vendedor",
      "buscan vendedora",
      "necesitan vendedor",
      "necesitan un vendedor",
      "puesto de vendedor",
      "puesto de vendedora",
    ],
    // Solo "curriculum" admite error de tipeo ("curriculun"): las demas, exactas. "postular" aproximado
    // coincidiria con "popular" ("un auto popular").
    palabras: ["curriculum"],
    exactas: ["cv", "curriculo", "empleo", "laburo", "postular", "postularme", "postularse", "postulo", "postulacion"],
  },
```

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `npx vitest run src/lib/bot/nlu/intenciones.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` sin errores. (Si un caso de "NO es empleo" falla, ajustar la regla, no el test.)

- [ ] **Step 5: Correr toda la suite para ver que nada se rompió**

Run: `npx vitest run`
Expected: todo PASS (es un cambio puramente aditivo).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/nlu/intenciones.ts src/lib/bot/nlu/intenciones.test.ts
git commit -m "feat: intencion 'empleo' para detectar pedidos de trabajo y CV" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Modelo de sesión y tipo de la postulación

**Files:**
- Modify: `src/lib/bot/types.ts`
- Modify: `src/lib/bot/sesion.ts`
- Test: `src/lib/bot/sesion.test.ts`

**Interfaces:**
- Produces (en `src/lib/bot/types.ts`):

```ts
export type PostulacionInput = {
  nombre: string;
  edad: number | null;
  localidad: string | null;
  telefono: string | null;
  experiencia_ventas: string | null;
  experiencia_rubro: string | null;
  financiaciones: string | null;
  disponibilidad: string | null;
};
```

- Produces (en `src/lib/bot/sesion.ts`): `Paso` incluye `"postulando"`; `CAMPOS_POSTULACION` (tupla de los 8 campos, en orden); `CampoPostulacion`; `DatosPostulacion`; `Postulacion = { datos: DatosPostulacion; omitidos: CampoPostulacion[]; campo: CampoPostulacion | null; enviada: boolean }`; `postulacionNueva(): Postulacion`; `Sesion.postulacion: Postulacion | null` (`sesionNueva` la deja en `null`; `normalizarSesion` la lee sin confiar en la forma).

- [ ] **Step 1: Escribir los tests que fallan**

En `src/lib/bot/sesion.test.ts`:

1. En `describe("sesionNueva")`, agregar dentro del test existente, después de `expect(s.saludado).toBe(false);`:

```ts
    expect(s.postulacion).toBeNull();
```

2. En `describe("normalizarSesion (blindaje)")`, en el objeto `sesionCompleta` cambiar `paso: "pidiendo_nombre",` por `paso: "postulando",` y agregar, justo antes de `ultimaActividad: AHORA.toISOString(),` de ese objeto:

```ts
    postulacion: {
      datos: { nombre: "Juan Pérez", edad: 28, localidad: "Posse", telefono: "3537123456", experiencia_ventas: "3 años en una agencia" },
      omitidos: ["experiencia_rubro"],
      campo: "financiaciones",
      enviada: false,
    },
```

3. Agregar al final del archivo:

```ts
describe("normalizarSesion — postulacion de vendedor", () => {
  it("una sesion guardada antes de este cambio (sin la clave) queda con postulacion null", () => {
    expect(normalizarSesion({ paso: "libre", saludado: true }, AHORA).postulacion).toBeNull();
  });

  it("lo que no es un objeto es null", () => {
    for (const basura of ["x", 3, [], true]) {
      expect(normalizarSesion({ postulacion: basura }, AHORA).postulacion).toBeNull();
    }
  });

  it("descarta datos invalidos, recorta los largos y no acepta campos inventados", () => {
    const s = normalizarSesion(
      {
        postulacion: {
          datos: { nombre: 5, edad: 3, localidad: "x".repeat(1000), telefono: ["a"], disponibilidad: "   " },
          omitidos: ["inventado", "edad", "edad", 7],
          campo: "otro",
          enviada: "si",
        },
      },
      AHORA,
    );

    expect(s.postulacion).toEqual({
      datos: { localidad: "x".repeat(300) },
      omitidos: ["edad"],
      campo: null,
      enviada: false,
    });
  });

  it("la edad solo vale como entero de 16 a 75", () => {
    for (const mala of [15, 76, 28.5, NaN, "28"]) {
      expect(normalizarSesion({ postulacion: { datos: { edad: mala } } }, AHORA).postulacion?.datos).toEqual({});
    }
    expect(normalizarSesion({ postulacion: { datos: { edad: 28 } } }, AHORA).postulacion?.datos).toEqual({ edad: 28 });
  });

  it("'postulando' es un paso valido", () => {
    expect(normalizarSesion({ paso: "postulando" }, AHORA).paso).toBe("postulando");
  });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run src/lib/bot/sesion.test.ts`
Expected: FAIL (`postulacion` es `undefined`, `postulando` no es un paso válido).

- [ ] **Step 3: Implementar**

En `src/lib/bot/types.ts`, agregar después de `LeadInput`:

```ts

/** Postulacion de vendedor lista para guardar. `null` = el candidato no dio ese dato. */
export type PostulacionInput = {
  nombre: string;
  edad: number | null;
  localidad: string | null;
  telefono: string | null;
  experiencia_ventas: string | null;
  experiencia_rubro: string | null;
  financiaciones: string | null;
  disponibilidad: string | null;
};
```

En `src/lib/bot/sesion.ts`:

1. Reemplazar la primera línea (`export type Paso = ...`) por:

```ts
export type Paso = "libre" | "pidiendo_nombre" | "pidiendo_telefono" | "eligiendo_historia" | "postulando";

/** Datos que se piden en la postulacion de vendedor, en el orden en que se preguntan. */
export const CAMPOS_POSTULACION = [
  "nombre",
  "edad",
  "localidad",
  "telefono",
  "experiencia_ventas",
  "experiencia_rubro",
  "financiaciones",
  "disponibilidad",
] as const;
export type CampoPostulacion = (typeof CAMPOS_POSTULACION)[number];

export type DatosPostulacion = {
  nombre?: string;
  edad?: number;
  localidad?: string;
  telefono?: string;
  experiencia_ventas?: string;
  experiencia_rubro?: string;
  financiaciones?: string;
  disponibilidad?: string;
};

export type Postulacion = {
  datos: DatosPostulacion;
  /** Datos que el candidato prefirio no responder: no se vuelven a preguntar. */
  omitidos: CampoPostulacion[];
  /** Dato que se pregunto y espera respuesta (null si no hay una pregunta pendiente). */
  campo: CampoPostulacion | null;
  /** True una vez entregada: un nuevo "cv" no vuelve a pedir todo. */
  enviada: boolean;
};

export const postulacionNueva = (): Postulacion => ({ datos: {}, omitidos: [], campo: null, enviada: false });

// Una respuesta libre mas larga no aporta y rompe los limites de los mensajes y de los links.
const MAX_RESPUESTA_POSTULACION = 300;
const EDAD_MINIMA = 16;
const EDAD_MAXIMA = 75;
```

2. En el tipo `Sesion`, agregar antes de `fallos: number;` (o en cualquier posición del objeto):

```ts
  /** Postulacion de vendedor en curso (o ya enviada); null si el cliente nunca pidio trabajo. */
  postulacion: Postulacion | null;
```

3. Cambiar `const PASOS: Paso[] = [...]` por:

```ts
const PASOS: Paso[] = ["libre", "pidiendo_nombre", "pidiendo_telefono", "eligiendo_historia", "postulando"];
```

4. En `sesionNueva`, agregar `postulacion: null,` (por ejemplo después de `ofrecio: null,`).

5. Agregar antes de `export function normalizarSesion`:

```ts
const esCampo = (v: unknown): v is CampoPostulacion => (CAMPOS_POSTULACION as readonly unknown[]).includes(v);

function textoAcotado(v: unknown): string | null {
  if (!esTexto(v)) return null;
  const texto = v.trim().slice(0, MAX_RESPUESTA_POSTULACION);
  return texto === "" ? null : texto;
}

/** Lee la postulacion guardada (jsonb) sin confiar en su forma: lo invalido se descarta. */
function normalizarPostulacion(crudo: unknown): Postulacion | null {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return null;
  const c = crudo as Record<string, unknown>;
  const d = typeof c.datos === "object" && c.datos !== null && !Array.isArray(c.datos) ? (c.datos as Record<string, unknown>) : {};

  const datos: DatosPostulacion = {};
  for (const campo of CAMPOS_POSTULACION) {
    if (campo === "edad") {
      const edad = d.edad;
      if (typeof edad === "number" && Number.isInteger(edad) && edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA) datos.edad = edad;
      continue;
    }
    const texto = textoAcotado(d[campo]);
    if (texto !== null) datos[campo] = texto;
  }

  return {
    datos,
    omitidos: Array.isArray(c.omitidos) ? [...new Set(c.omitidos.filter(esCampo))] : [],
    campo: esCampo(c.campo) ? c.campo : null,
    enviada: c.enviada === true,
  };
}
```

6. En el `return { ... }` de `normalizarSesion`, agregar `postulacion: normalizarPostulacion(c.postulacion),` (por ejemplo después de la línea de `ofrecio`).

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `npx vitest run src/lib/bot/sesion.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` sin errores. (Si `tsc` marca otro archivo que arma un `Sesion` literal completo, agregarle `postulacion: null`; hoy solo `sesion.test.ts` lo hace.)

- [ ] **Step 5: Correr toda la suite**

Run: `npx vitest run`
Expected: todo PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/types.ts src/lib/bot/sesion.ts src/lib/bot/sesion.test.ts
git commit -m "feat: la sesion guarda la postulacion de vendedor en curso" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Textos y tarjeta de la postulación

**Files:**
- Modify: `src/lib/bot/textos.ts`
- Modify: `src/lib/bot/respuestas.ts`
- Create: `src/lib/bot/textos.test.ts`
- Test: `src/lib/bot/respuestas.test.ts`

**Interfaces:**
- Consumes: `CampoPostulacion`, `CAMPOS_POSTULACION` (Task 3); `buildWhatsAppUrlPostulacion` (Task 1); `Negocio.reclutador` (Task 1).
- Produces (en `textos.ts`, todos arreglos de variantes salvo que se indique):
  - `postulacionIntro(nombre: string | null)`, `postulacionRetoma`
  - `preguntaPostulacion: Record<CampoPostulacion, string[]>`, `repreguntaPostulacion: Partial<Record<CampoPostulacion, string[]>>` (nombre, edad, localidad, telefono)
  - `postulacionCondiciones(reclutador: string)`, `postulacionCancelada`, `postulacionYaEnviada(reclutador: string)`
  - `postulacionListo(nombre: string, resumen: string, reclutador: string)`, `postulacionSinNombre(reclutador: string)`, `postulacionAdjunto(reclutador: string)`
  - `contactoReclutadorEnTexto(reclutador: string, url: string): string`
- Produces (en `respuestas.ts`): `tarjetaPostulacion(datos: { nombre?: string | null; edad?: number | null; localidad?: string | null }, ctx: Contexto): Tarjeta`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/bot/textos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { violacionesDeTono } from "./__fixtures__/tono";
import { CAMPOS_POSTULACION } from "./sesion";
import * as T from "./textos";

const emojis = (t: string) => Array.from(t.matchAll(/\p{Extended_Pictographic}/gu)).length;

const VARIANTES: Array<[string, readonly string[]]> = [
  ["postulacionIntro", [...T.postulacionIntro(null), ...T.postulacionIntro("Ana")]],
  ["postulacionRetoma", T.postulacionRetoma],
  ...CAMPOS_POSTULACION.map((campo): [string, readonly string[]] => [
    `preguntaPostulacion.${campo}`,
    T.preguntaPostulacion[campo],
  ]),
  ...Object.entries(T.repreguntaPostulacion).map(([campo, variantes]): [string, readonly string[]] => [
    `repreguntaPostulacion.${campo}`,
    variantes,
  ]),
  ["postulacionCondiciones", T.postulacionCondiciones("Marcos")],
  ["postulacionCancelada", T.postulacionCancelada],
  ["postulacionYaEnviada", T.postulacionYaEnviada("Marcos")],
  [
    "postulacionListo",
    [...T.postulacionListo("Ana", "28 años · Posse", "Marcos"), ...T.postulacionListo("Ana", "", "Marcos")],
  ],
  ["postulacionSinNombre", T.postulacionSinNombre("Marcos")],
  ["postulacionAdjunto", T.postulacionAdjunto("Marcos")],
];

describe("textos de la postulacion de vendedor", () => {
  for (const [nombre, variantes] of VARIANTES) {
    it(`${nombre}: 2 o mas variantes, 1 a 3 emojis y el tono del bot`, () => {
      expect(variantes.length).toBeGreaterThanOrEqual(2);
      for (const texto of variantes) {
        expect(emojis(texto), texto).toBeGreaterThanOrEqual(1);
        expect(emojis(texto), texto).toBeLessThanOrEqual(3);
        expect(violacionesDeTono(texto), texto).toEqual([]);
        // El bot nunca dice ser una persona.
        expect(texto).not.toMatch(/soy (una )?persona|soy humano/i);
      }
    });
  }

  it("hay una pregunta para cada dato que se pide", () => {
    for (const campo of CAMPOS_POSTULACION) expect(T.preguntaPostulacion[campo].length).toBeGreaterThan(0);
  });

  it("el resumen vacio no deja parentesis sueltos", () => {
    for (const texto of T.postulacionListo("Ana", "", "Marcos")) expect(texto).not.toContain("()");
  });

  it("el respaldo en texto del boton de Marcos lleva el link", () => {
    const texto = T.contactoReclutadorEnTexto("Marcos", "https://wa.me/549353?text=hola");

    expect(texto).toContain("Marcos");
    expect(texto).toContain("https://wa.me/549353?text=hola");
    expect(violacionesDeTono(texto)).toEqual([]);
  });
});
```

En `src/lib/bot/respuestas.test.ts`, agregar `tarjetaPostulacion,` a la lista de imports de `./respuestas` (en orden alfabético, antes de `tarjetaDe` o donde quede cómodo) y agregar al final del archivo:

```ts
describe("tarjetaPostulacion", () => {
  it("lleva al WhatsApp de Marcos con el resumen y respeta los limites de Instagram", () => {
    const t = tarjetaPostulacion({ nombre: "Juan Pérez", edad: 28, localidad: "Posse" }, ctx);

    expect(t.titulo).toBe("Puesto de vendedor");
    expect(t.imagenUrl).toBeNull();
    expect(t.botones).toHaveLength(1);
    expect(t.botones[0].titulo).toBe("Enviar CV a Marcos");
    expect(Array.from(t.botones[0].titulo).length).toBeLessThanOrEqual(20);
    expect(Array.from(t.titulo).length).toBeLessThanOrEqual(80);
    expect(Array.from(t.subtitulo).length).toBeLessThanOrEqual(80);
    expect(t.botones[0].url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
    expect(decodeURIComponent(t.botones[0].url.split("?text=")[1])).toContain("Soy Juan Pérez");
  });

  it("no usa el WhatsApp de Nati y funciona sin datos", () => {
    const t = tarjetaPostulacion({}, ctx);

    expect(t.botones[0].url).not.toContain("5493537558947");
    expect(decodeURIComponent(t.botones[0].url.split("?text=")[1])).toBe(
      "Hola Marcos, te escribo desde Instagram por el puesto de vendedor. Te mando mi CV.",
    );
  });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run src/lib/bot/textos.test.ts src/lib/bot/respuestas.test.ts`
Expected: FAIL (los textos y `tarjetaPostulacion` no existen).

- [ ] **Step 3: Implementar los textos**

En `src/lib/bot/textos.ts`, agregar `import type { CampoPostulacion } from "./sesion";` junto a los imports del principio, y agregar **al final del archivo** (las listas `nombreInvalido` y `telefonoInvalido` ya están definidas más arriba):

```ts

// ---------------------------------------------------------------------------------------------
// Postulacion de vendedor (la deriva a Marcos, no a Nati)

export const postulacionIntro = (nombre: string | null) => {
  const n = nombre ? ` ${nombre}` : "";
  return [
    `¡Hola${n}! 🙌 Qué bueno que quieras sumarte al equipo. Te hago unas preguntas cortas para anotar tu postulación`,
    `¡Buenísimo${n}! 😊 Gracias por querer sumarte al equipo. Te hago unas preguntas rápidas para armar tu postulación`,
  ];
};

export const postulacionRetoma = [
  "¡Dale, seguimos con tu postulación! 🙌",
  "¡Perfecto, retomamos tu postulación! 😊",
];

/** Una pregunta por dato, en el mismo orden en que las pide el motor. */
export const preguntaPostulacion: Record<CampoPostulacion, string[]> = {
  nombre: ["Para empezar, ¿cómo te llamás? 😊 (nombre y apellido)", "¿Me pasás tu nombre y apellido? 🙂"],
  edad: ["¿Qué edad tenés? 🙂", "¿Cuántos años tenés? 😊"],
  localidad: ["¿En qué localidad vivís? 📍", "¿De dónde sos? ¿En qué localidad vivís? 🙂"],
  telefono: [
    "¿Con qué número de WhatsApp te podemos contactar? 📱",
    "¿Me dejás un teléfono de contacto? 📱 Con característica, por ejemplo 3537 123456",
  ],
  experiencia_ventas: [
    "Contame tu experiencia en ventas 💼 ¿Dónde trabajaste y cuántos años?",
    "¿Tenés experiencia en ventas? 💼 Contame dónde y por cuánto tiempo",
  ],
  experiencia_rubro: [
    "¿Y en el rubro automotor? 🚗 Agencias, gestoría, lo que hayas hecho",
    "¿Trabajaste antes con autos o motos? 🚗 Agencias, gestoría, trámites…",
  ],
  financiaciones: [
    "¿Tenés conocimientos de financiaciones? 💳 Contame qué sabés (prendarios, bancos, etc.)",
    "¿Manejás algo de financiaciones? 💳 Créditos, prendarios, lo que sepas",
  ],
  disponibilidad: [
    "Última: ¿qué disponibilidad horaria tenés? 🕒",
    "Y para terminar, ¿qué horarios tenés disponibles? 🕒 ¿Jornada completa?",
  ],
};

/** Cuando una respuesta no sirve: el nombre y el telefono reusan los de la captacion de clientes. */
export const repreguntaPostulacion: Partial<Record<CampoPostulacion, string[]>> = {
  nombre: nombreInvalido,
  edad: [
    "Mmm, esa edad no me cierra 🤔 ¿Me la pasás en números? Por ejemplo 28",
    "¿Qué edad tenés? 🙂 Escribila en números, por ejemplo 28",
  ],
  localidad: [
    "¿En qué localidad vivís? 🙂 Con el nombre alcanza, por ejemplo Justiniano Posse",
    "No te entendí bien 😅 ¿De qué localidad sos?",
  ],
  telefono: telefonoInvalido,
};

/** Sueldo, comision, horario de trabajo: no lo define el bot. */
export const postulacionCondiciones = (reclutador: string) => [
  `Eso lo charlás directo con ${reclutador} 😉 Sigamos con tu postulación:`,
  `De eso se encarga ${reclutador} 🙂 Sigamos:`,
];

export const postulacionCancelada = [
  'Dale, sin problema 😊 Si querés retomar tu postulación, escribime "CV"',
  'Listo, lo dejamos acá 👍 Cuando quieras seguir, escribime "CV"',
];

export const postulacionYaEnviada = (reclutador: string) => [
  `Ya tengo tus datos anotados 😊 Si querés mandar tu CV, escribile a ${reclutador} por WhatsApp 👇`,
  `¡Tus datos ya están anotados! 🙌 Mandale tu CV a ${reclutador} por WhatsApp 👇`,
];

/** `resumen` es algo como "28 años · Justiniano Posse"; vacio si no hay nada que repetir. */
export const postulacionListo = (nombre: string, resumen: string, reclutador: string) => {
  const anotado = resumen ? ` (${resumen})` : "";
  return [
    `¡Listo ${nombre}! 🙌 Anoté tus datos${anotado}. Ahora escribile a ${reclutador} por WhatsApp y mandale tu CV 👇`,
    `¡Anotado, ${nombre}! 😊 Ya tengo tus datos${anotado}. Mandale tu CV a ${reclutador} por WhatsApp 👇`,
  ];
};

export const postulacionSinNombre = (reclutador: string) => [
  `No pude anotar tu postulación sin tu nombre 😕 Escribile directo a ${reclutador} por WhatsApp y mandale tu CV 👇`,
  `Sin tu nombre no puedo anotarte 😅 Pero podés escribirle directo a ${reclutador} por WhatsApp y mandarle tu CV 👇`,
];

/** El CV en archivo no entra por Instagram: se manda a Marcos por WhatsApp. */
export const postulacionAdjunto = (reclutador: string) => [
  `Por acá no puedo recibir archivos ni fotos 😅 Mandale tu CV a ${reclutador} por WhatsApp 👇 y seguimos con tus datos cuando quieras`,
  `Los archivos no me llegan bien por acá 🙂 Mandale tu CV a ${reclutador} por WhatsApp 👇 y después seguimos con tu postulación`,
];

export const contactoReclutadorEnTexto = (reclutador: string, url: string) =>
  `Mandale tu CV a ${reclutador} por WhatsApp 💬 ${url}`;
```

- [ ] **Step 4: Implementar la tarjeta**

En `src/lib/bot/respuestas.ts`:

1. Cambiar la primera línea por `import { buildWhatsAppUrlInstagram, buildWhatsAppUrlPostulacion } from "../utils";`
2. Agregar después de la función `tarjetaContacto`:

```ts

/**
 * Tarjeta del puesto de vendedor: el boton abre el WhatsApp de Marcos con el resumen del candidato
 * para que le mande su CV. Instagram no admite tarjetas sin botones, asi que siempre lleva ese.
 */
export function tarjetaPostulacion(
  datos: { nombre?: string | null; edad?: number | null; localidad?: string | null },
  ctx: Contexto,
): Tarjeta {
  const { reclutador } = ctx.negocio;
  return {
    titulo: recortar("Puesto de vendedor", MAX_TITULO),
    subtitulo: recortar(`${reclutador.nombre} recibe tu CV por WhatsApp`, MAX_SUBTITULO),
    imagenUrl: null,
    botones: [
      {
        titulo: recortar(`Enviar CV a ${reclutador.nombre}`, MAX_BOTON),
        url: buildWhatsAppUrlPostulacion(datos, reclutador),
      },
    ],
  };
}
```

- [ ] **Step 5: Correr los tests y ver que pasan**

Run: `npx vitest run src/lib/bot/textos.test.ts src/lib/bot/respuestas.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/textos.ts src/lib/bot/textos.test.ts src/lib/bot/respuestas.ts src/lib/bot/respuestas.test.ts
git commit -m "feat: textos y tarjeta de la postulacion de vendedor" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: El flujo de postulación en el motor (camino principal)

**Files:**
- Create: `src/lib/bot/postulacion.ts`
- Modify: `src/lib/bot/turno.ts`
- Modify: `src/lib/bot/captacion.ts`
- Modify: `src/lib/bot/motor.ts`
- Modify: `src/lib/bot/handler.test.ts` (solo el helper `resultado()`)
- Test: `src/lib/bot/postulacion.test.ts` (nuevo)

**Interfaces:**
- Consumes: todo lo de las Tasks 1 a 4.
- Produces:
  - `ResultadoMotor.postulacion: PostulacionInput | null` (se llena solo en el turno que cierra la postulación).
  - `Turno.postulacion: PostulacionInput | null`; en `turno.ts`: `reclutador(t: Turno): string` y `mostrarContactoReclutador(t: Turno, datos: { nombre?: string | null; edad?: number | null; localidad?: string | null }): void`.
  - En `postulacion.ts`: `iniciarPostulacion(t: Turno, texto: string): void` y `pasoPostulacion(t: Turno, texto: string): boolean` (devuelve `false` si el cliente cambió de tema; la Task 6 lo usa).
  - En `captacion.ts`: `nombreDe(texto: string): string | null` y `telefonoEn(texto: string): { numero: string; resto: string } | null` pasan a ser exportadas.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/bot/postulacion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { violacionesDeTono } from "./__fixtures__/tono";
import { conversar, type ResultadoMotor } from "./motor";
import { NEGOCIO } from "./negocio";
import { normalizarSesion, sesionNueva, type Sesion } from "./sesion";

const AHORA = new Date("2026-10-13T15:00:00Z");

type Turno = string | { texto?: string | null; historiaId?: string; adjuntos?: string[] };

/** Simula una charla: encadena la sesion de cada turno en el siguiente. */
function charlar(turnos: Turno[], sesionInicial?: Sesion): ResultadoMotor[] {
  let sesion = sesionInicial ?? sesionNueva(AHORA);
  return turnos.map((turno, i) => {
    const t = typeof turno === "string" ? { texto: turno } : turno;
    const r = conversar({
      texto: t.texto ?? null,
      adjuntos: t.adjuntos ?? [],
      historiaId: t.historiaId ?? null,
      vehiculoDeHistoria: null,
      mid: `mid.${i}`,
      sesion,
      catalogo: CATALOGO,
      perfil: null,
      ahora: AHORA,
      siteUrl: "https://posse.example",
      negocio: NEGOCIO,
    });
    sesion = r.sesion;
    return r;
  });
}

const textos = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "texto" ? [m.texto] : []));
const tarjetas = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas : []));
const urls = (r: ResultadoMotor) => tarjetas(r).flatMap((t) => t.botones.map((b) => b.url));
const ultimoTexto = (r: ResultadoMotor) => textos(r)[textos(r).length - 1] ?? "";
const botonMarcos = (r: ResultadoMotor) => urls(r).some((u) => u.startsWith("https://wa.me/5493537662444?text="));
const botonNati = (r: ResultadoMotor) => urls(r).some((u) => u.startsWith("https://wa.me/5493537558947?text="));
const mensajeWhatsApp = (r: ResultadoMotor) => decodeURIComponent((urls(r)[0] ?? "").split("?text=")[1] ?? "");
const emojis = (t: string) => Array.from(t.matchAll(/\p{Extended_Pictographic}/gu)).length;

/** La pregunta que tiene que hacer el bot despues de cada turno del flujo completo. */
const PREGUNTAS = [/nombre/i, /edad|años/i, /localidad/i, /WhatsApp|teléfono|número/i, /ventas/i, /rubro|autos/i, /financiaciones/i, /disponibilidad|horarios/i];
const FLUJO = [
  "cv",
  "Juan Pérez",
  "28",
  "Justiniano Posse",
  "3537 123456",
  "3 años vendiendo en una agencia",
  "trabajé en gestoría del automotor",
  "manejo prendarios y créditos bancarios",
  "de lunes a sábado, jornada completa",
];

describe("postulacion de vendedor: el flujo completo", () => {
  it("'cv' arranca la postulacion: saluda y pregunta el nombre", () => {
    const [r] = charlar(["cv"]);

    expect(r.responder).toBe(true);
    expect(r.sesion.paso).toBe("postulando");
    expect(r.sesion.postulacion?.campo).toBe("nombre");
    expect(r.postulacion).toBeNull();
    expect(textos(r)).toHaveLength(2);
    expect(textos(r)[0]).toMatch(/sumarte al equipo/i);
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[0]);
  });

  it("pregunta un dato por turno, en orden, y al final entrega la postulacion", () => {
    const rs = charlar(FLUJO);

    for (let i = 0; i < PREGUNTAS.length; i++) {
      expect(ultimoTexto(rs[i]), `despues del turno ${i}`).toMatch(PREGUNTAS[i]);
      expect(rs[i].postulacion, `turno ${i}`).toBeNull();
      expect(rs[i].sesion.paso).toBe("postulando");
    }

    const fin = rs[rs.length - 1];
    expect(fin.postulacion).toEqual({
      nombre: "Juan Pérez",
      edad: 28,
      localidad: "Justiniano Posse",
      telefono: "3537 123456",
      experiencia_ventas: "3 años vendiendo en una agencia",
      experiencia_rubro: "trabajé en gestoría del automotor",
      financiaciones: "manejo prendarios y créditos bancarios",
      disponibilidad: "de lunes a sábado, jornada completa",
    });
    expect(fin.sesion.paso).toBe("libre");
    expect(fin.sesion.postulacion?.enviada).toBe(true);
    expect(textos(fin)[0]).toMatch(/Juan/);
    expect(tarjetas(fin)).toHaveLength(1);
    expect(botonMarcos(fin)).toBe(true);
    expect(botonNati(fin)).toBe(false);
    expect(mensajeWhatsApp(fin)).toContain("Soy Juan Pérez, tengo 28 años y vivo en Justiniano Posse");
  });

  it("no repite lo que el candidato ya dijo: edad y localidad dentro de otra respuesta", () => {
    const rs = charlar(["cv", "Juan Pérez", "tengo 28 años y vivo en Posse"]);
    const r = rs[2];

    expect(r.sesion.postulacion?.datos).toMatchObject({ nombre: "Juan Pérez", edad: 28, localidad: "Posse" });
    expect(r.sesion.postulacion?.campo).toBe("telefono");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[3]);
  });

  it("un telefono pegado al nombre se aprovecha", () => {
    const [, r] = charlar(["cv", "Juan Pérez 3537123456"]);

    expect(r.sesion.postulacion?.datos).toMatchObject({ nombre: "Juan Pérez", telefono: "3537123456" });
    expect(r.sesion.postulacion?.campo).toBe("edad");
  });

  it("'cv' en el mismo mensaje con la edad: se aprovecha y no se pregunta", () => {
    const [r] = charlar(["hola, tengo 28 años, te mando mi cv"]);

    expect(r.sesion.postulacion?.datos.edad).toBe(28);
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[0]);
  });

  it("una dato invalido se repregunta; a la segunda se saltea y sigue", () => {
    const [, , a, b] = charlar(["cv", "Juan Pérez", "veintiocho", "mm"]);

    expect(a.sesion.fallos).toBe(1);
    expect(a.sesion.postulacion?.campo).toBe("edad");
    expect(ultimoTexto(a)).toMatch(/edad|números/i);

    expect(b.sesion.postulacion?.datos.edad).toBeUndefined();
    expect(b.sesion.postulacion?.omitidos).toEqual(["edad"]);
    expect(b.sesion.postulacion?.campo).toBe("localidad");
    expect(b.sesion.fallos).toBe(0);
    expect(ultimoTexto(b)).toMatch(PREGUNTAS[2]);
  });

  it("sin nombre despues de dos intentos: no guarda y manda a Marcos", () => {
    const [, a, b] = charlar(["cv", "123", "???"]);

    expect(a.sesion.fallos).toBe(1);
    expect(ultimoTexto(a)).toMatch(/nombre/i);
    expect(b.postulacion).toBeNull();
    expect(b.sesion.paso).toBe("libre");
    expect(b.sesion.postulacion?.enviada).toBe(false);
    expect(textos(b).join("\n")).toMatch(/nombre/i);
    expect(botonMarcos(b)).toBe(true);
  });

  it("una respuesta larguisima se recorta a 300 caracteres", () => {
    const rs = charlar(["cv", "Juan", "28", "Posse", "3537123456", "a".repeat(2000)]);

    expect(rs[5].sesion.postulacion?.datos.experiencia_ventas).toHaveLength(300);
  });

  it("despues de enviada, un nuevo 'cv' no pide todo de nuevo: confirma y muestra el boton", () => {
    const rs = charlar([...FLUJO, "cv"]);
    const r = rs[rs.length - 1];

    expect(r.postulacion).toBeNull();
    expect(textos(r).join("\n")).toMatch(/anotados/i);
    expect(botonMarcos(r)).toBe(true);
    expect(r.sesion.paso).toBe("libre");
  });
});

describe("postulacion de vendedor: como entra el flujo", () => {
  it("'cv' como respuesta a una historia que el bot no conoce NO pregunta de que auto era", () => {
    const [r] = charlar([{ texto: "cv", historiaId: "st-empleo" }]);

    expect(r.sesion.paso).toBe("postulando");
    expect(r.aprenderHistoria).toBeNull();
    expect(textos(r).join("\n")).not.toMatch(/historia/i);
    expect(tarjetas(r).filter((t) => t.titulo.includes(")"))).toHaveLength(0);
  });

  it("'cv' en medio de otra captacion la reemplaza", () => {
    const [, r] = charlar(["avisame cuando entre una hilux", "cv"]);

    expect(r.sesion.paso).toBe("postulando");
    expect(r.postulacion).toBeNull();
  });

  it("'cv' mientras se elige de que auto era la historia sale de ese paso", () => {
    const [, r] = charlar([{ texto: "hola que valor tiene?", historiaId: "st-nueva" }, "cv"]);

    expect(r.sesion.paso).toBe("postulando");
  });
});

describe("postulacion de vendedor: pureza, tono y persistencia", () => {
  it("no modifica la sesion de entrada", () => {
    const sesion = sesionNueva(AHORA);
    const copia = structuredClone(sesion);

    charlar(FLUJO, sesion);

    expect(sesion).toEqual(copia);
  });

  it("cada texto del flujo lleva de 1 a 3 emojis y cumple el tono", () => {
    for (const r of charlar(FLUJO)) {
      for (const texto of textos(r)) {
        expect(emojis(texto), texto).toBeGreaterThanOrEqual(1);
        expect(emojis(texto), texto).toBeLessThanOrEqual(3);
        expect(violacionesDeTono(texto), texto).toEqual([]);
      }
      for (const m of r.mensajes) if (m.tipo === "tarjetas") expect(violacionesDeTono(m.alternativaTexto)).toEqual([]);
    }
  });

  it("la sesion a mitad del flujo sobrevive al viaje por JSON y la charla sigue", () => {
    const [, r1] = charlar(["cv", "Juan Pérez"]);
    const viaJson = normalizarSesion(JSON.parse(JSON.stringify(r1.sesion)), AHORA);

    expect(viaJson).toEqual(r1.sesion);

    const [r2] = charlar(["28"], viaJson);
    expect(r2.sesion.postulacion?.datos).toMatchObject({ nombre: "Juan Pérez", edad: 28 });
    expect(r2.sesion.postulacion?.campo).toBe("localidad");
  });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run src/lib/bot/postulacion.test.ts`
Expected: FAIL (el motor todavía no conoce la postulación: `r.postulacion` es `undefined`, el paso no es `postulando`).

- [ ] **Step 3: Exportar lo que se reusa de la captación y hacer que `empleo` cambie de tema**

En `src/lib/bot/captacion.ts`:

1. En `CAMBIAN_DE_TEMA`, agregar `"empleo"` como primer elemento:

```ts
const CAMBIAN_DE_TEMA = new Set<Intencion>([
  "empleo", "humano", "identidad", "avisame", "precio", "info", "disponibilidad", "catalogo", "ver_mas", ...TEMAS_NEGOCIO,
]);
```

2. En `NO_ES_UN_NOMBRE`, agregar `"empleo"` como primer elemento (que "cv" no se lea como un nombre):

```ts
const NO_ES_UN_NOMBRE = new Set<Intencion>([
  "empleo", "humano", "identidad", "avisame", "negacion", "precio", "info", "disponibilidad", "ver_mas", "catalogo",
  "afirmacion", "gracias", "despedida", "cortesia", "saludo",
]);
```

3. Cambiar `function nombreDe(texto: string): string | null {` por `export function nombreDe(texto: string): string | null {` y `function telefonoEn(texto: string): { numero: string; resto: string } | null {` por `export function telefonoEn(texto: string): { numero: string; resto: string } | null {`.

- [ ] **Step 4: Ayudas del turno**

En `src/lib/bot/turno.ts`:

1. Cambiar el import de `respuestas` por:

```ts
import { alternativaTexto, elegir, primerNombre, tarjetaContacto, tarjetaDe, tarjetaPostulacion, type Contexto } from "./respuestas";
```

2. Cambiar el import de tipos por:

```ts
import type { LeadInput, MensajeSalida, PostulacionInput, VehiculoCatalogo } from "./types";
```

3. En el tipo `Turno`, agregar después de `lead: LeadInput | null;`:

```ts
  /** Postulacion de vendedor lista para guardar (solo en el turno que la cierra). */
  postulacion: PostulacionInput | null;
```

4. Agregar después de `export const secretaria = ...`:

```ts
export const reclutador = (t: Turno) => t.e.negocio.reclutador.nombre;
```

5. Agregar después de la función `mostrarContacto`:

```ts

/** Boton de WhatsApp con Marcos para que mande su CV; el mensaje ya dice quien es con lo que se sabe de el. */
export function mostrarContactoReclutador(
  t: Turno,
  datos: { nombre?: string | null; edad?: number | null; localidad?: string | null },
): void {
  const tarjeta = tarjetaPostulacion(datos, t.ctx);
  t.mensajes.push({
    tipo: "tarjetas",
    tarjetas: [tarjeta],
    alternativaTexto: T.contactoReclutadorEnTexto(reclutador(t), tarjeta.botones[0].url),
  });
}
```

- [ ] **Step 5: El módulo del flujo**

Crear `src/lib/bot/postulacion.ts`:

```ts
import { nombreDe, telefonoEn } from "./captacion";
import { detectarIntenciones, type Intencion } from "./nlu/intenciones";
import { CAMPOS_POSTULACION, postulacionNueva, type CampoPostulacion, type Postulacion } from "./sesion";
import * as T from "./textos";
import { MAX_FALLOS_PASO, decir, mostrarContactoReclutador, nombreParaSaludo, reclutador, salirDelPaso, variante, type Turno } from "./turno";

/**
 * Postulacion de vendedor por Instagram: el bot pide los datos de un CV de a uno, en charla natural, y
 * los entrega para guardarlos. Mismo molde que `captacion.ts`, pero con ocho datos en vez de dos. El CV
 * en archivo no pasa por aca: el candidato se lo manda a Marcos por WhatsApp.
 */

// Una respuesta libre mas larga no aporta y rompe los limites de los mensajes y de los links.
const MAX_RESPUESTA = 300;
const EDAD_MINIMA = 16;
const EDAD_MAXIMA = 75;
// "hola" o "gracias" tienen solo letras pero no son una localidad.
const NO_ES_UNA_LOCALIDAD = new Set<Intencion>(["saludo", "afirmacion", "negacion", "gracias", "despedida", "cortesia"]);

function postulacionDe(t: Turno): Postulacion {
  t.s.postulacion ??= postulacionNueva();
  return t.s.postulacion;
}

/** Primer dato que falta y que el candidato no salteo; null si ya esta todo. */
const siguienteCampo = (p: Postulacion): CampoPostulacion | null =>
  CAMPOS_POSTULACION.find((campo) => p.datos[campo] === undefined && !p.omitidos.includes(campo)) ?? null;

const hayProgreso = (p: Postulacion) => Object.keys(p.datos).length > 0 || p.omitidos.length > 0;

/** "cv", "busco trabajo": arranca (o retoma) la postulacion. */
export function iniciarPostulacion(t: Turno, texto: string): void {
  const p = postulacionDe(t);
  if (p.enviada) {
    decir(t, variante(t, "postula-ya", T.postulacionYaEnviada(reclutador(t))));
    return mostrarContactoReclutador(t, p.datos);
  }

  const retoma = hayProgreso(p);
  t.s.paso = "postulando";
  t.s.ofrecio = null;
  t.s.fallos = 0;
  absorberExtras(p, texto, null);
  decir(
    t,
    retoma
      ? variante(t, "postula-retoma", T.postulacionRetoma)
      : variante(t, "postula-intro", T.postulacionIntro(nombreParaSaludo(t))),
  );
  avanzar(t, p);
}

/** Devuelve false si el cliente cambio de tema: el paso se abandona y el mensaje sigue su curso. */
export function pasoPostulacion(t: Turno, texto: string): boolean {
  const p = postulacionDe(t);
  const campo = p.campo ?? siguienteCampo(p);
  if (campo === null) {
    // Sesion rara (paso sin pregunta pendiente): no hay nada que seguir.
    salirDelPaso(t.s);
    return false;
  }

  // Lo que el candidato dice de paso (un telefono, "vivo en X") se aprovecha aunque conteste otra cosa.
  absorberExtras(p, texto, campo);
  const valor = respuestaA(campo, texto);
  if (valor === null) return falloEn(t, p, campo);

  guardar(p, campo, valor);
  avanzar(t, p);
  return true;
}

/** Pregunta el proximo dato, o cierra la postulacion si ya no falta ninguno. */
function avanzar(t: Turno, p: Postulacion): void {
  const campo = siguienteCampo(p);
  p.campo = campo;
  t.s.fallos = 0;
  if (campo === null) return cerrar(t, p);
  decir(t, variante(t, `postula-${campo}`, T.preguntaPostulacion[campo]));
}

/** Una respuesta que no sirve se repregunta una vez; a la segunda el nombre deriva a Marcos y el resto se saltea. */
function falloEn(t: Turno, p: Postulacion, campo: CampoPostulacion): boolean {
  t.s.fallos += 1;
  if (t.s.fallos < MAX_FALLOS_PASO) {
    const variantes = T.repreguntaPostulacion[campo] ?? T.preguntaPostulacion[campo];
    decir(t, variante(t, `postula-re-${campo}`, variantes));
    return true;
  }
  // Sin nombre no hay postulacion que guardar: se le da a Marcos y listo.
  if (campo === "nombre") {
    sinNombre(t, p);
    return true;
  }
  p.omitidos.push(campo);
  avanzar(t, p);
  return true;
}

/** Sin nombre no se guarda: el candidato le escribe directo a Marcos. Lo ya respondido queda en la sesion. */
function sinNombre(t: Turno, p: Postulacion): void {
  p.campo = null;
  salirDelPaso(t.s);
  decir(t, variante(t, "postula-sin-nombre", T.postulacionSinNombre(reclutador(t))));
  mostrarContactoReclutador(t, p.datos);
}

/** Entrega la postulacion (el handler la guarda) y manda al candidato a Marcos con el resumen prearmado. */
function cerrar(t: Turno, p: Postulacion): void {
  const { datos } = p;
  if (!datos.nombre) return sinNombre(t, p);

  t.postulacion = {
    nombre: datos.nombre,
    edad: datos.edad ?? null,
    localidad: datos.localidad ?? null,
    telefono: datos.telefono ?? null,
    experiencia_ventas: datos.experiencia_ventas ?? null,
    experiencia_rubro: datos.experiencia_rubro ?? null,
    financiaciones: datos.financiaciones ?? null,
    disponibilidad: datos.disponibilidad ?? null,
  };
  p.campo = null;
  p.enviada = true;
  salirDelPaso(t.s);

  const resumen = [datos.edad ? `${datos.edad} años` : null, datos.localidad ?? null].filter((x): x is string => x !== null).join(" · ");
  const primerNombre = datos.nombre.split(/\s+/)[0] ?? datos.nombre;
  decir(t, variante(t, "postula-listo", T.postulacionListo(primerNombre, resumen, reclutador(t))));
  mostrarContactoReclutador(t, datos);
}

// ---------------------------------------------------------------------------------------------
// Lectura de las respuestas

function guardar(p: Postulacion, campo: CampoPostulacion, valor: string | number): void {
  // `respuestaA` ya garantiza el tipo de cada campo (la edad es un numero, el resto texto).
  (p.datos as Record<string, string | number>)[campo] = valor;
}

/** La respuesta a la pregunta pendiente, ya validada; null si no sirve. */
function respuestaA(campo: CampoPostulacion, texto: string): string | number | null {
  switch (campo) {
    case "nombre":
      // El telefono, si vino pegado ("Juan Pérez 3537123456"), no es parte del nombre.
      return nombreDe(telefonoEn(texto)?.resto ?? texto);
    case "edad":
      return edadDe(texto, true);
    case "localidad":
      return localidadDe(texto, true);
    case "telefono":
      return telefonoEn(texto)?.numero ?? null;
    default:
      return respuestaLibre(texto);
  }
}

/** Telefono, edad ("tengo 28 años") y localidad ("vivo en X") dichos de paso, para no volver a preguntarlos. */
function absorberExtras(p: Postulacion, texto: string, pendiente: CampoPostulacion | null): void {
  const abierto = (campo: CampoPostulacion) => campo !== pendiente && p.datos[campo] === undefined;
  if (abierto("telefono")) {
    const telefono = telefonoEn(texto);
    if (telefono) p.datos.telefono = telefono.numero;
  }
  if (abierto("edad")) {
    const edad = edadDe(texto, false);
    if (edad !== null) p.datos.edad = edad;
  }
  if (abierto("localidad")) {
    const localidad = localidadDe(texto, false);
    if (localidad !== null) p.datos.localidad = localidad;
  }
}

/**
 * Con `directa` (se pregunto la edad) vale un numero de 2 cifras en cualquier frase ("28", "tengo 28",
 * "28 años"). Sin ella solo "tengo N años": "tengo 5 años de experiencia" no es una edad.
 */
function edadDe(texto: string, directa: boolean): number | null {
  const encontrada = directa
    ? /^\D*(\d{2})\D*$/.exec(texto.trim())
    : /\btengo\s+(\d{2})\s+a[nñ]os\b(?!\s+(?:de|en)\s)/iu.exec(texto);
  if (!encontrada) return null;
  const edad = Number(encontrada[1]);
  return edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA ? edad : null;
}

/** Con `directa` (se pregunto la localidad) vale casi cualquier nombre de lugar; sin ella solo "vivo en X" / "soy de X". */
function localidadDe(texto: string, directa: boolean): string | null {
  if (!directa) {
    const encontrada = /\b(?:vivo en|soy de|vivo por)\s+(\p{L}[\p{L} '’-]{1,40}?)(?=[,;.!?]|\s+y\s|\s+tengo\b|$)/iu.exec(texto);
    return encontrada ? encontrada[1].trim() : null;
  }
  const limpia = texto
    .trim()
    .replace(/^(?:vivo en|soy de|vivo por|de|en)\s+/i, "")
    .replace(/[\s.!¡,;]+$/u, "");
  if (!/^\p{L}[\p{L} .'’,-]{1,58}$/u.test(limpia)) return null;
  return detectarIntenciones(limpia).some((i) => NO_ES_UNA_LOCALIDAD.has(i)) ? null : limpia;
}

/** Experiencia, financiaciones y disponibilidad: texto libre, recortado. */
function respuestaLibre(texto: string): string | null {
  const limpia = texto.replace(/\s+/g, " ").trim().slice(0, MAX_RESPUESTA);
  return limpia === "" ? null : limpia;
}
```

- [ ] **Step 6: Cablear el motor**

En `src/lib/bot/motor.ts`:

1. Agregar el import `import { iniciarPostulacion, pasoPostulacion } from "./postulacion";` junto a los otros imports locales (después del de `./nlu/normalizar` y antes del de `./respuestas` queda ordenado).

2. Cambiar el import de tipos por `import type { LeadInput, MensajeSalida, Perfil, PostulacionInput, VehiculoCatalogo } from "./types";`

3. En `ResultadoMotor`, agregar después de `lead: LeadInput | null; // para guardar en leads`:

```ts
  postulacion: PostulacionInput | null; // para guardar en postulantes
```

4. En el comentario del orden de reglas (arriba de `EntradaMotor`), agregar la línea `*  4b. paso "postulando" y pedido de empleo     (pasoPostulacion / iniciarPostulacion)` después de la de la regla 4.

5. En `ESCAPAN_DE_HISTORIA`, agregar `"empleo"`:

```ts
const ESCAPAN_DE_HISTORIA = new Set<Intencion>([
  "empleo", "humano", "identidad", "avisame", "catalogo", "ver_mas", ...TEMAS_NEGOCIO,
]);
```

6. En `conversar`, en el objeto `t` agregar `postulacion: null,` después de `lead: null,`, y en el `return` agregar `postulacion: t.postulacion,` después de `lead: t.lead,`.

7. En `turno()`, reemplazar el bloque que va desde `const { historiaId } = t.e;` hasta la línea `const ent = extraerEntidades(texto, t.e.catalogo);` (inclusive) por:

```ts
  const { historiaId } = t.e;
  if (historiaId === null) {
    if (t.s.paso === "pidiendo_nombre" || t.s.paso === "pidiendo_telefono") {
      if (pasoCaptacion(t, texto)) return;
    } else if (t.s.paso === "eligiendo_historia") {
      if (pasoEligiendoHistoria(t, texto)) return;
    } else if (t.s.paso === "postulando") {
      if (pasoPostulacion(t, texto)) return;
    }
  } else {
    // Una respuesta a otra historia manda sobre lo que se estaba preguntando: es un tema nuevo.
    salirDelPaso(t.s);
  }

  const intenciones = detectarIntenciones(texto);
  // Pedir trabajo manda sobre todo lo demas, tambien sobre una respuesta a historia: un "cv" a la historia
  // del puesto no es de ningun auto, y preguntar "de que auto era?" no tendria sentido.
  if (tiene(intenciones, "empleo")) return iniciarPostulacion(t, texto);
  const ent = extraerEntidades(texto, t.e.catalogo);
```

- [ ] **Step 7: Mantener verde el helper de los tests del handler**

En `src/lib/bot/handler.test.ts`, dentro de la función `resultado(...)`, agregar `postulacion: null,` después de `lead: null,`.

- [ ] **Step 8: Correr los tests y ver que pasan**

Run: `npx vitest run src/lib/bot/postulacion.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` sin errores. Si algún test de preguntas falla por una variante de texto, revisar que `preguntaPostulacion` (Task 4) coincida con las regex de `PREGUNTAS`.

- [ ] **Step 9: Correr toda la suite (regresiones de captación, historias y negocio)**

Run: `npx vitest run`
Expected: todo PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/bot/postulacion.ts src/lib/bot/postulacion.test.ts src/lib/bot/turno.ts src/lib/bot/captacion.ts src/lib/bot/motor.ts src/lib/bot/handler.test.ts
git commit -m "feat: el bot pide los datos de la postulacion de vendedor" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Casos borde del flujo de postulación

**Files:**
- Modify: `src/lib/bot/postulacion.ts`
- Modify: `src/lib/bot/motor.ts`
- Test: `src/lib/bot/postulacion.test.ts`

**Interfaces:**
- Consumes: `pasoPostulacion`, `iniciarPostulacion` (Task 5); `mostrarContactoReclutador`, `reclutador` (Task 5); `T.postulacionCancelada`, `T.postulacionCondiciones`, `T.postulacionAdjunto`, `T.preguntaPostulacion` (Task 4).
- Produces: `pasoPostulacion` entiende cancelar, saltear, preguntas de condiciones y cambio de tema; el motor responde a fotos, audios y archivos durante la postulación.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/bot/postulacion.test.ts`:

```ts
/** Charla hasta tener contestado el telefono: la pregunta pendiente es la experiencia en ventas. */
const HASTA_VENTAS = ["cv", "Juan Pérez", "28", "Posse", "3537 123456"];

describe("postulacion de vendedor: cancelar y retomar", () => {
  it("'cancelar' sale del flujo y conserva lo respondido; un nuevo 'cv' retoma sin repetir preguntas", () => {
    const [, , c, d] = charlar(["cv", "Juan Pérez", "cancelar", "cv"]);

    expect(c.sesion.paso).toBe("libre");
    expect(c.sesion.postulacion?.datos.nombre).toBe("Juan Pérez");
    expect(c.sesion.postulacion?.enviada).toBe(false);
    expect(textos(c).join("\n")).toMatch(/CV/);

    expect(d.sesion.paso).toBe("postulando");
    expect(textos(d)[0]).toMatch(/seguimos|retomamos/i);
    expect(ultimoTexto(d)).toMatch(PREGUNTAS[1]);
    expect(d.sesion.postulacion?.datos.nombre).toBe("Juan Pérez");
  });

  it("solo cancela una frase corta que empieza con la palabra", () => {
    const rs = charlar([...HASTA_VENTAS, "no cancelé nunca una venta, siempre cerraba todo"]);

    expect(rs[rs.length - 1].sesion.paso).toBe("postulando");
    expect(rs[rs.length - 1].sesion.postulacion?.datos.experiencia_ventas).toMatch(/cerraba todo/);
  });
});

describe("postulacion de vendedor: saltear una pregunta", () => {
  it.each(["no sé", "paso", "después", "prefiero no decirlo", "ahora no"])("'%s' saltea el dato y sigue", (salto) => {
    const [, , r] = charlar(["cv", "Juan Pérez", salto]);

    expect(r.sesion.postulacion?.omitidos).toEqual(["edad"]);
    expect(r.sesion.postulacion?.campo).toBe("localidad");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[2]);
  });

  it("el nombre no se puede saltear: se repregunta", () => {
    const [, r] = charlar(["cv", "no sé"]);

    expect(r.sesion.postulacion?.campo).toBe("nombre");
    expect(r.sesion.postulacion?.omitidos).toEqual([]);
    expect(r.sesion.fallos).toBe(1);
    expect(ultimoTexto(r)).toMatch(/nombre/i);
  });

  it("'no' es una respuesta valida a una pregunta de experiencia, no un salto", () => {
    const rs = charlar([...HASTA_VENTAS, "trabajé 3 años en una agencia", "no"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.postulacion?.datos.experiencia_rubro).toBe("no");
    expect(r.sesion.postulacion?.omitidos).toEqual([]);
  });

  it("una edad salteada no se confunde despues con 'tengo 20 años de experiencia'", () => {
    const rs = charlar(["cv", "Juan Pérez", "no sé", "Posse", "3537 123456", "tengo 20 años de experiencia vendiendo"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.postulacion?.datos.edad).toBeUndefined();
    expect(r.sesion.postulacion?.datos.experiencia_ventas).toMatch(/20 años de experiencia/);
  });
});

describe("postulacion de vendedor: preguntas que no son de los datos", () => {
  it.each(["cuánto pagan?", "hay comisiones", "el sueldo es fijo?", "cuanto se gana?", "horario de trabajo?"])(
    "'%s' lo ve Marcos y se repite la pregunta pendiente",
    (pregunta) => {
      const rs = charlar([...HASTA_VENTAS, pregunta]);
      const r = rs[rs.length - 1];

      expect(textos(r)[0]).toMatch(/Marcos/);
      expect(ultimoTexto(r)).toMatch(PREGUNTAS[4]);
      expect(r.sesion.postulacion?.campo).toBe("experiencia_ventas");
      expect(r.sesion.postulacion?.datos.experiencia_ventas).toBeUndefined();
      expect(r.sesion.fallos).toBe(0);
    },
  );

  it.each([
    ["vendía a comisión, sin sueldo fijo", "experiencia_ventas"],
    ["tengo experiencia en financiaciones", "experiencia_ventas"],
    ["vendía autos usados, el precio lo negociaba yo", "experiencia_ventas"],
  ])("'%s' es una respuesta de la postulacion, no una pregunta", (respuesta, campo) => {
    const rs = charlar([...HASTA_VENTAS, respuesta]);
    const r = rs[rs.length - 1];

    expect(r.sesion.postulacion?.datos[campo as "experiencia_ventas"]).toBe(respuesta);
    expect(r.sesion.postulacion?.campo).toBe("experiencia_rubro");
    expect(r.sesion.paso).toBe("postulando");
  });

  it("'mi horario de trabajo actual es de 8 a 16' es la disponibilidad, no una pregunta", () => {
    const rs = charlar([
      ...HASTA_VENTAS,
      "3 años en una agencia",
      "gestoría",
      "prendarios",
      "mi horario de trabajo actual es de 8 a 16",
    ]);
    const r = rs[rs.length - 1];

    expect(r.postulacion?.disponibilidad).toBe("mi horario de trabajo actual es de 8 a 16");
  });
});

describe("postulacion de vendedor: cambio de tema", () => {
  it("una pregunta por un auto concreto se responde aparte y la postulacion queda guardada", () => {
    const rs = charlar([...HASTA_VENTAS, "cuanto sale el vento?"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.paso).toBe("libre");
    expect(textos(r).join("\n") + JSON.stringify(tarjetas(r))).toContain("USD 14.500");
    expect(r.sesion.postulacion?.datos.nombre).toBe("Juan Pérez");
    expect(r.sesion.postulacion?.campo).toBe("experiencia_ventas");
    expect(r.postulacion).toBeNull();
  });

  it("despues del cambio de tema, 'cv' retoma donde quedo", () => {
    const rs = charlar([...HASTA_VENTAS, "cuanto sale el vento?", "cv"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.paso).toBe("postulando");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[4]);
  });
});

describe("postulacion de vendedor: fotos, audios y archivos", () => {
  it.each([["image"], ["audio"], ["file"]])("un adjunto '%s' en medio del flujo manda el CV a Marcos y no pierde la pregunta", (adjunto) => {
    const rs = charlar([...HASTA_VENTAS, { texto: null, adjuntos: [adjunto] }]);
    const r = rs[rs.length - 1];

    expect(r.responder).toBe(true);
    expect(textos(r).join("\n")).toMatch(/Marcos/);
    expect(botonMarcos(r)).toBe(true);
    expect(botonNati(r)).toBe(false);
    expect(r.sesion.paso).toBe("postulando");
    expect(r.sesion.postulacion?.campo).toBe("experiencia_ventas");
  });
});

describe("postulacion de vendedor: no se mete donde no corresponde", () => {
  it.each(["quiero hablar con un vendedor", "lo necesito para trabajo", "busco una camioneta para trabajar"])(
    "'%s' no arranca la postulacion",
    (texto) => {
      const [r] = charlar([texto]);

      expect(r.sesion.postulacion).toBeNull();
      expect(r.sesion.paso).not.toBe("postulando");
    },
  );

  it("'quiero hablar con un vendedor' sigue derivando a Nati", () => {
    const [r] = charlar(["quiero hablar con un vendedor"]);

    expect(botonNati(r)).toBe(true);
    expect(botonMarcos(r)).toBe(false);
  });

  it("'buscan vendedor?' si arranca la postulacion (gana sobre 'humano')", () => {
    const [r] = charlar(["buscan vendedor?"]);

    expect(r.sesion.paso).toBe("postulando");
    expect(botonNati(r)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run src/lib/bot/postulacion.test.ts`
Expected: FAIL en cancelar, saltear, condiciones, cambio de tema y adjuntos. Los de "no se mete donde no corresponde" y las respuestas libres con palabras de otras intenciones **ya pasan** con el código de la Task 5 (son pruebas que fijan el comportamiento); si alguno falla, es un bug a corregir en la Task 5/2, no un test a ajustar.

- [ ] **Step 3: Implementar en `postulacion.ts`**

En `src/lib/bot/postulacion.ts`:

1. Cambiar el import de `nlu/intenciones` por (ya existe, sumar nada) y agregar estos imports nuevos junto a los demás:

```ts
import { extraerEntidades } from "./nlu/entidades";
import { tokenizar } from "./nlu/normalizar";
```

2. Agregar después de `NO_ES_UNA_LOCALIDAD`:

```ts
const CANCELAR = new Set(["cancelar", "cancela", "cancelo", "cancelalo", "dejalo", "deja", "dejala", "olvidalo", "olvidate"]);
// Frases completas ya normalizadas. "no" a secas NO esta: es una respuesta valida ("¿experiencia en el rubro?" "no").
const OMITIR = new Set([
  "no se",
  "paso",
  "pasame",
  "despues",
  "luego",
  "saltear",
  "saltealo",
  "prefiero no",
  "prefiero no decirlo",
  "no quiero",
  "ahora no",
  "mas tarde",
  "otro momento",
]);
// Una pregunta sobre un auto concreto es otro tema; una intencion suelta no ("el precio lo negociaba yo").
const PREGUNTAS_DE_AUTO = new Set<Intencion>(["precio", "info", "disponibilidad"]);
// Sueldo, comision, horario de trabajo: solo cuentan como pregunta si se preguntan (con "?" o con una
// palabra interrogativa al comienzo). "vendia a comision" o "mi horario de trabajo actual es..." son respuestas.
const PALABRAS_CONDICIONES = ["sueldo", "sueldos", "comision", "comisiones", "aguinaldo", "blanco"];
const FRASES_CONDICIONES = ["cuanto pagan", "cuanto cobran", "cuanto se gana", "cuanto ganan", "horario de trabajo", "horarios de trabajo", "obra social"];
const INTERROGATIVAS = new Set(["cuanto", "cuanta", "cuantos", "cuantas", "hay", "tienen", "como", "es", "son", "que", "cual", "cuales", "se", "pagan", "cobran", "dan"]);
```

3. Reemplazar **toda** la función `pasoPostulacion` por:

```ts
/** Devuelve false si el cliente cambio de tema: el paso se abandona y el mensaje sigue su curso. */
export function pasoPostulacion(t: Turno, texto: string): boolean {
  const p = postulacionDe(t);
  const campo = p.campo ?? siguienteCampo(p);
  if (campo === null) {
    // Sesion rara (paso sin pregunta pendiente): no hay nada que seguir.
    salirDelPaso(t.s);
    return false;
  }

  const tokens = tokenizar(texto);
  const normalizado = tokens.join(" ");

  // "cancelar" deja el paso pero conserva lo respondido: un nuevo "cv" retoma donde quedo.
  if (tokens.length <= 3 && CANCELAR.has(tokens[0] ?? "")) {
    p.campo = campo;
    salirDelPaso(t.s);
    decir(t, variante(t, "postula-cancelada", T.postulacionCancelada));
    return true;
  }

  // Una pregunta por un auto concreto ("cuanto sale el vento?") es otro tema: se responde aparte y la
  // postulacion queda guardada. Una intencion suelta no alcanza: "tengo experiencia en financiaciones" o
  // "el precio lo negociaba yo" son respuestas de la postulacion.
  const ent = extraerEntidades(texto, t.e.catalogo);
  if (ent.vehiculoIds.length > 0 && detectarIntenciones(texto).some((i) => PREGUNTAS_DE_AUTO.has(i))) {
    p.campo = campo;
    salirDelPaso(t.s);
    return false;
  }

  if (esPreguntaDeCondiciones(texto, tokens)) {
    decir(t, variante(t, "postula-condiciones", T.postulacionCondiciones(reclutador(t))));
    decir(t, variante(t, `postula-${campo}`, T.preguntaPostulacion[campo]));
    return true;
  }

  if (OMITIR.has(normalizado) || normalizado.startsWith("prefiero no")) {
    // Sin nombre no hay postulacion: saltearlo cuenta como una respuesta que no sirve.
    if (campo === "nombre") return falloEn(t, p, campo);
    p.omitidos.push(campo);
    avanzar(t, p);
    return true;
  }

  // Lo que el candidato dice de paso (un telefono, "vivo en X") se aprovecha aunque conteste otra cosa.
  absorberExtras(p, texto, campo);
  const valor = respuestaA(campo, texto);
  if (valor === null) return falloEn(t, p, campo);

  guardar(p, campo, valor);
  avanzar(t, p);
  return true;
}

function esPreguntaDeCondiciones(texto: string, tokens: string[]): boolean {
  const dicho = ` ${tokens.join(" ")} `;
  const toca = FRASES_CONDICIONES.some((frase) => dicho.includes(` ${frase} `)) || PALABRAS_CONDICIONES.some((palabra) => tokens.includes(palabra));
  return toca && (texto.includes("?") || INTERROGATIVAS.has(tokens[0] ?? ""));
}
```

- [ ] **Step 4: Implementar en el motor (adjuntos durante la postulación)**

En `src/lib/bot/motor.ts`:

1. En el import de `./turno`, agregar `mostrarContactoReclutador,` y `reclutador,` (en orden alfabético quedan después de `mostrarLista` y `referenciaContextual`; el orden no afecta).

2. En la función `sinTexto`, agregar **entre** el `if` de las menciones y la línea `// Audio o foto: ...`:

```ts
  // Quien se postula suele mandar el CV como foto o archivo: por Instagram no se recibe, va a Marcos por WhatsApp.
  if (t.s.paso === "postulando") {
    decir(t, variante(t, "postula-adjunto", T.postulacionAdjunto(reclutador(t))));
    return mostrarContactoReclutador(t, t.s.postulacion?.datos ?? {});
  }
```

- [ ] **Step 5: Correr los tests y ver que pasan**

Run: `npx vitest run src/lib/bot/postulacion.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` sin errores.

- [ ] **Step 6: Correr toda la suite**

Run: `npx vitest run`
Expected: todo PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/postulacion.ts src/lib/bot/postulacion.test.ts src/lib/bot/motor.ts
git commit -m "feat: cancelar, saltear, preguntas de condiciones y adjuntos en la postulacion" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Guardado de la postulación (tabla, dependencia y handler)

**Files:**
- Create: `supabase/schema-postulantes.sql`
- Create: `src/lib/bot/postulaciones.ts`
- Modify: `src/lib/bot/handler.ts`
- Modify: `src/lib/bot/deps.ts`
- Test: `src/lib/bot/postulaciones.test.ts` (nuevo), `src/lib/bot/handler.test.ts`

**Interfaces:**
- Consumes: `PostulacionInput` (Task 3), `ResultadoMotor.postulacion` (Task 5), `tarjetaPostulacion` (Task 4), `T.contactoReclutadorEnTexto` (Task 4).
- Produces:
  - `guardarPostulacionInstagram(db: SupabaseClient, igUserId: string, postulacion: PostulacionInput, usuario: string | null): Promise<void>` (lanza si falla).
  - `DepsBot.guardarPostulacion(senderId: string, postulacion: PostulacionInput, usuario: string | null): Promise<void>`.
  - `MENSAJE_POSTULACION_FALLIDA` exportada desde `handler.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/bot/postulaciones.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { guardarPostulacionInstagram } from "./postulaciones";
import type { PostulacionInput } from "./types";

function dbFalso(error: { message: string } | null = null) {
  const llamadas: Array<{ tabla: string; fila: Record<string, unknown>; opciones: unknown }> = [];
  const db = {
    from: (tabla: string) => ({
      upsert: async (fila: Record<string, unknown>, opciones: unknown) => {
        llamadas.push({ tabla, fila, opciones });
        return { error };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, llamadas };
}

const POSTULACION: PostulacionInput = {
  nombre: "Juan Pérez",
  edad: 28,
  localidad: "Justiniano Posse",
  telefono: "3537 123456",
  experiencia_ventas: "3 años en una agencia",
  experiencia_rubro: null,
  financiaciones: "prendarios",
  disponibilidad: "jornada completa",
};

describe("guardarPostulacionInstagram", () => {
  it("hace upsert en postulantes por cuenta de Instagram, con el @usuario y la fecha", async () => {
    const { db, llamadas } = dbFalso();

    await guardarPostulacionInstagram(db, "1234567890", POSTULACION, "juanp");

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].tabla).toBe("postulantes");
    expect(llamadas[0].opciones).toEqual({ onConflict: "instagram_id" });
    expect(llamadas[0].fila).toMatchObject({
      instagram_id: "1234567890",
      usuario_instagram: "juanp",
      ...POSTULACION,
    });
    expect(Number.isNaN(Date.parse(String(llamadas[0].fila.actualizado)))).toBe(false);
  });

  it("no pisa el estado que le puso el equipo: nunca manda la columna estado", async () => {
    const { db, llamadas } = dbFalso();

    await guardarPostulacionInstagram(db, "1", POSTULACION, null);

    expect(llamadas[0].fila).not.toHaveProperty("estado");
    expect(llamadas[0].fila.usuario_instagram).toBeNull();
  });

  it("lanza si el guardado falla", async () => {
    const { db } = dbFalso({ message: "rechazado" });

    await expect(guardarPostulacionInstagram(db, "1", POSTULACION, null)).rejects.toThrow(/rechazado/);
  });
});
```

En `src/lib/bot/handler.test.ts`:

1. Cambiar el import de `./handler` para sumar `MENSAJE_POSTULACION_FALLIDA`:

```ts
import { type DepsBot, MENSAJE_ERROR_TECNICO, MENSAJE_LEAD_FALLIDO, MENSAJE_POSTULACION_FALLIDA, procesarEventos } from "./handler";
```

2. En `crearDeps`, agregar después de `guardarLead: vi.fn(async () => {}),`:

```ts
    guardarPostulacion: vi.fn(async () => {}),
```

3. Agregar al final del archivo:

```ts
describe("procesarEventos: postulacion de vendedor", () => {
  const POSTULACION = {
    nombre: "Juan Pérez",
    edad: 28,
    localidad: "Posse",
    telefono: "3537123456",
    experiencia_ventas: "3 años",
    experiencia_rubro: null,
    financiaciones: null,
    disponibilidad: "completa",
  };
  const SESION_ENVIADA = {
    ...SESION,
    postulacion: { datos: { nombre: "Juan Pérez" }, omitidos: [], campo: null, enviada: true },
  };

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("guarda la postulacion con el @usuario del perfil y manda la respuesta del motor", async () => {
    vi.mocked(conversar).mockReturnValue(resultado({ postulacion: POSTULACION, sesion: SESION_ENVIADA }));
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: { nombre: "Juan", usuario: "juanp" } })),
    });

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarPostulacion).toHaveBeenCalledWith("111", POSTULACION, "juanp");
    expect(enviado(deps)).toEqual(["¡Hola! ¿Qué andás buscando?"]);
    expect(deps.guardarSesion).toHaveBeenCalledWith("111", SESION_ENVIADA);
  });

  it("sin postulacion no toca la base de postulantes", async () => {
    vi.mocked(conversar).mockReturnValue(resultado());
    const deps = crearDeps();

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarPostulacion).not.toHaveBeenCalled();
  });

  it("si falla el guardado no confirma: avisa, manda el boton a Marcos y deja la sesion sin enviar", async () => {
    vi.mocked(conversar).mockReturnValue(resultado({ postulacion: POSTULACION, sesion: SESION_ENVIADA }));
    const deps = crearDeps({ guardarPostulacion: vi.fn(async () => Promise.reject(new Error("caido"))) });

    await procesarEventos([mensaje()], deps);

    // No sale la confirmacion del motor ("Anoté tus datos"): sale el aviso fijo.
    expect(enviado(deps)).toEqual([MENSAJE_POSTULACION_FALLIDA]);
    const tarjetasEnviadas = vi.mocked(deps.enviarTarjetas).mock.calls.flatMap((c) => c[1]);
    expect(tarjetasEnviadas).toHaveLength(1);
    expect(tarjetasEnviadas[0].botones[0].url.startsWith("https://wa.me/5493537662444?text=")).toBe(true);
    // El proximo "cv" reintenta el guardado: la sesion no queda como enviada.
    expect(deps.guardarSesion).toHaveBeenCalledWith("111", {
      ...SESION,
      postulacion: { datos: { nombre: "Juan Pérez" }, omitidos: [], campo: null, enviada: false },
    });
  });

  it("el aviso de falla cumple el tono, lleva un emoji y nombra a Marcos", () => {
    expect(violacionesDeTono(MENSAJE_POSTULACION_FALLIDA)).toEqual([]);
    expect(MENSAJE_POSTULACION_FALLIDA).toMatch(/Marcos/);
    expect(Array.from(MENSAJE_POSTULACION_FALLIDA.matchAll(/\p{Extended_Pictographic}/gu)).length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `npx vitest run src/lib/bot/postulaciones.test.ts src/lib/bot/handler.test.ts`
Expected: FAIL (no existen `postulaciones.ts`, `MENSAJE_POSTULACION_FALLIDA` ni `guardarPostulacion`).

- [ ] **Step 3: La tabla**

Crear `supabase/schema-postulantes.sql`:

```sql
-- Postulaciones de vendedor que llegan por el bot de Instagram.
-- Correr en el SQL Editor de Supabase (proyecto de Posse) ANTES de desplegar el bot con postulaciones.

-- Una fila por cuenta de Instagram: si la misma persona vuelve a postularse, la fila se actualiza
-- (upsert por instagram_id) y conserva el estado que le puso el equipo.
create table if not exists public.postulantes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  instagram_id text not null unique,
  -- El @ del candidato: sirve para encontrarlo en Instagram si no dejo telefono.
  usuario_instagram text,
  nombre text not null,
  edad integer check (edad is null or edad between 16 and 75),
  localidad text,
  telefono text,
  experiencia_ventas text,
  experiencia_rubro text,
  financiaciones text,
  disponibilidad text,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'descartado'))
);

-- Datos personales: sin politicas a proposito. Solo la service_role key (que ignora RLS) accede, y la
-- lee el panel de admin (exige sesion) y el bot. No se pueden leer con la anon key.
alter table public.postulantes enable row level security;
```

- [ ] **Step 4: El módulo de guardado**

Crear `src/lib/bot/postulaciones.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostulacionInput } from "./types";

/**
 * Guarda la postulacion de vendedor en `postulantes`. Hay una fila por cuenta de Instagram: si la misma
 * persona vuelve a postularse se actualiza (no se duplica). No manda `estado`, asi que conserva el que
 * le puso el equipo.
 */
export async function guardarPostulacionInstagram(
  db: SupabaseClient,
  igUserId: string,
  postulacion: PostulacionInput,
  usuario: string | null,
): Promise<void> {
  const { error } = await db.from("postulantes").upsert(
    {
      instagram_id: igUserId,
      usuario_instagram: usuario,
      ...postulacion,
      actualizado: new Date().toISOString(),
    },
    { onConflict: "instagram_id" },
  );

  if (error) throw new Error(`No se pudo guardar la postulacion: ${error.message}`);
}
```

- [ ] **Step 5: El handler**

En `src/lib/bot/handler.ts`:

1. Cambiar el import de `./respuestas` y el de `./textos` para que queden:

```ts
import { tarjetaContacto, tarjetaPostulacion } from "./respuestas";
```

```ts
import { contactoEnTexto, contactoReclutadorEnTexto } from "./textos";
```

(Hoy `contactoEnTexto` se importa de `./textos`: reemplazar esa línea completa. Si el archivo importa `* as T`, usar `T.contactoReclutadorEnTexto` en su lugar.)

2. Cambiar el import de tipos por `import type { LeadInput, MensajeSalida, Perfil, PostulacionInput, Tarjeta, VehiculoCatalogo } from "./types";`

3. Agregar después de `MENSAJE_LEAD_FALLIDO`:

```ts
export const MENSAJE_POSTULACION_FALLIDA = `No pude dejar anotada tu postulación 😕 Escribile directo a ${NEGOCIO.reclutador.nombre} por WhatsApp y mandale tu CV 👇`;
```

4. En el tipo `DepsBot`, agregar después de `guardarLead(...)`:

```ts
  guardarPostulacion(senderId: string, postulacion: PostulacionInput, usuario: string | null): Promise<void>;
```

5. En `procesarMensaje`, cambiar `let mensajes = resultado.mensajes;` por:

```ts
  let mensajes = resultado.mensajes;
  let sesion = resultado.sesion;
```

6. Agregar **después** del bloque `if (resultado.lead) { ... }` y antes del comentario `// El vinculo historia -> auto ...`:

```ts

  if (resultado.postulacion) {
    try {
      await deps.guardarPostulacion(senderId, resultado.postulacion, perfil?.usuario?.trim() || null);
    } catch (err) {
      console.error(`[bot] No se pudo guardar la postulacion de ${senderId}:`, err);
      // La respuesta del motor confirma que los datos quedaron anotados; si no es cierto, seria mentira.
      // El boton a Marcos es la unica salida que le queda al candidato.
      const tarjeta = tarjetaPostulacion(resultado.postulacion, { negocio: deps.negocio, siteUrl: deps.siteUrl });
      mensajes = [
        { tipo: "texto", texto: MENSAJE_POSTULACION_FALLIDA },
        {
          tipo: "tarjetas",
          tarjetas: [tarjeta],
          alternativaTexto: contactoReclutadorEnTexto(deps.negocio.reclutador.nombre, tarjeta.botones[0].url),
        },
      ];
      // Sin guardar no esta enviada: el proximo "cv" reintenta el guardado en vez de decir "ya esta anotado".
      sesion = {
        ...sesion,
        postulacion: sesion.postulacion ? { ...sesion.postulacion, enviada: false } : null,
      };
    }
  }
```

7. Cambiar la línea `await guardarSesionSegura(senderId, resultado.sesion, deps);` (la que está **después** de `olvidarHistoria`, no la del `!resultado.responder`) por `await guardarSesionSegura(senderId, sesion, deps);`.

- [ ] **Step 6: El cableado**

En `src/lib/bot/deps.ts`:

1. Agregar el import `import { guardarPostulacionInstagram } from "./postulaciones";` (después de `import { NEGOCIO } from "./negocio";`).
2. Agregar en el objeto devuelto, después de `guardarLead: ...`:

```ts
    guardarPostulacion: (senderId, postulacion, usuario) => guardarPostulacionInstagram(db, senderId, postulacion, usuario),
```

- [ ] **Step 7: Correr los tests y ver que pasan**

Run: `npx vitest run src/lib/bot/postulaciones.test.ts src/lib/bot/handler.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` sin errores.

- [ ] **Step 8: Correr toda la suite**

Run: `npx vitest run`
Expected: todo PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/schema-postulantes.sql src/lib/bot/postulaciones.ts src/lib/bot/postulaciones.test.ts src/lib/bot/handler.ts src/lib/bot/handler.test.ts src/lib/bot/deps.ts
git commit -m "feat: guardar las postulaciones de vendedor y avisar si falla" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Panel de postulantes y texto de privacidad

**Files:**
- Create: `src/app/admin/postulantes/page.tsx`
- Modify: `src/components/admin-shell.tsx`
- Modify: `src/app/privacidad/page.tsx`

**Interfaces:**
- Consumes: la tabla `postulantes` (Task 7); `requireAdminSession` y `createAdminSupabaseClient` (ya existen y los usa `/admin/leads`).
- Produces: la ruta `/admin/postulantes` (solo lectura) y su ítem de menú.

Estas pantallas no tienen tests unitarios en el repo (igual que `/admin/leads` y `/privacidad`): se verifican con el chequeo de tipos, el lint y una mirada al render.

- [ ] **Step 1: La pantalla**

Crear `src/app/admin/postulantes/page.tsx`:

```tsx
import { requireAdminSession } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

type Postulante = {
  id: string;
  created_at: string;
  instagram_id: string;
  usuario_instagram: string | null;
  nombre: string;
  edad: number | null;
  localidad: string | null;
  telefono: string | null;
  experiencia_ventas: string | null;
  experiencia_rubro: string | null;
  financiaciones: string | null;
  disponibilidad: string | null;
  estado: string;
};

/** Texto largo de una respuesta libre: se muestra completo pero acotado de ancho. */
function Texto({ valor }: { valor: string | null }) {
  return <span className="block max-w-[220px] whitespace-pre-wrap break-words">{valor ?? "—"}</span>;
}

export default async function PostulantesPage() {
  await requireAdminSession();
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from("postulantes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const postulantes = (data ?? []) as Postulante[];

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Postulantes</h1>
        <p className="mt-1 text-sm text-car-muted">Candidatos a vendedor que se postularon por el bot de Instagram</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-car-gray2 text-xs uppercase tracking-wide text-car-muted">
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Edad</th>
              <th className="px-4 py-3 text-left">Localidad</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Ventas</th>
              <th className="px-4 py-3 text-left">Rubro</th>
              <th className="px-4 py-3 text-left">Financiaciones</th>
              <th className="px-4 py-3 text-left">Disponibilidad</th>
              <th className="px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {postulantes.map((p) => (
              <tr key={p.id} className="border-b border-white/5 bg-car-gray align-top transition hover:bg-car-gray2">
                <td className="px-4 py-3 text-xs text-car-muted">{new Date(p.created_at).toLocaleString("es-AR")}</td>
                <td className="px-4 py-3 font-semibold text-car-white">
                  {p.nombre}
                  {p.usuario_instagram && (
                    <a
                      href={`https://www.instagram.com/${encodeURIComponent(p.usuario_instagram)}`}
                      target="_blank"
                      rel="noopener"
                      className="block text-xs font-normal text-car-muted hover:text-car-gold"
                    >
                      @{p.usuario_instagram}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-car-muted">{p.edad ?? "—"}</td>
                <td className="px-4 py-3 text-car-muted">{p.localidad ?? "—"}</td>
                <td className="px-4 py-3 text-car-muted">
                  {p.telefono ? (
                    <a
                      href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener"
                      className="hover:text-car-gold"
                    >
                      {p.telefono}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-car-muted"><Texto valor={p.experiencia_ventas} /></td>
                <td className="px-4 py-3 text-car-muted"><Texto valor={p.experiencia_rubro} /></td>
                <td className="px-4 py-3 text-car-muted"><Texto valor={p.financiaciones} /></td>
                <td className="px-4 py-3 text-car-muted"><Texto valor={p.disponibilidad} /></td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                      p.estado === "nuevo"
                        ? "bg-emerald-900/50 text-emerald-400"
                        : p.estado === "contactado"
                        ? "bg-car-gold/15 text-car-gold"
                        : "bg-white/5 text-car-muted"
                    }`}
                  >
                    {p.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {postulantes.length === 0 && (
          <p className="py-10 text-center text-car-muted">
            Aún no hay postulaciones. Aparecen acá cuando alguien responde &quot;CV&quot; a la historia del puesto.
          </p>
        )}
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 2: El menú**

En `src/components/admin-shell.tsx`:

1. Cambiar el import de `lucide-react` por: `import { Briefcase, Car, LayoutDashboard, LogOut, Users, Menu, X, Smartphone } from "lucide-react";`
2. Agregar al arreglo `navItems`, después del ítem de leads:

```ts
  { href: "/admin/postulantes", label: "Postulantes (CV)", icon: Briefcase },
```

- [ ] **Step 3: La política de privacidad**

En `src/app/privacidad/page.tsx`:

1. En la `Seccion` "Qué datos recopilamos", agregar dentro de la lista `<ul>`, después del `<li>` de "Los datos de contacto que nos des voluntariamente...":

```tsx
                <li>
                  Si te postulás para trabajar con nosotros, los datos de tu postulación: tu edad, tu
                  localidad, tu teléfono y tu experiencia laboral.
                </li>
```

2. En la `Seccion` "Para qué los usamos", agregar dentro de la lista, después de `<li>Contactarte, si lo pediste.</li>`:

```tsx
                <li>Evaluar tu postulación, si te querés sumar a nuestro equipo.</li>
```

3. Cambiar `Última actualización: 12/10/2026` por `Última actualización: 13/10/2026`.

- [ ] **Step 4: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/postulantes src/components/admin-shell.tsx src/app/privacidad`
Expected: sin errores. Si el lint marca `<img>` en `admin-shell.tsx`, es un aviso que ya existía en ese archivo: no tocarlo.

- [ ] **Step 5: Mirar el render de la política de privacidad**

Si hay un servidor de desarrollo disponible (`npm run dev` o `preview_start`), abrir `/privacidad` y comprobar que aparecen los dos textos nuevos. `/admin/postulantes` exige sesión de admin: no se verifica sin una.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/postulantes/page.tsx src/components/admin-shell.tsx src/app/privacidad/page.tsx
git commit -m "feat: pantalla de postulantes y aviso de privacidad" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificación final y puesta en marcha

**Files:** ninguno (solo verificación). No hay código nuevo.

- [ ] **Step 1: Suite completa, tipos y lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/lib/bot src/lib/utils.ts src/app/admin src/components/admin-shell.tsx src/app/privacidad`
Expected: todo PASS, sin errores de tipos y sin errores de lint nuevos. Anotar el total de tests (antes de este trabajo eran 627).

- [ ] **Step 2: Revisar que nada de Nati cambió**

Run: `git diff main --stat` y `git diff main -- src/lib/bot/negocio.ts src/lib/utils.ts`
Expected: `WHATSAPP_LOCAL`, `NEGOCIO.whatsappNumero`, `NEGOCIO.secretaria` y `buildWhatsAppUrlInstagram` sin cambios. Solo se agregó lo de Marcos.

- [ ] **Step 3: Revisar de punta a punta con una charla real simulada**

Run: `npx vitest run src/lib/bot/postulacion.test.ts -t "pregunta un dato por turno"`
Expected: PASS. Es la charla completa: "cv" → 8 preguntas → postulación entregada con el botón a Marcos.

- [ ] **Step 4: Entregar el resumen al dueño (no hacer push ni merge)**

Informar, sin ejecutar nada de esto, los pasos que le tocan al dueño, **en este orden**:

1. Correr `supabase/schema-postulantes.sql` en el SQL Editor de Supabase **antes** de desplegar (si el bot se despliega primero, las postulaciones no se guardan; el bot igual deriva a Marcos y lo avisa, pero se pierden los datos).
2. Pedir el push de `feat/postulaciones` y el merge a `main` con la frase de autorización que corresponda (Vercel despliega solo).
3. Revisar el texto nuevo de `/privacidad`.
4. Probar con una cuenta con rol: escribir "cv", recorrer las 8 preguntas, tocar "Enviar CV a Marcos" (el mensaje debe abrirse sin emojis ni signos de pregunta) y ver la fila en `/admin/postulantes`.
5. Subir la historia del puesto.

Mencionar también: cuenta que responda "hola" a la historia sin escribir "CV" recibe la charla de autos de siempre (decisión del dueño: detección solo por palabras clave).
