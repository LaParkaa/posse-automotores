# Bot de Instagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el bot de WhatsApp (`whatsapp-web.js`) por un webhook serverless de Instagram DM dentro del Next.js existente, que responde con IA usando el stock real y capta leads.

**Architecture:** Una ruta de App Router (`/api/instagram/webhook`) valida la firma de Meta, extrae los mensajes del payload, los deduplica por `mid` en Supabase, arma el contexto (historial + stock `disponible` inyectado en el system prompt) y hace **una sola llamada** a Claude Haiku 4.5. La respuesta se envía por la Graph API. La orquestación (`handler.ts`) recibe sus dependencias por parámetro, así se testea sin red ni base de datos.

**Tech Stack:** Next.js 16.2.9 (App Router, Route Handlers), TypeScript strict, Supabase (`@supabase/supabase-js`), `@anthropic-ai/sdk`, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-06-bot-instagram-design.md`.
- Tabla de vehículos: `vehiculos_posse`. Solo `estado = 'disponible'` y `deleted_at is null`. **Nunca** usar el fallback a datos locales de `src/lib/data.ts` (inventaría autos falsos).
- Modelo: `claude-haiku-4-5-20251001`. **Una llamada a Claude por mensaje**, sin loop de herramientas. `guardar_lead` se ejecuta sin segunda llamada.
- Graph API: `POST https://graph.facebook.com/v21.0/me/messages`. El token va en el header `Authorization: Bearer`, nunca en la URL.
- Texto de Instagram: máximo 1000 **bytes** UTF-8 por mensaje.
- Con firma válida, el `POST` del webhook **siempre** responde 200 (salvo JSON inválido: 400). Firma inválida: 401. `GET` con token incorrecto: 403.
- Variables de entorno: `IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `PAGE_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `SITE_URL` (+ las de Supabase que ya existen). Opcional: `BOT_HORARIO`.
- WhatsApp del local para derivar: `+54 9 3537 55-8947`.
- Tests: Vitest, `src/**/*.test.ts`. Estilo del repo: identificadores y comentarios en español, imports relativos dentro de `src/lib`, alias `@/` en `src/app`.
- Los comentarios explican el porqué, no el qué.
- `whatsapp-bot/` está **sin versionar en git** (untracked): borrarlo es irreversible. Solo se borra con confirmación explícita del usuario (Task 11).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/instagram/payload.ts` | Extraer mensajes del payload de Meta (puro) |
| `src/lib/instagram/signature.ts` | Validar `X-Hub-Signature-256` (puro) |
| `src/lib/instagram/graph.ts` | Partir textos y enviar por Graph API |
| `src/lib/bot/types.ts` | Tipos compartidos: `TurnoHistorial`, `LeadInput`, `RespuestaIA` |
| `src/lib/bot/stock.ts` | Formatear y consultar el stock disponible |
| `src/lib/bot/prompt.ts` | `EMPRESA` y system prompt en bloques (con cache) |
| `src/lib/bot/ai.ts` | Llamada única a Claude + parseo de la respuesta |
| `src/lib/bot/conversations.ts` | Historial y deduplicación en Supabase |
| `src/lib/bot/leads.ts` | Guardar leads de Instagram |
| `src/lib/bot/handler.ts` | Orquestación del flujo por mensaje (dependencias inyectadas) |
| `src/lib/bot/deps.ts` | Cableado real de las dependencias (Supabase, Claude, Graph) |
| `src/app/api/instagram/webhook/route.ts` | `GET` verificación, `POST` mensajes |
| `supabase/schema-instagram.sql` | Tabla `ig_mensajes` y columnas nuevas en `leads` |

---

### Task 1: Dependencia, variables de entorno y migración SQL

**Files:**
- Modify: `package.json`, `package-lock.json` (vía npm)
- Modify: `.env.example`
- Create: `supabase/schema-instagram.sql`
- Modify: `docs/superpowers/specs/2026-10-06-bot-instagram-design.md` (tabla de archivos)

**Interfaces:**
- Produces: tablas `public.ig_mensajes (id, mid unique, ig_user_id, role, content, created_at)` y columnas `leads.origen` (text, default `'whatsapp'`), `leads.instagram_id` (text), `leads.whatsapp` nullable. Las usan las Tasks 7 y 10.

- [ ] **Step 1: Instalar el SDK de Anthropic**

Run: `npm install @anthropic-ai/sdk@^0.131.0`
Expected: termina sin errores; `package.json` lista `@anthropic-ai/sdk` en `dependencies`.

- [ ] **Step 2: Crear la migración SQL**

Create `supabase/schema-instagram.sql`:

```sql
-- Bot de Instagram: historial de conversaciones y origen de los leads.
-- Correr en el SQL Editor de Supabase sobre el proyecto de Posse.

-- Un mensaje por fila. "mid" es el id que asigna Meta a los mensajes del cliente:
-- el unique permite descartar los reintentos del webhook (Meta reenvia si tarda).
-- Las respuestas del bot no tienen mid.
create table if not exists public.ig_mensajes (
  id uuid primary key default gen_random_uuid(),
  mid text unique,
  ig_user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ig_mensajes_usuario_fecha_idx
  on public.ig_mensajes (ig_user_id, created_at desc);

-- Sin politicas a proposito: solo la service_role key (que ignora RLS) accede.
-- Las conversaciones son privadas y no deben leerse con la anon key.
alter table public.ig_mensajes enable row level security;

-- Los leads ahora pueden venir de Instagram, donde no hay numero de WhatsApp.
alter table public.leads
  add column if not exists origen text not null default 'whatsapp',
  add column if not exists instagram_id text;

alter table public.leads alter column whatsapp drop not null;

alter table public.leads drop constraint if exists leads_contacto_check;
alter table public.leads add constraint leads_contacto_check
  check (whatsapp is not null or instagram_id is not null);
```

- [ ] **Step 3: Documentar las variables en `.env.example`**

Append al final de `.env.example`:

```
# Bot de Instagram (webhook en /api/instagram/webhook)
# Token que inventes vos; el mismo valor se carga en Meta al configurar el webhook.
IG_VERIFY_TOKEN=un-token-largo-y-aleatorio
# App secret de la app de Meta (Configuracion de la app -> Basica). Valida la firma de los webhooks.
IG_APP_SECRET=YOUR_META_APP_SECRET
# Token de acceso de la pagina de Facebook vinculada a la cuenta de Instagram.
PAGE_ACCESS_TOKEN=YOUR_PAGE_ACCESS_TOKEN
# https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...
# URL publica del sitio, para los links a las fichas que manda el bot (sin barra final).
SITE_URL=https://tu-sitio.netlify.app
# Opcional: horarios que cuenta el bot. Si no esta, deriva al WhatsApp.
# BOT_HORARIO=Lunes a Viernes 9 a 13 y 16 a 20 | Sabados 9 a 13
```

- [ ] **Step 4: Actualizar la tabla de archivos del spec**

En `docs/superpowers/specs/2026-10-06-bot-instagram-design.md`, justo debajo de la fila de `src/lib/bot/conversations.ts`, agregar estas filas (el spec original los omitía por ser detalle de implementación):

```
| `src/lib/bot/types.ts` (nuevo) | Tipos compartidos del bot |
| `src/lib/bot/prompt.ts` (nuevo) | Datos de la empresa y system prompt en bloques cacheables |
| `src/lib/bot/leads.ts` (nuevo) | Guardado de leads de Instagram (evita duplicados) |
| `src/lib/bot/handler.ts` (nuevo) | Orquestación del flujo por mensaje, con dependencias inyectadas (testeable) |
| `src/lib/bot/deps.ts` (nuevo) | Cableado real de dependencias (Supabase, Claude, Graph API) |
```

- [ ] **Step 5: Aplicar la migración (acción manual del usuario)**

Pegar el contenido de `supabase/schema-instagram.sql` en el SQL Editor de Supabase y ejecutarlo. Verificar con:

```sql
select column_name, is_nullable from information_schema.columns
where table_name = 'leads' and column_name in ('whatsapp', 'origen', 'instagram_id');
```
Expected: 3 filas; `whatsapp` con `is_nullable = YES`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example supabase/schema-instagram.sql docs/superpowers/specs/2026-10-06-bot-instagram-design.md
git commit -m "feat: dependencia, variables y migracion SQL del bot de Instagram" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extracción del payload de Instagram

**Files:**
- Create: `src/lib/instagram/payload.ts`
- Test: `src/lib/instagram/payload.test.ts`

**Interfaces:**
- Produces: `type MensajeEntrante = { senderId: string; mid: string; texto: string | null }` y `extraerMensajes(body: unknown): MensajeEntrante[]`. `texto` es `null` cuando el mensaje no trae texto (foto, audio, sticker).

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/instagram/payload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extraerMensajes } from "./payload";

function webhook(messaging: unknown[]) {
  return {
    object: "instagram",
    entry: [{ id: "17841400000000000", time: 1700000000, messaging }],
  };
}

function evento(message: Record<string, unknown>, sender = "1234567890") {
  return {
    sender: { id: sender },
    recipient: { id: "17841400000000000" },
    timestamp: 1700000000000,
    message,
  };
}

describe("extraerMensajes", () => {
  it("extrae sender.id, mid y texto de un mensaje de texto", () => {
    const body = webhook([evento({ mid: "mid.abc", text: "Hola, ¿qué autos tienen?" })]);

    expect(extraerMensajes(body)).toEqual([
      { senderId: "1234567890", mid: "mid.abc", texto: "Hola, ¿qué autos tienen?" },
    ]);
  });

  it("recorta los espacios del texto", () => {
    const body = webhook([evento({ mid: "mid.abc", text: "  Hola  " })]);

    expect(extraerMensajes(body)[0].texto).toBe("Hola");
  });

  it("devuelve texto null cuando el mensaje solo trae un adjunto", () => {
    const body = webhook([
      evento({ mid: "mid.foto", attachments: [{ type: "image", payload: { url: "https://x" } }] }),
    ]);

    expect(extraerMensajes(body)).toEqual([
      { senderId: "1234567890", mid: "mid.foto", texto: null },
    ]);
  });

  it("ignora los ecos de mensajes enviados por la propia cuenta", () => {
    const body = webhook([evento({ mid: "mid.eco", text: "Respuesta del bot", is_echo: true })]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("ignora mensajes borrados", () => {
    const body = webhook([evento({ mid: "mid.borrado", is_deleted: true })]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("ignora eventos que no son mensajes (lecturas, reacciones, postbacks)", () => {
    const body = webhook([
      { sender: { id: "1" }, recipient: { id: "2" }, timestamp: 1, read: { mid: "mid.abc" } },
      { sender: { id: "1" }, recipient: { id: "2" }, timestamp: 1, postback: { payload: "x" } },
    ]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("ignora payloads de otros objetos", () => {
    const body = { ...webhook([evento({ mid: "mid.abc", text: "Hola" })]), object: "page" };

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("procesa varios eventos y varias entries en orden", () => {
    const body = {
      object: "instagram",
      entry: [
        {
          messaging: [
            evento({ mid: "mid.1", text: "uno" }, "111"),
            evento({ mid: "mid.2", text: "dos" }, "222"),
          ],
        },
        { messaging: [evento({ mid: "mid.3", text: "tres" }, "333")] },
      ],
    };

    expect(extraerMensajes(body).map((m) => m.mid)).toEqual(["mid.1", "mid.2", "mid.3"]);
  });

  it("descarta eventos sin sender.id o sin mid", () => {
    const body = webhook([
      { sender: {}, message: { mid: "mid.1", text: "sin id" } },
      evento({ text: "sin mid" }),
    ]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("tolera basura sin lanzar", () => {
    const basura: unknown[] = [
      null,
      undefined,
      "texto",
      42,
      [],
      {},
      { object: "instagram" },
      { object: "instagram", entry: "x" },
      { object: "instagram", entry: [null, { messaging: "x" }, { messaging: [null, 7] }] },
    ];

    for (const body of basura) {
      expect(extraerMensajes(body)).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/instagram/payload.test.ts`
Expected: FAIL — "Failed to resolve import ./payload" (el módulo no existe).

- [ ] **Step 3: Implementar**

Create `src/lib/instagram/payload.ts`:

```ts
export type MensajeEntrante = {
  senderId: string;
  mid: string;
  /** null cuando el mensaje no trae texto (foto, audio, sticker...). */
  texto: string | null;
};

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Saca los mensajes de cliente de un payload de webhook de Instagram.
 *
 * Meta manda en el mismo webhook lecturas, reacciones, postbacks y "ecos" de lo
 * que envia la propia cuenta. Solo nos interesan los mensajes entrantes: el resto
 * se descarta para no responderle al bot su propia respuesta.
 */
export function extraerMensajes(body: unknown): MensajeEntrante[] {
  if (!esObjeto(body) || body.object !== "instagram" || !Array.isArray(body.entry)) {
    return [];
  }

  const mensajes: MensajeEntrante[] = [];

  for (const entry of body.entry) {
    if (!esObjeto(entry) || !Array.isArray(entry.messaging)) continue;

    for (const evento of entry.messaging) {
      if (!esObjeto(evento) || !esObjeto(evento.sender) || !esObjeto(evento.message)) continue;

      const senderId = evento.sender.id;
      const { mid, text, is_echo: esEco, is_deleted: estaBorrado } = evento.message;

      if (typeof senderId !== "string" || typeof mid !== "string") continue;
      if (esEco === true || estaBorrado === true) continue;

      const texto = typeof text === "string" && text.trim() !== "" ? text.trim() : null;
      mensajes.push({ senderId, mid, texto });
    }
  }

  return mensajes;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/instagram/payload.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/instagram/payload.ts src/lib/instagram/payload.test.ts
git commit -m "feat: extraer mensajes del payload de Instagram" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Validación de la firma de Meta

**Files:**
- Create: `src/lib/instagram/signature.ts`
- Test: `src/lib/instagram/signature.test.ts`

**Interfaces:**
- Produces: `verificarFirma(rawBody: string, header: string | null, appSecret: string): boolean`. `header` es el valor crudo de `X-Hub-Signature-256` (`sha256=<hex>`).

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/instagram/signature.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verificarFirma } from "./signature";

const SECRET = "app-secret-de-prueba";

function firmar(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verificarFirma", () => {
  const body = '{"object":"instagram","entry":[]}';

  it("acepta una firma valida", () => {
    expect(verificarFirma(body, firmar(body), SECRET)).toBe(true);
  });

  it("acepta cuerpos con acentos y emojis (se firma el UTF-8 exacto)", () => {
    const conEmoji = '{"text":"¿Tienen una Amarok? 🚗"}';

    expect(verificarFirma(conEmoji, firmar(conEmoji), SECRET)).toBe(true);
  });

  it("rechaza si el cuerpo fue alterado", () => {
    expect(verificarFirma(`${body} `, firmar(body), SECRET)).toBe(false);
  });

  it("rechaza si la firma se hizo con otro secret", () => {
    expect(verificarFirma(body, firmar(body, "otro-secret"), SECRET)).toBe(false);
  });

  it("rechaza si falta el header o no tiene el prefijo sha256=", () => {
    expect(verificarFirma(body, null, SECRET)).toBe(false);
    expect(verificarFirma(body, "", SECRET)).toBe(false);
    expect(verificarFirma(body, firmar(body).replace("sha256=", ""), SECRET)).toBe(false);
  });

  it("rechaza hex invalido o de otra longitud sin lanzar", () => {
    expect(verificarFirma(body, "sha256=zz", SECRET)).toBe(false);
    expect(verificarFirma(body, "sha256=abcd", SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/instagram/signature.test.ts`
Expected: FAIL — "Failed to resolve import ./signature".

- [ ] **Step 3: Implementar**

Create `src/lib/instagram/signature.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIJO = "sha256=";

/**
 * Comprueba que el webhook lo mando Meta: HMAC-SHA256 del cuerpo crudo con el
 * app secret. Hay que firmar el texto exacto que llego, no el JSON re-serializado.
 */
export function verificarFirma(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith(PREFIJO)) return false;

  const recibida = Buffer.from(header.slice(PREFIJO.length), "hex");
  const esperada = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();

  // timingSafeEqual lanza si los largos difieren; un hex invalido da un buffer mas corto.
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/instagram/signature.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/instagram/signature.ts src/lib/instagram/signature.test.ts
git commit -m "feat: validar la firma X-Hub-Signature-256 de Meta" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Envío por Graph API

**Files:**
- Create: `src/lib/instagram/graph.ts`
- Test: `src/lib/instagram/graph.test.ts`

**Interfaces:**
- Produces: `MAX_BYTES_MENSAJE = 1000`, `partirTexto(texto: string, maxBytes?: number): string[]`, `enviarMensajeInstagram(destinatarioId: string, texto: string): Promise<void>` (lanza `Error` si falta `PAGE_ACCESS_TOKEN` o la Graph API responde error).

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/instagram/graph.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarMensajeInstagram, MAX_BYTES_MENSAJE, partirTexto } from "./graph";

const bytes = (texto: string) => new TextEncoder().encode(texto).length;

describe("partirTexto", () => {
  it("devuelve un solo mensaje si entra en el limite", () => {
    expect(partirTexto("Hola!")).toEqual(["Hola!"]);
  });

  it("devuelve lista vacia para texto vacio o solo espacios", () => {
    expect(partirTexto("")).toEqual([]);
    expect(partirTexto("   \n ")).toEqual([]);
  });

  it("parte sin pasar el limite de bytes y sin cortar palabras", () => {
    const texto = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" ");

    const partes = partirTexto(texto);

    expect(partes.length).toBeGreaterThan(1);
    for (const parte of partes) {
      expect(bytes(parte)).toBeLessThanOrEqual(MAX_BYTES_MENSAJE);
    }
    expect(partes.join(" ").split(/\s+/)).toEqual(texto.split(/\s+/));
  });

  it("cuenta bytes y no caracteres (un emoji pesa 4 bytes)", () => {
    const texto = "🚗".repeat(300); // 1200 bytes

    const partes = partirTexto(texto);

    expect(partes).toHaveLength(2);
    for (const parte of partes) {
      expect(bytes(parte)).toBeLessThanOrEqual(MAX_BYTES_MENSAJE);
    }
    expect(partes.join("")).toBe(texto);
  });

  it("corta por caracteres una palabra mas larga que el limite", () => {
    const partes = partirTexto("a".repeat(2500));

    expect(partes.map((p) => p.length)).toEqual([1000, 1000, 500]);
  });

  it("conserva los saltos de linea dentro de una parte", () => {
    expect(partirTexto("Linea 1\nLinea 2")).toEqual(["Linea 1\nLinea 2"]);
  });
});

describe("enviarMensajeInstagram", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hace POST a la Graph API con el token en el header", async () => {
    await enviarMensajeInstagram("1234567890", "Hola!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/me/messages");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
    expect(JSON.parse(init.body)).toEqual({
      recipient: { id: "1234567890" },
      message: { text: "Hola!" },
    });
  });

  it("manda un request por cada parte, en orden", async () => {
    const texto = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" ");

    await enviarMensajeInstagram("1", texto);

    const enviados = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).message.text);
    expect(enviados.length).toBeGreaterThan(1);
    expect(enviados.join(" ").split(/\s+/)).toEqual(texto.split(/\s+/));
  });

  it("lanza si la Graph API responde con error", async () => {
    fetchMock.mockImplementation(
      async () => new Response('{"error":{"message":"token vencido"}}', { status: 400 }),
    );

    await expect(enviarMensajeInstagram("1", "Hola")).rejects.toThrow(/Graph API 400/);
  });

  it("lanza si falta PAGE_ACCESS_TOKEN y no llama a la red", async () => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "");

    await expect(enviarMensajeInstagram("1", "Hola")).rejects.toThrow(/PAGE_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no manda nada si el texto esta vacio", async () => {
    await enviarMensajeInstagram("1", "   ");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/instagram/graph.test.ts`
Expected: FAIL — "Failed to resolve import ./graph".

- [ ] **Step 3: Implementar**

Create `src/lib/instagram/graph.ts`:

```ts
const GRAPH_URL = "https://graph.facebook.com/v21.0/me/messages";
const TIMEOUT_MS = 8000;

/** Instagram rechaza textos de mas de 1000 bytes (no caracteres). */
export const MAX_BYTES_MENSAJE = 1000;

const codificador = new TextEncoder();
const bytes = (texto: string) => codificador.encode(texto).length;

/**
 * Divide un texto en partes de hasta `maxBytes` bytes UTF-8, cortando en los
 * espacios o saltos de linea. Una palabra mas larga que el limite se corta por
 * caracteres como ultimo recurso.
 */
export function partirTexto(texto: string, maxBytes = MAX_BYTES_MENSAJE): string[] {
  const partes: string[] = [];
  let actual = "";

  const cerrar = () => {
    const parte = actual.trim();
    if (parte !== "") partes.push(parte);
    actual = "";
  };

  // El split con grupo de captura conserva los espacios y saltos de linea como tokens.
  for (const token of texto.split(/(\s+)/)) {
    if (token === "") continue;

    if (bytes(actual + token) <= maxBytes) {
      actual += token;
      continue;
    }

    cerrar();
    if (token.trim() === "") continue; // el espacio sobrante entre partes se descarta
    if (bytes(token) <= maxBytes) {
      actual = token;
      continue;
    }

    for (const caracter of token) {
      if (bytes(actual + caracter) > maxBytes) cerrar();
      actual += caracter;
    }
  }

  cerrar();
  return partes;
}

/** Envia un mensaje de texto al usuario de Instagram. Lanza si la Graph API falla. */
export async function enviarMensajeInstagram(destinatarioId: string, texto: string): Promise<void> {
  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("Falta la variable de entorno PAGE_ACCESS_TOKEN");

  // En orden y de a uno: si se mandaran en paralelo podrian llegar desordenados.
  for (const parte of partirTexto(texto)) {
    const respuesta = await fetch(GRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipient: { id: destinatarioId }, message: { text: parte } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(`Graph API ${respuesta.status}: ${detalle.slice(0, 300)}`);
    }
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/instagram/graph.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/instagram/graph.ts src/lib/instagram/graph.test.ts
git commit -m "feat: enviar mensajes de Instagram por la Graph API" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Stock disponible para el prompt

**Files:**
- Create: `src/lib/bot/stock.ts`
- Test: `src/lib/bot/stock.test.ts`

**Interfaces:**
- Produces: `type VehiculoStock`, `STOCK_NO_DISPONIBLE: string`, `formatearStock(vehiculos: VehiculoStock[], siteUrl: string): string`, `obtenerStockTexto(db: SupabaseClient, siteUrl: string): Promise<string>` (**nunca lanza**: ante un error devuelve `STOCK_NO_DISPONIBLE`).

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/bot/stock.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatearStock,
  obtenerStockTexto,
  STOCK_NO_DISPONIBLE,
  type VehiculoStock,
} from "./stock";

const corolla: VehiculoStock = {
  slug: "toyota-corolla-xei-2011",
  nombre: "Toyota Corolla XEI",
  anio: 2011,
  kilometraje: "180.000 km",
  combustible: "Nafta",
  transmision: "Manual",
  motor: "1.8",
  tipo: "Sedán",
  precio_texto: "USD 9.500",
};

describe("formatearStock", () => {
  it("arma una linea por vehiculo con los datos en orden fijo y el link a la ficha", () => {
    expect(formatearStock([corolla], "https://posse.example")).toBe(
      "- Toyota Corolla XEI | 2011 | 180.000 km | Nafta | Manual | 1.8 | Sedán | USD 9.500 | https://posse.example/vehiculos/toyota-corolla-xei-2011",
    );
  });

  it("reemplaza motor y tipo nulos por un guion para no correr las columnas", () => {
    const linea = formatearStock([{ ...corolla, motor: null, tipo: null }], "https://posse.example");

    expect(linea).toContain("| Manual | - | - | USD 9.500 |");
  });

  it("no duplica la barra final de la URL del sitio", () => {
    expect(formatearStock([corolla], "https://posse.example/")).toContain(
      "https://posse.example/vehiculos/toyota-corolla-xei-2011",
    );
  });

  it("omite el link si no hay URL del sitio configurada", () => {
    expect(formatearStock([corolla], "")).toBe(
      "- Toyota Corolla XEI | 2011 | 180.000 km | Nafta | Manual | 1.8 | Sedán | USD 9.500",
    );
  });

  it("separa varios vehiculos con saltos de linea", () => {
    const lineas = formatearStock([corolla, { ...corolla, slug: "otro", nombre: "Otro" }], "").split("\n");

    expect(lineas).toHaveLength(2);
  });

  it("avisa cuando no hay vehiculos disponibles", () => {
    expect(formatearStock([], "https://posse.example")).toBe(
      "No hay vehículos disponibles en este momento.",
    );
  });
});

describe("obtenerStockTexto", () => {
  afterEach(() => vi.restoreAllMocks());

  it("consulta solo vehiculos_posse disponibles y no borrados", async () => {
    const filtros: Array<[string, unknown]> = [];
    let tabla = "";
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: (columna, valor) => {
        filtros.push([columna as string, valor]);
        return consulta;
      },
      is: (columna, valor) => {
        filtros.push([columna as string, valor]);
        return consulta;
      },
      order: () => consulta,
      limit: async () => ({ data: [corolla], error: null }),
    };
    const db = {
      from: (nombre: string) => {
        tabla = nombre;
        return consulta;
      },
    } as unknown as SupabaseClient;

    const texto = await obtenerStockTexto(db, "");

    expect(tabla).toBe("vehiculos_posse");
    expect(filtros).toContainEqual(["estado", "disponible"]);
    expect(filtros).toContainEqual(["deleted_at", null]);
    expect(texto).toContain("Toyota Corolla XEI");
  });

  it("devuelve STOCK_NO_DISPONIBLE si Supabase responde con error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: () => consulta,
      is: () => consulta,
      order: () => consulta,
      limit: async () => ({ data: null, error: { message: "boom" } }),
    };
    const db = { from: () => consulta } as unknown as SupabaseClient;

    expect(await obtenerStockTexto(db, "")).toBe(STOCK_NO_DISPONIBLE);
  });

  it("devuelve STOCK_NO_DISPONIBLE si la consulta lanza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = {
      from: () => {
        throw new Error("sin conexion");
      },
    } as unknown as SupabaseClient;

    expect(await obtenerStockTexto(db, "")).toBe(STOCK_NO_DISPONIBLE);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/bot/stock.test.ts`
Expected: FAIL — "Failed to resolve import ./stock".

- [ ] **Step 3: Implementar**

Create `src/lib/bot/stock.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type VehiculoStock = {
  slug: string;
  nombre: string;
  anio: number;
  kilometraje: string;
  combustible: string;
  transmision: string;
  motor: string | null;
  tipo: string | null;
  precio_texto: string;
};

/** Texto que reemplaza al inventario cuando no se pudo consultar: el bot no debe inventar autos. */
export const STOCK_NO_DISPONIBLE =
  "NO SE PUDO CONSULTAR EL INVENTARIO. No menciones ni confirmes vehículos concretos: decí que en este momento no podés confirmar la disponibilidad y ofrecé el WhatsApp del local.";

// Tope para que el prompt no crezca sin control: cada vehiculo ocupa ~50 tokens.
const LIMITE_STOCK = 40;

const COLUMNAS = "slug, nombre, anio, kilometraje, combustible, transmision, motor, tipo, precio_texto";

/**
 * Una linea por vehiculo con las columnas siempre en el mismo orden (los nulos van
 * como "-"), asi el modelo no confunde un motor con un tipo. Es mucho mas barato en
 * tokens que mandar JSON.
 */
export function formatearStock(vehiculos: VehiculoStock[], siteUrl: string): string {
  if (vehiculos.length === 0) return "No hay vehículos disponibles en este momento.";

  const base = siteUrl.replace(/\/+$/, "");

  return vehiculos
    .map((v) => {
      const datos = [
        v.nombre,
        String(v.anio),
        v.kilometraje,
        v.combustible,
        v.transmision,
        v.motor ?? "-",
        v.tipo ?? "-",
        v.precio_texto,
      ];
      if (base) datos.push(`${base}/vehiculos/${v.slug}`);
      return `- ${datos.join(" | ")}`;
    })
    .join("\n");
}

/**
 * Lee los vehiculos disponibles y los deja listos para el prompt.
 * No usa getVehiculosDisponibles() de data.ts a proposito: aquel cae a datos de
 * muestra locales ante un error, y el bot terminaria ofreciendo autos que no existen.
 */
export async function obtenerStockTexto(db: SupabaseClient, siteUrl: string): Promise<string> {
  try {
    const { data, error } = await db
      .from("vehiculos_posse")
      .select(COLUMNAS)
      .eq("estado", "disponible")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIMITE_STOCK);

    if (error) throw new Error(error.message);
    return formatearStock((data ?? []) as VehiculoStock[], siteUrl);
  } catch (err) {
    console.error("[bot] No se pudo leer el stock:", err);
    return STOCK_NO_DISPONIBLE;
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/bot/stock.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/stock.ts src/lib/bot/stock.test.ts
git commit -m "feat: stock disponible compacto para el prompt del bot" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Prompt de ventas y llamada a Claude

**Files:**
- Create: `src/lib/bot/types.ts`
- Create: `src/lib/bot/prompt.ts`
- Create: `src/lib/bot/ai.ts`
- Test: `src/lib/bot/prompt.test.ts`
- Test: `src/lib/bot/ai.test.ts`

**Interfaces:**
- Produces (`types.ts`): `TurnoHistorial = { role: "user" | "assistant"; content: string }`, `LeadInput = { nombre: string; telefono: string; vehiculo_interes?: string; mensaje?: string }`, `RespuestaIA = { texto: string; lead: LeadInput | null }`.
- Produces (`prompt.ts`): `EMPRESA = { nombre, ciudad, whatsapp }`, `buildSystemBlocks(stockTexto: string): BloqueSistema[]`.
- Produces (`ai.ts`): `TOOL_GUARDAR_LEAD`, `CONFIRMACION_LEAD`, `RESPUESTA_VACIA`, `extraerRespuesta(content): RespuestaIA`, `responderIA({ stockTexto, historial }): Promise<RespuestaIA>`.

- [ ] **Step 1: Crear los tipos compartidos**

Create `src/lib/bot/types.ts`:

```ts
export type TurnoHistorial = {
  role: "user" | "assistant";
  content: string;
};

export type LeadInput = {
  nombre: string;
  telefono: string;
  vehiculo_interes?: string;
  mensaje?: string;
};

export type RespuestaIA = {
  texto: string;
  lead: LeadInput | null;
};
```

- [ ] **Step 2: Escribir los tests del prompt (fallan)**

Create `src/lib/bot/prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSystemBlocks, EMPRESA } from "./prompt";

describe("buildSystemBlocks", () => {
  const stock = "- Toyota Corolla XEI | 2011 | 180.000 km | Nafta | Manual | 1.8 | Sedán | USD 9.500";

  it("devuelve instrucciones + inventario, y marca el cache solo en el ultimo bloque", () => {
    const [instrucciones, inventario] = buildSystemBlocks(stock);

    expect(buildSystemBlocks(stock)).toHaveLength(2);
    expect(instrucciones.cache_control).toBeUndefined();
    // El cache de Anthropic cubre todo el prefijo hasta el bloque marcado.
    expect(inventario.cache_control).toEqual({ type: "ephemeral" });
  });

  it("incluye el stock tal cual en el bloque de inventario", () => {
    const [, inventario] = buildSystemBlocks(stock);

    expect(inventario.text).toContain(stock);
  });

  it("las instrucciones nombran la empresa, el WhatsApp para derivar y la herramienta de leads", () => {
    const [instrucciones] = buildSystemBlocks(stock);

    expect(instrucciones.text).toContain(EMPRESA.nombre);
    expect(instrucciones.text).toContain(EMPRESA.whatsapp);
    expect(instrucciones.text).toContain("guardar_lead");
  });

  it("le prohibe al modelo ofrecer autos fuera de la lista", () => {
    const [instrucciones] = buildSystemBlocks(stock);

    expect(instrucciones.text).toContain("INVENTARIO DISPONIBLE");
    expect(instrucciones.text).toMatch(/Nunca inventes/);
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/bot/prompt.test.ts`
Expected: FAIL — "Failed to resolve import ./prompt".

- [ ] **Step 4: Implementar el prompt**

Create `src/lib/bot/prompt.ts`:

```ts
export const EMPRESA = {
  nombre: "Posse Automotores",
  ciudad: "Justiniano Posse, Córdoba",
  whatsapp: "+54 9 3537 55-8947",
} as const;

export type BloqueSistema = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

function instrucciones(): string {
  const horario = process.env.BOT_HORARIO?.trim() || `consultá los horarios por WhatsApp al ${EMPRESA.whatsapp}`;

  return `Sos el asistente de ventas de ${EMPRESA.nombre}, una concesionaria de autos y motos en ${EMPRESA.ciudad}. Atendés los mensajes directos de Instagram.

Tu objetivo es ayudar al cliente a encontrar un vehículo y llevarlo hacia la venta: que visite el local, que lo vea y lo pruebe, o que deje sus datos para que lo contacte un vendedor.

Cómo comunicarte:
- Español rioplatense (vos, querés, podés). Cercano, entusiasta y profesional.
- Mensajes cortos, pensados para Instagram: 4 o 5 líneas como máximo, una idea por mensaje.
- Podés usar algún emoji, sin exagerar. No uses markdown (nada de *negritas*, # ni listas con guiones largos): Instagram no lo muestra.
- Casi siempre cerrá con una pregunta que avance la venta: presupuesto, uso que le va a dar, si tiene un usado para dar en parte de pago, si quiere verlo.

Reglas sobre los vehículos:
- Solo ofrecés vehículos de la lista INVENTARIO DISPONIBLE. Esa lista es la única fuente de verdad.
- Nunca inventes precios, años, kilómetros ni características. Si un dato figura como "Consultá" o "-", decí que lo confirma un vendedor.
- Si preguntan por un vehículo que no está en la lista, decí que por ahora no está disponible y ofrecé alternativas parecidas de la lista.
- Cuando nombres un vehículo, incluí su link para que vea las fotos y los detalles.
- Si hay muchos que encajan, mostrá 2 o 3 como máximo.

Información del local:
- Ubicación: ${EMPRESA.ciudad}. Horarios: ${horario}.
- Formas de pago: efectivo, transferencia bancaria, financiación bancaria y propia.
- Tomamos tu usado como parte de pago: se tasa en el local.
- Todos los vehículos tienen garantía legal y verificación previa.
- Para financiar piden DNI y comprobante de ingresos. Las condiciones exactas las da un vendedor.

Captación de datos:
- Cuando el cliente muestre interés real (quiere verlo, pregunta por financiación, precio final o permuta), pedile su nombre y un teléfono de contacto.
- Cuando te los dé, usá la herramienta guardar_lead UNA sola vez y confirmale que un vendedor lo va a contactar.
- Si pide hablar con una persona, pasale el WhatsApp del local: ${EMPRESA.whatsapp}.

Fuera de tema:
Si preguntan algo ajeno a vehículos, financiación o la concesionaria, respondé con amabilidad que solo podés ayudar con eso y volvé a la conversación sobre autos.`;
}

/**
 * Prompt dividido en dos bloques: las instrucciones (fijas) y el inventario (cambia
 * cuando se vende o se carga un auto). cache_control va en el ultimo bloque para que
 * Anthropic reutilice todo el prefijo entre mensajes. El cache solo se activa si el
 * prefijo supera el minimo del modelo; si es mas corto simplemente no se aplica.
 */
export function buildSystemBlocks(stockTexto: string): BloqueSistema[] {
  return [
    { type: "text", text: instrucciones() },
    {
      type: "text",
      text: `INVENTARIO DISPONIBLE (formato: nombre | año | km | combustible | transmisión | motor | tipo | precio | link)\n${stockTexto}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}
```

- [ ] **Step 5: Correr los tests del prompt y verificar que pasan**

Run: `npx vitest run src/lib/bot/prompt.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Escribir los tests de `extraerRespuesta` (fallan)**

Create `src/lib/bot/ai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CONFIRMACION_LEAD, extraerRespuesta, RESPUESTA_VACIA } from "./ai";

const leadValido = {
  nombre: "Juan Pérez",
  telefono: "3537 123456",
  vehiculo_interes: "Corolla 2011",
  mensaje: "Quiere verlo el sábado",
};

describe("extraerRespuesta", () => {
  it("devuelve el texto cuando solo hay bloques de texto", () => {
    const respuesta = extraerRespuesta([
      { type: "text", text: "¡Hola! " },
      { type: "text", text: "¿Qué tipo de auto buscás?" },
    ]);

    expect(respuesta).toEqual({ texto: "¡Hola!\n¿Qué tipo de auto buscás?", lead: null });
  });

  it("devuelve el lead y el texto cuando el modelo llama a guardar_lead", () => {
    const respuesta = extraerRespuesta([
      { type: "text", text: "¡Genial, Juan! Un vendedor te contacta." },
      { type: "tool_use", name: "guardar_lead", input: leadValido },
    ]);

    expect(respuesta.texto).toBe("¡Genial, Juan! Un vendedor te contacta.");
    expect(respuesta.lead).toEqual(leadValido);
  });

  it("usa una confirmacion fija si el modelo llamo a la herramienta sin escribir texto", () => {
    const respuesta = extraerRespuesta([
      { type: "tool_use", name: "guardar_lead", input: leadValido },
    ]);

    expect(respuesta.texto).toBe(CONFIRMACION_LEAD);
    expect(respuesta.lead).not.toBeNull();
  });

  it("ignora un lead sin nombre o sin telefono", () => {
    const sinTelefono = extraerRespuesta([
      { type: "text", text: "Dale." },
      { type: "tool_use", name: "guardar_lead", input: { nombre: "Juan" } },
    ]);
    const sinNombre = extraerRespuesta([
      { type: "text", text: "Dale." },
      { type: "tool_use", name: "guardar_lead", input: { nombre: "  ", telefono: "123" } },
    ]);

    expect(sinTelefono.lead).toBeNull();
    expect(sinNombre.lead).toBeNull();
  });

  it("ignora herramientas desconocidas y entradas que no son objetos", () => {
    const respuesta = extraerRespuesta([
      { type: "text", text: "Hola" },
      { type: "tool_use", name: "otra_cosa", input: leadValido },
      { type: "tool_use", name: "guardar_lead", input: "no soy un objeto" },
    ]);

    expect(respuesta.lead).toBeNull();
  });

  it("recorta los espacios de los datos del lead", () => {
    const respuesta = extraerRespuesta([
      { type: "tool_use", name: "guardar_lead", input: { nombre: " Ana ", telefono: " 351 555 " } },
    ]);

    expect(respuesta.lead).toEqual({ nombre: "Ana", telefono: "351 555" });
  });

  it("devuelve una respuesta de disculpa si no hay texto ni lead", () => {
    expect(extraerRespuesta([])).toEqual({ texto: RESPUESTA_VACIA, lead: null });
  });
});
```

- [ ] **Step 7: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/bot/ai.test.ts`
Expected: FAIL — "Failed to resolve import ./ai".

- [ ] **Step 8: Implementar `ai.ts`**

Create `src/lib/bot/ai.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemBlocks } from "./prompt";
import type { LeadInput, RespuestaIA, TurnoHistorial } from "./types";

const MODELO = "claude-haiku-4-5-20251001";
// Los DMs son cortos; limitar la salida tambien ahorra tokens.
const MAX_TOKENS = 500;

export const CONFIRMACION_LEAD =
  "¡Genial! Ya pasé tus datos, un vendedor te va a contactar a la brevedad 🙌";
export const RESPUESTA_VACIA = "Perdón, tuve un problema para responderte. ¿Me repetís la consulta?";

export const TOOL_GUARDAR_LEAD: Anthropic.Messages.Tool = {
  name: "guardar_lead",
  description:
    "Guarda los datos de contacto de un cliente interesado para que un vendedor lo contacte. Usala UNA sola vez, cuando el cliente ya te dio su nombre y un teléfono y mostró interés real en comprar.",
  input_schema: {
    type: "object",
    properties: {
      nombre: { type: "string", description: "Nombre del cliente" },
      telefono: { type: "string", description: "Teléfono de contacto del cliente" },
      vehiculo_interes: { type: "string", description: "Vehículo o tipo de vehículo que le interesa" },
      mensaje: { type: "string", description: "Resumen breve de lo que busca (máx. 200 caracteres)" },
    },
    required: ["nombre", "telefono"],
  },
};

type BloqueModelo = { type: string; text?: string; name?: string; input?: unknown };

function validarLead(input: unknown): LeadInput | null {
  if (typeof input !== "object" || input === null) return null;

  const { nombre, telefono, vehiculo_interes, mensaje } = input as Record<string, unknown>;
  if (typeof nombre !== "string" || nombre.trim() === "") return null;
  if (typeof telefono !== "string" || telefono.trim() === "") return null;

  return {
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    vehiculo_interes: typeof vehiculo_interes === "string" ? vehiculo_interes.trim() : undefined,
    mensaje: typeof mensaje === "string" ? mensaje.trim() : undefined,
  };
}

/**
 * Convierte la respuesta del modelo en texto para el cliente y, si corresponde, un lead.
 * Como el lead se guarda sin volver a llamar a Claude, el texto de confirmacion tiene
 * que venir en esta misma respuesta; si el modelo no lo escribio, usamos uno fijo.
 */
export function extraerRespuesta(content: BloqueModelo[]): RespuestaIA {
  const texto = content
    .filter((bloque) => bloque.type === "text" && typeof bloque.text === "string")
    .map((bloque) => (bloque.text as string).trim())
    .filter((fragmento) => fragmento !== "")
    .join("\n");

  const llamada = content.find((b) => b.type === "tool_use" && b.name === "guardar_lead");
  const lead = llamada ? validarLead(llamada.input) : null;

  return { texto: texto || (lead ? CONFIRMACION_LEAD : RESPUESTA_VACIA), lead };
}

let cliente: Anthropic | null = null;

// Se crea recien al primer uso para que importar el modulo no exija la API key.
function getCliente(): Anthropic {
  cliente ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // En serverless no podemos esperar los 10 minutos por defecto del SDK.
    timeout: 15_000,
    maxRetries: 1,
  });
  return cliente;
}

export async function responderIA(entrada: {
  stockTexto: string;
  historial: TurnoHistorial[];
}): Promise<RespuestaIA> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Falta la variable de entorno ANTHROPIC_API_KEY");
  }

  const respuesta = await getCliente().messages.create({
    model: MODELO,
    max_tokens: MAX_TOKENS,
    system: buildSystemBlocks(entrada.stockTexto),
    tools: [TOOL_GUARDAR_LEAD],
    messages: entrada.historial,
  });

  return extraerRespuesta(respuesta.content);
}
```

- [ ] **Step 9: Correr los tests y verificar el tipado**

Run: `npx vitest run src/lib/bot/ai.test.ts src/lib/bot/prompt.test.ts`
Expected: PASS — 11 tests.

Run: `npx tsc --noEmit`
Expected: sin errores. Si TypeScript se queja de la compatibilidad de `respuesta.content` con `BloqueModelo[]` o de `system`, ajustar el tipo en `ai.ts` (no el test) hasta que compile.

- [ ] **Step 10: Commit**

```bash
git add src/lib/bot/types.ts src/lib/bot/prompt.ts src/lib/bot/prompt.test.ts src/lib/bot/ai.ts src/lib/bot/ai.test.ts
git commit -m "feat: prompt de ventas y llamada unica a Claude con captura de leads" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Historial, deduplicación y leads en Supabase

**Files:**
- Create: `src/lib/bot/conversations.ts`
- Create: `src/lib/bot/leads.ts`
- Test: `src/lib/bot/conversations.test.ts`
- Test: `src/lib/bot/leads.test.ts`

**Interfaces:**
- Consumes: `TurnoHistorial`, `LeadInput` de `./types`.
- Produces (`conversations.ts`): `normalizarHistorial(filas: TurnoHistorial[]): TurnoHistorial[]`, `reclamarMensaje(db, igUserId, mid, contenido): Promise<boolean>` (`true` = mensaje nuevo, `false` = duplicado), `obtenerHistorial(db, igUserId): Promise<TurnoHistorial[]>`, `guardarRespuesta(db, igUserId, texto): Promise<void>`.
- Produces (`leads.ts`): `guardarLeadInstagram(db, igUserId, lead: LeadInput): Promise<void>`.
- Todas reciben `db: SupabaseClient` como primer parámetro; ninguna importa `next/*`.

- [ ] **Step 1: Escribir los tests de conversaciones (fallan)**

Create `src/lib/bot/conversations.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  guardarRespuesta,
  normalizarHistorial,
  obtenerHistorial,
  reclamarMensaje,
} from "./conversations";
import type { TurnoHistorial } from "./types";

describe("normalizarHistorial", () => {
  it("descarta los turnos del asistente que quedaron al principio", () => {
    const filas: TurnoHistorial[] = [
      { role: "assistant", content: "respuesta vieja" },
      { role: "user", content: "hola" },
    ];

    expect(normalizarHistorial(filas)).toEqual([{ role: "user", content: "hola" }]);
  });

  it("une los turnos consecutivos del mismo rol", () => {
    const filas: TurnoHistorial[] = [
      { role: "user", content: "hola" },
      { role: "user", content: "tienen autos?" },
      { role: "assistant", content: "si!" },
    ];

    expect(normalizarHistorial(filas)).toEqual([
      { role: "user", content: "hola\ntienen autos?" },
      { role: "assistant", content: "si!" },
    ]);
  });

  it("no muta la lista de entrada", () => {
    const filas: TurnoHistorial[] = [
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ];

    normalizarHistorial(filas);

    expect(filas).toEqual([
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ]);
  });

  it("devuelve lista vacia si no hay turnos del usuario", () => {
    expect(normalizarHistorial([])).toEqual([]);
    expect(normalizarHistorial([{ role: "assistant", content: "x" }])).toEqual([]);
  });
});

describe("reclamarMensaje", () => {
  const dbConInsert = (resultado: { error: { code?: string; message: string } | null }) => {
    const insertados: unknown[] = [];
    const db = {
      from: () => ({
        insert: async (fila: unknown) => {
          insertados.push(fila);
          return resultado;
        },
      }),
    } as unknown as SupabaseClient;
    return { db, insertados };
  };

  it("devuelve true y guarda el mensaje del usuario cuando es nuevo", async () => {
    const { db, insertados } = dbConInsert({ error: null });

    expect(await reclamarMensaje(db, "123", "mid.abc", "Hola")).toBe(true);
    expect(insertados).toEqual([
      { mid: "mid.abc", ig_user_id: "123", role: "user", content: "Hola" },
    ]);
  });

  it("devuelve false cuando el mid ya existe (reintento de Meta)", async () => {
    const { db } = dbConInsert({ error: { code: "23505", message: "duplicate key" } });

    expect(await reclamarMensaje(db, "123", "mid.abc", "Hola")).toBe(false);
  });

  it("lanza ante cualquier otro error de la base", async () => {
    const { db } = dbConInsert({ error: { code: "XX000", message: "caido" } });

    await expect(reclamarMensaje(db, "123", "mid.abc", "Hola")).rejects.toThrow(/caido/);
  });
});

describe("obtenerHistorial", () => {
  it("devuelve los turnos en orden cronologico aunque la base los traiga del mas nuevo al mas viejo", async () => {
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: () => consulta,
      order: () => consulta,
      limit: async () => ({
        data: [
          { role: "user", content: "tercero" },
          { role: "assistant", content: "segundo" },
          { role: "user", content: "primero" },
        ],
        error: null,
      }),
    };
    const db = { from: () => consulta } as unknown as SupabaseClient;

    expect(await obtenerHistorial(db, "123")).toEqual([
      { role: "user", content: "primero" },
      { role: "assistant", content: "segundo" },
      { role: "user", content: "tercero" },
    ]);
  });

  it("lanza si la consulta falla", async () => {
    const consulta: Record<string, (...args: unknown[]) => unknown> = {
      select: () => consulta,
      eq: () => consulta,
      order: () => consulta,
      limit: async () => ({ data: null, error: { message: "caido" } }),
    };
    const db = { from: () => consulta } as unknown as SupabaseClient;

    await expect(obtenerHistorial(db, "123")).rejects.toThrow(/caido/);
  });
});

describe("guardarRespuesta", () => {
  it("guarda la respuesta del bot como turno del asistente, sin mid", async () => {
    const insertados: unknown[] = [];
    const db = {
      from: () => ({
        insert: async (fila: unknown) => {
          insertados.push(fila);
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    await guardarRespuesta(db, "123", "¡Hola!");

    expect(insertados).toEqual([{ ig_user_id: "123", role: "assistant", content: "¡Hola!" }]);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/bot/conversations.test.ts`
Expected: FAIL — "Failed to resolve import ./conversations".

- [ ] **Step 3: Implementar `conversations.ts`**

Create `src/lib/bot/conversations.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurnoHistorial } from "./types";

// Suficiente contexto para una charla de ventas sin pagar tokens de mas.
const LIMITE_HISTORIAL = 10;
// Codigo de Postgres para "unique_violation".
const VIOLACION_UNICA = "23505";

/**
 * Deja el historial en la forma que exige la API de Claude: empieza con un turno
 * del usuario y no repite rol seguido. Al cortar los ultimos N mensajes puede
 * quedar una respuesta del bot al principio, o dos mensajes del cliente juntos.
 */
export function normalizarHistorial(filas: TurnoHistorial[]): TurnoHistorial[] {
  const resultado: TurnoHistorial[] = [];

  for (const fila of filas) {
    if (resultado.length === 0 && fila.role !== "user") continue;

    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.role === fila.role) {
      ultimo.content += `\n${fila.content}`;
    } else {
      resultado.push({ role: fila.role, content: fila.content });
    }
  }

  return resultado;
}

/**
 * Registra el mensaje del cliente. Devuelve false si ya estaba (Meta reintenta los
 * webhooks que tardan en responder): asi nunca se contesta dos veces lo mismo.
 * El insert con unique sobre "mid" hace de candado atomico entre invocaciones.
 */
export async function reclamarMensaje(
  db: SupabaseClient,
  igUserId: string,
  mid: string,
  contenido: string,
): Promise<boolean> {
  const { error } = await db
    .from("ig_mensajes")
    .insert({ mid, ig_user_id: igUserId, role: "user", content: contenido });

  if (!error) return true;
  if (error.code === VIOLACION_UNICA) return false;
  throw new Error(`No se pudo registrar el mensaje: ${error.message}`);
}

export async function obtenerHistorial(db: SupabaseClient, igUserId: string): Promise<TurnoHistorial[]> {
  const { data, error } = await db
    .from("ig_mensajes")
    .select("role, content")
    .eq("ig_user_id", igUserId)
    .order("created_at", { ascending: false })
    .limit(LIMITE_HISTORIAL);

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);

  // Se pide del mas nuevo al mas viejo para quedarse con los ultimos N; se da vuelta para la IA.
  return normalizarHistorial([...((data ?? []) as TurnoHistorial[])].reverse());
}

export async function guardarRespuesta(db: SupabaseClient, igUserId: string, texto: string): Promise<void> {
  const { error } = await db
    .from("ig_mensajes")
    .insert({ ig_user_id: igUserId, role: "assistant", content: texto });

  if (error) throw new Error(`No se pudo guardar la respuesta: ${error.message}`);
}
```

- [ ] **Step 4: Correr los tests de conversaciones y verificar que pasan**

Run: `npx vitest run src/lib/bot/conversations.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Escribir los tests de leads (fallan)**

Create `src/lib/bot/leads.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { guardarLeadInstagram } from "./leads";

function dbFalso(opciones: {
  existentes?: unknown[];
  errorBusqueda?: { message: string };
  errorInsert?: { message: string };
}) {
  const insertados: unknown[] = [];
  const busqueda: Record<string, (...args: unknown[]) => unknown> = {
    select: () => busqueda,
    eq: () => busqueda,
    limit: async () => ({ data: opciones.existentes ?? [], error: opciones.errorBusqueda ?? null }),
  };
  const db = {
    from: () => ({
      ...busqueda,
      insert: async (fila: unknown) => {
        insertados.push(fila);
        return { error: opciones.errorInsert ?? null };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, insertados };
}

describe("guardarLeadInstagram", () => {
  const lead = {
    nombre: "Juan Pérez",
    telefono: "3537 123456",
    vehiculo_interes: "Corolla 2011",
    mensaje: "Quiere verlo el sábado",
  };

  it("inserta el lead con origen instagram y el id del usuario", async () => {
    const { db, insertados } = dbFalso({});

    await guardarLeadInstagram(db, "1234567890", lead);

    expect(insertados).toEqual([
      {
        nombre: "Juan Pérez",
        telefono: "3537 123456",
        vehiculo_interes: "Corolla 2011",
        mensaje: "Quiere verlo el sábado",
        origen: "instagram",
        instagram_id: "1234567890",
      },
    ]);
  });

  it("guarda null en los campos opcionales que no vinieron", async () => {
    const { db, insertados } = dbFalso({});

    await guardarLeadInstagram(db, "1", { nombre: "Ana", telefono: "351 555" });

    expect(insertados[0]).toMatchObject({ vehiculo_interes: null, mensaje: null });
  });

  it("no duplica un lead que ya existe con el mismo usuario y telefono", async () => {
    const { db, insertados } = dbFalso({ existentes: [{ id: "abc" }] });

    await guardarLeadInstagram(db, "1234567890", lead);

    expect(insertados).toEqual([]);
  });

  it("lanza si falla la busqueda o el insert", async () => {
    await expect(
      guardarLeadInstagram(dbFalso({ errorBusqueda: { message: "caido" } }).db, "1", lead),
    ).rejects.toThrow(/caido/);
    await expect(
      guardarLeadInstagram(dbFalso({ errorInsert: { message: "rechazado" } }).db, "1", lead),
    ).rejects.toThrow(/rechazado/);
  });
});
```

- [ ] **Step 6: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/bot/leads.test.ts`
Expected: FAIL — "Failed to resolve import ./leads".

- [ ] **Step 7: Implementar `leads.ts`**

Create `src/lib/bot/leads.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadInput } from "./types";

/**
 * Guarda el lead en la tabla que ya lee /admin/leads.
 * Como el modelo no ve sus llamadas a herramientas en el historial, puede volver a
 * llamar a guardar_lead en un mensaje posterior: si el mismo usuario ya dejo ese
 * telefono, no se duplica.
 */
export async function guardarLeadInstagram(
  db: SupabaseClient,
  igUserId: string,
  lead: LeadInput,
): Promise<void> {
  const { data: existentes, error: errorBusqueda } = await db
    .from("leads")
    .select("id")
    .eq("instagram_id", igUserId)
    .eq("telefono", lead.telefono)
    .limit(1);

  if (errorBusqueda) throw new Error(`No se pudo buscar el lead: ${errorBusqueda.message}`);
  if (existentes && existentes.length > 0) return;

  const { error } = await db.from("leads").insert({
    nombre: lead.nombre,
    telefono: lead.telefono,
    vehiculo_interes: lead.vehiculo_interes ?? null,
    mensaje: lead.mensaje ?? null,
    origen: "instagram",
    instagram_id: igUserId,
  });

  if (error) throw new Error(`No se pudo guardar el lead: ${error.message}`);
}
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/bot/conversations.test.ts src/lib/bot/leads.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 9: Commit**

```bash
git add src/lib/bot/conversations.ts src/lib/bot/conversations.test.ts src/lib/bot/leads.ts src/lib/bot/leads.test.ts
git commit -m "feat: historial, deduplicacion por mid y guardado de leads de Instagram" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Orquestación del flujo (handler)

**Files:**
- Create: `src/lib/bot/handler.ts`
- Test: `src/lib/bot/handler.test.ts`

**Interfaces:**
- Consumes: `MensajeEntrante` (`../instagram/payload`), `EMPRESA` (`./prompt`), `TurnoHistorial`, `LeadInput`, `RespuestaIA` (`./types`).
- Produces: `MENSAJE_ADJUNTO`, `MENSAJE_ERROR_TECNICO`, `type DepsBot`, `procesarMensajes(mensajes: MensajeEntrante[], deps: DepsBot): Promise<void>` (**nunca lanza**).

```ts
export type DepsBot = {
  reclamarMensaje(senderId: string, mid: string, contenido: string): Promise<boolean>;
  obtenerHistorial(senderId: string): Promise<TurnoHistorial[]>;
  obtenerStockTexto(): Promise<string>;
  responderIA(entrada: { stockTexto: string; historial: TurnoHistorial[] }): Promise<RespuestaIA>;
  guardarLead(senderId: string, lead: LeadInput): Promise<void>;
  guardarRespuesta(senderId: string, texto: string): Promise<void>;
  enviar(senderId: string, texto: string): Promise<void>;
};
```

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/bot/handler.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MensajeEntrante } from "../instagram/payload";
import { type DepsBot, MENSAJE_ADJUNTO, MENSAJE_ERROR_TECNICO, procesarMensajes } from "./handler";

function crearDeps(sobrescribir: Partial<DepsBot> = {}): DepsBot {
  return {
    reclamarMensaje: vi.fn(async () => true),
    obtenerHistorial: vi.fn(async () => [{ role: "user" as const, content: "Hola" }]),
    obtenerStockTexto: vi.fn(async () => "- Corolla | 2011"),
    responderIA: vi.fn(async () => ({ texto: "¡Hola! ¿Qué buscás?", lead: null })),
    guardarLead: vi.fn(async () => {}),
    guardarRespuesta: vi.fn(async () => {}),
    enviar: vi.fn(async () => {}),
    ...sobrescribir,
  };
}

const mensaje: MensajeEntrante = { senderId: "111", mid: "mid.1", texto: "Hola" };

describe("procesarMensajes", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("flujo normal: reclama, consulta a la IA con historial y stock, envia y guarda la respuesta", async () => {
    const deps = crearDeps();

    await procesarMensajes([mensaje], deps);

    expect(deps.reclamarMensaje).toHaveBeenCalledWith("111", "mid.1", "Hola");
    expect(deps.responderIA).toHaveBeenCalledWith({
      stockTexto: "- Corolla | 2011",
      historial: [{ role: "user", content: "Hola" }],
    });
    expect(deps.enviar).toHaveBeenCalledWith("111", "¡Hola! ¿Qué buscás?");
    expect(deps.guardarRespuesta).toHaveBeenCalledWith("111", "¡Hola! ¿Qué buscás?");
    expect(deps.guardarLead).not.toHaveBeenCalled();
  });

  it("ignora un mensaje duplicado (reintento de Meta)", async () => {
    const deps = crearDeps({ reclamarMensaje: vi.fn(async () => false) });

    await procesarMensajes([mensaje], deps);

    expect(deps.responderIA).not.toHaveBeenCalled();
    expect(deps.enviar).not.toHaveBeenCalled();
  });

  it("responde un adjunto con un texto fijo y sin llamar a la IA", async () => {
    const deps = crearDeps();

    await procesarMensajes([{ senderId: "111", mid: "mid.foto", texto: null }], deps);

    expect(deps.reclamarMensaje).toHaveBeenCalledWith("111", "mid.foto", "[El cliente envió un adjunto]");
    expect(deps.responderIA).not.toHaveBeenCalled();
    expect(deps.enviar).toHaveBeenCalledWith("111", MENSAJE_ADJUNTO);
    expect(deps.guardarRespuesta).toHaveBeenCalledWith("111", MENSAJE_ADJUNTO);
  });

  it("guarda el lead cuando la IA lo pide y igual envia la respuesta", async () => {
    const lead = { nombre: "Juan", telefono: "3537 123456" };
    const deps = crearDeps({
      responderIA: vi.fn(async () => ({ texto: "¡Listo, Juan!", lead })),
    });

    await procesarMensajes([mensaje], deps);

    expect(deps.guardarLead).toHaveBeenCalledWith("111", lead);
    expect(deps.enviar).toHaveBeenCalledWith("111", "¡Listo, Juan!");
  });

  it("si falla el guardado del lead, la respuesta al cliente sale igual", async () => {
    const deps = crearDeps({
      responderIA: vi.fn(async () => ({
        texto: "¡Listo!",
        lead: { nombre: "Juan", telefono: "123" },
      })),
      guardarLead: vi.fn(async () => {
        throw new Error("base caida");
      }),
    });

    await procesarMensajes([mensaje], deps);

    expect(deps.enviar).toHaveBeenCalledWith("111", "¡Listo!");
  });

  it("si falla la IA, le avisa al cliente del problema tecnico y no lanza", async () => {
    const deps = crearDeps({
      responderIA: vi.fn(async () => {
        throw new Error("Anthropic caido");
      }),
    });

    await expect(procesarMensajes([mensaje], deps)).resolves.toBeUndefined();

    expect(deps.enviar).toHaveBeenCalledWith("111", MENSAJE_ERROR_TECNICO);
  });

  it("un mensaje que falla no impide procesar el siguiente del lote", async () => {
    const responderIA = vi
      .fn<DepsBot["responderIA"]>()
      .mockRejectedValueOnce(new Error("fallo puntual"))
      .mockResolvedValueOnce({ texto: "Segunda respuesta", lead: null });
    const deps = crearDeps({ responderIA });

    await procesarMensajes(
      [mensaje, { senderId: "222", mid: "mid.2", texto: "Buenas" }],
      deps,
    );

    expect(deps.enviar).toHaveBeenCalledWith("111", MENSAJE_ERROR_TECNICO);
    expect(deps.enviar).toHaveBeenCalledWith("222", "Segunda respuesta");
  });

  it("no lanza aunque el envio falle siempre (token vencido, ventana de 24 h cerrada)", async () => {
    const deps = crearDeps({
      enviar: vi.fn(async () => {
        throw new Error("Graph API 400");
      }),
    });

    await expect(procesarMensajes([mensaje], deps)).resolves.toBeUndefined();
  });

  it("si falla guardar la respuesta ya enviada, no manda un segundo mensaje de error", async () => {
    const deps = crearDeps({
      guardarRespuesta: vi.fn(async () => {
        throw new Error("base caida");
      }),
    });

    await procesarMensajes([mensaje], deps);

    expect(deps.enviar).toHaveBeenCalledTimes(1);
  });

  it("procesa el lote en orden", async () => {
    const orden: string[] = [];
    const deps = crearDeps({
      enviar: vi.fn(async (senderId: string) => {
        orden.push(senderId);
      }),
    });

    await procesarMensajes(
      [
        { senderId: "A", mid: "mid.a", texto: "uno" },
        { senderId: "B", mid: "mid.b", texto: "dos" },
      ],
      deps,
    );

    expect(orden).toEqual(["A", "B"]);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/bot/handler.test.ts`
Expected: FAIL — "Failed to resolve import ./handler".

- [ ] **Step 3: Implementar**

Create `src/lib/bot/handler.ts`:

```ts
import type { MensajeEntrante } from "../instagram/payload";
import { EMPRESA } from "./prompt";
import type { LeadInput, RespuestaIA, TurnoHistorial } from "./types";

export const MENSAJE_ADJUNTO =
  "¡Gracias por escribirnos! 😊 Por ahora solo puedo leer mensajes de texto. Contame qué vehículo estás buscando y te ayudo.";
export const MENSAJE_ERROR_TECNICO = `😔 Tuve un problema técnico. Probá de nuevo en un momento o escribinos por WhatsApp al ${EMPRESA.whatsapp}.`;

// Queda en el historial para que se entienda el turno, pero no se le manda a la IA como consulta.
const CONTENIDO_ADJUNTO = "[El cliente envió un adjunto]";

/** Todo lo que toca red o base de datos entra por aca, asi el flujo se testea sin ninguna de las dos. */
export type DepsBot = {
  reclamarMensaje(senderId: string, mid: string, contenido: string): Promise<boolean>;
  obtenerHistorial(senderId: string): Promise<TurnoHistorial[]>;
  obtenerStockTexto(): Promise<string>;
  responderIA(entrada: { stockTexto: string; historial: TurnoHistorial[] }): Promise<RespuestaIA>;
  guardarLead(senderId: string, lead: LeadInput): Promise<void>;
  guardarRespuesta(senderId: string, texto: string): Promise<void>;
  enviar(senderId: string, texto: string): Promise<void>;
};

/**
 * Procesa un lote de mensajes en orden y nunca lanza: un mensaje que falla no puede
 * frenar a los demas ni tumbar el webhook (Meta reintentaria el lote entero).
 */
export async function procesarMensajes(mensajes: MensajeEntrante[], deps: DepsBot): Promise<void> {
  for (const mensaje of mensajes) {
    try {
      await procesarMensaje(mensaje, deps);
    } catch (err) {
      console.error(`[bot] Error procesando el mensaje ${mensaje.mid}:`, err);
      await avisarError(mensaje.senderId, deps);
    }
  }
}

async function procesarMensaje({ senderId, mid, texto }: MensajeEntrante, deps: DepsBot): Promise<void> {
  const esNuevo = await deps.reclamarMensaje(senderId, mid, texto ?? CONTENIDO_ADJUNTO);
  if (!esNuevo) return;

  if (texto === null) {
    await responder(senderId, MENSAJE_ADJUNTO, deps);
    return;
  }

  // El mensaje actual ya esta en el historial porque se registro al reclamarlo.
  const [historial, stockTexto] = await Promise.all([
    deps.obtenerHistorial(senderId),
    deps.obtenerStockTexto(),
  ]);

  const respuesta = await deps.responderIA({ stockTexto, historial });

  if (respuesta.lead) {
    try {
      await deps.guardarLead(senderId, respuesta.lead);
    } catch (err) {
      // El cliente igual recibe su respuesta; el lead fallido queda en los logs.
      console.error(`[bot] No se pudo guardar el lead de ${senderId}:`, err);
    }
  }

  await responder(senderId, respuesta.texto, deps);
}

async function responder(senderId: string, texto: string, deps: DepsBot): Promise<void> {
  await deps.enviar(senderId, texto);

  try {
    await deps.guardarRespuesta(senderId, texto);
  } catch (err) {
    // Ya se envio: tirar el error mandaria un segundo mensaje de disculpas sin motivo.
    console.error(`[bot] No se pudo guardar la respuesta para ${senderId}:`, err);
  }
}

async function avisarError(senderId: string, deps: DepsBot): Promise<void> {
  try {
    await deps.enviar(senderId, MENSAJE_ERROR_TECNICO);
  } catch (err) {
    console.error(`[bot] No se pudo avisar el error a ${senderId}:`, err);
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/bot/handler.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/handler.ts src/lib/bot/handler.test.ts
git commit -m "feat: orquestacion del flujo de mensajes del bot con manejo de errores" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Cableado real y ruta del webhook

**Files:**
- Modify: `vitest.config.ts` (alias `@/`)
- Create: `src/lib/bot/deps.ts`
- Create: `src/app/api/instagram/webhook/route.ts`
- Test: `src/app/api/instagram/webhook/route.test.ts`

**Interfaces:**
- Consumes: todo lo anterior. `crearDeps(): DepsBot` (puede lanzar si falta la config de Supabase; la ruta lo llama dentro de su `try/catch`).
- Produces: rutas `GET` y `POST` de `/api/instagram/webhook`.

- [ ] **Step 1: Agregar el alias `@/` a Vitest**

Los tests de la ruta importan módulos con `@/lib/...` (como el resto de `src/app`). Reemplazar el contenido de `vitest.config.ts` por:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Escribir los tests de la ruta (fallan)**

Create `src/app/api/instagram/webhook/route.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { procesarMensajes } from "@/lib/bot/handler";
import { GET, POST } from "./route";

vi.mock("@/lib/bot/handler", () => ({ procesarMensajes: vi.fn(async () => {}) }));
vi.mock("@/lib/bot/deps", () => ({ crearDeps: vi.fn(() => ({})) }));

const URL_WEBHOOK = "http://localhost:3000/api/instagram/webhook";
const APP_SECRET = "secret-de-prueba";
const VERIFY_TOKEN = "token-de-verificacion";

const payload = {
  object: "instagram",
  entry: [
    {
      id: "1",
      time: 1,
      messaging: [
        {
          sender: { id: "1234567890" },
          recipient: { id: "1" },
          timestamp: 1,
          message: { mid: "mid.abc", text: "Hola" },
        },
      ],
    },
  ],
};

function firmar(cuerpo: string) {
  return `sha256=${createHmac("sha256", APP_SECRET).update(cuerpo, "utf8").digest("hex")}`;
}

function postFirmado(cuerpo: string, firma = firmar(cuerpo)) {
  return new Request(URL_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": firma },
    body: cuerpo,
  });
}

beforeEach(() => {
  vi.stubEnv("IG_VERIFY_TOKEN", VERIFY_TOKEN);
  vi.stubEnv("IG_APP_SECRET", APP_SECRET);
  vi.mocked(procesarMensajes).mockClear();
  vi.mocked(procesarMensajes).mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/instagram/webhook (verificacion de Meta)", () => {
  const verificar = (query: string) => GET(new Request(`${URL_WEBHOOK}?${query}`));

  it("devuelve el hub.challenge como texto plano cuando el token coincide", async () => {
    const respuesta = await verificar(
      `hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1158201444`,
    );

    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toBe("1158201444");
  });

  it("responde 403 con un token incorrecto", async () => {
    const respuesta = await verificar("hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1");

    expect(respuesta.status).toBe(403);
  });

  it("responde 403 si el modo no es subscribe", async () => {
    const respuesta = await verificar(`hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`);

    expect(respuesta.status).toBe(403);
  });

  it("responde 403 si IG_VERIFY_TOKEN no esta configurado, aunque el pedido no traiga token", async () => {
    vi.stubEnv("IG_VERIFY_TOKEN", "");

    const respuesta = await verificar("hub.mode=subscribe&hub.challenge=1");

    expect(respuesta.status).toBe(403);
  });
});

describe("POST /api/instagram/webhook", () => {
  it("responde 401 y no procesa nada si la firma es invalida", async () => {
    const cuerpo = JSON.stringify(payload);

    const respuesta = await POST(postFirmado(cuerpo, "sha256=deadbeef"));

    expect(respuesta.status).toBe(401);
    expect(procesarMensajes).not.toHaveBeenCalled();
  });

  it("responde 401 si falta la firma", async () => {
    const respuesta = await POST(
      new Request(URL_WEBHOOK, { method: "POST", body: JSON.stringify(payload) }),
    );

    expect(respuesta.status).toBe(401);
  });

  it("responde 500 si IG_APP_SECRET no esta configurado", async () => {
    vi.stubEnv("IG_APP_SECRET", "");

    const respuesta = await POST(postFirmado(JSON.stringify(payload)));

    expect(respuesta.status).toBe(500);
    expect(procesarMensajes).not.toHaveBeenCalled();
  });

  it("responde 400 si el cuerpo firmado no es JSON", async () => {
    const respuesta = await POST(postFirmado("esto no es json"));

    expect(respuesta.status).toBe(400);
  });

  it("extrae los mensajes y los procesa cuando la firma es valida", async () => {
    const respuesta = await POST(postFirmado(JSON.stringify(payload)));

    expect(respuesta.status).toBe(200);
    expect(procesarMensajes).toHaveBeenCalledTimes(1);
    expect(vi.mocked(procesarMensajes).mock.calls[0][0]).toEqual([
      { senderId: "1234567890", mid: "mid.abc", texto: "Hola" },
    ]);
  });

  it("responde 200 aunque el procesamiento falle (para que Meta no reintente en bucle)", async () => {
    vi.mocked(procesarMensajes).mockRejectedValue(new Error("explotó todo"));

    const respuesta = await POST(postFirmado(JSON.stringify(payload)));

    expect(respuesta.status).toBe(200);
  });

  it("responde 200 a eventos sin mensajes (lecturas, reacciones)", async () => {
    const lectura = { object: "instagram", entry: [{ messaging: [{ sender: { id: "1" }, read: { mid: "m" } }] }] };

    const respuesta = await POST(postFirmado(JSON.stringify(lectura)));

    expect(respuesta.status).toBe(200);
    expect(vi.mocked(procesarMensajes).mock.calls[0][0]).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx vitest run src/app/api/instagram/webhook/route.test.ts`
Expected: FAIL — "Failed to resolve import ./route" (o `@/lib/bot/deps`).

- [ ] **Step 4: Implementar el cableado real**

Create `src/lib/bot/deps.ts`:

```ts
import { createAdminSupabaseClient } from "../supabase";
import { enviarMensajeInstagram } from "../instagram/graph";
import { responderIA } from "./ai";
import { guardarRespuesta, obtenerHistorial, reclamarMensaje } from "./conversations";
import type { DepsBot } from "./handler";
import { guardarLeadInstagram } from "./leads";
import { obtenerStockTexto } from "./stock";

/**
 * Arma las dependencias reales del bot. Se llama una vez por request: en serverless
 * no hay estado entre invocaciones, y el cliente de Supabase es barato de crear.
 */
export function crearDeps(): DepsBot {
  const db = createAdminSupabaseClient();
  const siteUrl = process.env.SITE_URL ?? "";

  return {
    reclamarMensaje: (senderId, mid, contenido) => reclamarMensaje(db, senderId, mid, contenido),
    obtenerHistorial: (senderId) => obtenerHistorial(db, senderId),
    obtenerStockTexto: () => obtenerStockTexto(db, siteUrl),
    responderIA,
    guardarLead: (senderId, lead) => guardarLeadInstagram(db, senderId, lead),
    guardarRespuesta: (senderId, texto) => guardarRespuesta(db, senderId, texto),
    enviar: enviarMensajeInstagram,
  };
}
```

- [ ] **Step 5: Implementar la ruta del webhook**

Create `src/app/api/instagram/webhook/route.ts`:

```ts
import { crearDeps } from "@/lib/bot/deps";
import { procesarMensajes } from "@/lib/bot/handler";
import { extraerMensajes } from "@/lib/instagram/payload";
import { verificarFirma } from "@/lib/instagram/signature";

export const runtime = "nodejs"; // usa node:crypto
export const dynamic = "force-dynamic";
// Una llamada a Claude + la Graph API tarda unos segundos; el tope lo fija la plataforma.
export const maxDuration = 25;

/**
 * Verificacion del webhook: al configurarlo en Meta, hace un GET con un desafio
 * (hub.challenge) y espera que se lo devolvamos si el token coincide.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tokenEsperado = process.env.IG_VERIFY_TOKEN;

  const valido =
    Boolean(tokenEsperado) &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === tokenEsperado;

  if (!valido) return new Response("Forbidden", { status: 403 });

  return new Response(params.get("hub.challenge") ?? "", { status: 200 });
}

/** Recibe los mensajes de Instagram. Con firma valida siempre devuelve 200 para que Meta no reintente. */
export async function POST(request: Request) {
  const appSecret = process.env.IG_APP_SECRET;
  if (!appSecret) {
    console.error("[instagram] Falta la variable de entorno IG_APP_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  // La firma se calcula sobre el texto exacto: hay que leerlo crudo antes de parsear.
  const cuerpo = await request.text();
  if (!verificarFirma(cuerpo, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    await procesarMensajes(extraerMensajes(payload), crearDeps());
  } catch (err) {
    // crearDeps() puede lanzar si falta la config de Supabase. Se loguea y se responde 200 igual.
    console.error("[instagram] Error inesperado en el webhook:", err);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npx vitest run src/app/api/instagram/webhook/route.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 7: Verificar tipado y toda la suite**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx vitest run`
Expected: PASS — toda la suite (los tests previos del repo más los nuevos).

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts src/lib/bot/deps.ts src/app/api/instagram/webhook/route.ts src/app/api/instagram/webhook/route.test.ts
git commit -m "feat: webhook de Instagram (GET verificacion + POST mensajes)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Panel de leads con origen Instagram

**Files:**
- Modify: `src/app/admin/leads/page.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: columnas `leads.origen`, `leads.instagram_id`, `leads.whatsapp` nullable (migración de la Task 1).

No tiene test unitario: es una página de servidor que solo muestra datos. Se verifica con tipado, lint y a mano (Task 11).

- [ ] **Step 1: Reemplazar la página**

Replace the full content of `src/app/admin/leads/page.tsx` with:

```tsx
import { requireAdminSession } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireAdminSession();
  const supabase = createAdminSupabaseClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-black italic text-car-white">Leads</h1>
        <p className="mt-1 text-sm text-car-muted">Clientes captados por el bot de Instagram y WhatsApp</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-car-gray2 text-xs uppercase tracking-wide text-car-muted">
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Origen</th>
              <th className="px-4 py-3 text-left">Interés</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-white/5 bg-car-gray transition hover:bg-car-gray2"
              >
                <td className="px-4 py-3 font-semibold text-car-white">{lead.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-car-muted">
                  {lead.telefono ? (
                    <a
                      href={`https://wa.me/${lead.telefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener"
                      className="hover:text-car-gold"
                    >
                      {lead.telefono}
                    </a>
                  ) : (
                    (lead.whatsapp ?? "—")
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-car-muted">
                  {lead.origen === "instagram" ? (
                    <span title={`ID de Instagram: ${lead.instagram_id}`}>Instagram</span>
                  ) : (
                    "WhatsApp"
                  )}
                </td>
                <td className="px-4 py-3 text-car-muted">{lead.vehiculo_interes ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                      lead.estado === "nuevo"
                        ? "bg-emerald-900/50 text-emerald-400"
                        : lead.estado === "contactado"
                        ? "bg-car-gold/15 text-car-gold"
                        : "bg-white/5 text-car-muted"
                    }`}
                  >
                    {lead.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-car-muted">
                  {new Date(lead.created_at).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!leads || leads.length === 0) && (
          <p className="py-10 text-center text-car-muted">
            Aún no hay leads registrados. El bot los captará automáticamente.
          </p>
        )}
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 2: Verificar tipado y lint**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos en los archivos de esta feature (si aparecen warnings preexistentes en otros archivos, ignorarlos y anotarlos).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/leads/page.tsx
git commit -m "feat: mostrar origen (Instagram/WhatsApp) en el panel de leads" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Verificación end-to-end, puesta en marcha y limpieza

**Files:** ninguno nuevo (configuración externa + prueba manual). El borrado de `whatsapp-bot/` solo con confirmación del usuario.

- [ ] **Step 1: Suite completa y build**

Run: `npx vitest run`
Expected: toda la suite en verde.

Run: `npm run build`
Expected: build exitoso; en la lista de rutas aparece `ƒ /api/instagram/webhook` (dinámica).

- [ ] **Step 2: Prueba local del webhook**

Agregar a `.env.local` (archivo ignorado por git) las variables de la Task 1 con valores reales de prueba: `IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `ANTHROPIC_API_KEY`, `SITE_URL=http://localhost:3000`. `PAGE_ACCESS_TOKEN` puede ser cualquier texto para esta prueba.

Run (en una terminal): `npm run dev`

Verificación `GET` (desde otra terminal; reemplazar el token por el de `.env.local`):

```bash
curl -i "http://localhost:3000/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=12345"
```
Expected: `HTTP/1.1 200` y cuerpo `12345`. Con un token incorrecto: `403`.

Simulación de un `POST` firmado (exporta antes `IG_APP_SECRET` con el mismo valor de `.env.local`; cada prueba necesita un `mid` nuevo, si no se descarta como duplicado):

```bash
BODY='{"object":"instagram","entry":[{"id":"1","time":1,"messaging":[{"sender":{"id":"123456"},"recipient":{"id":"1"},"timestamp":1,"message":{"mid":"mid.prueba1","text":"Hola, que autos tienen disponibles?"}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$IG_APP_SECRET" | sed 's/^.* //')
curl -i -X POST http://localhost:3000/api/instagram/webhook -H "Content-Type: application/json" -H "X-Hub-Signature-256: sha256=$SIG" -d "$BODY"
```
Expected: `HTTP/1.1 200` con `EVENT_RECEIVED`. En los logs de `npm run dev`: la llamada a Claude se ejecuta y el **envío falla** con `Graph API 4xx` (el destinatario `123456` y el token son falsos). Ese error es lo esperado y prueba que todo el flujo funciona hasta el último paso. Además, en Supabase deben aparecer 1 fila `user` en `ig_mensajes` (la respuesta del bot no se guarda porque el envío falló).

Repetir con la misma firma y el mismo `mid`: debe responder `200` y **no** volver a llamar a Claude (deduplicación).

- [ ] **Step 3: Configurar Meta (acción manual del usuario)**

Los nombres exactos de los menús de Meta cambian con frecuencia; si algo no coincide, buscar la opción equivalente en la documentación de "Instagram Messaging API".

1. En developers.facebook.com: crear una app tipo **Business** y agregar el producto **Instagram** (mensajería).
2. La cuenta de Instagram debe ser **profesional** (negocio/creador) y estar vinculada a una **página de Facebook**. En Instagram → Configuración → Mensajes y respuestas a historias → herramientas conectadas: permitir el acceso a los mensajes.
3. Generar el **token de acceso de la página** (`PAGE_ACCESS_TOKEN`) con permiso `instagram_manage_messages`. Conviene uno de larga duración.
4. Copiar el **App Secret** (Configuración de la app → Básica) a `IG_APP_SECRET`.
5. En el producto Instagram → Webhooks: URL de devolución `https://TU-SITIO/api/instagram/webhook`, token de verificación = `IG_VERIFY_TOKEN`, y suscribirse al campo **`messages`**. Meta hace el `GET` en ese momento: tiene que responder 200.
6. Cargar las 5 variables (`IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `PAGE_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `SITE_URL`) en Netlify (Site configuration → Environment variables) y **volver a desplegar** (el sitio ya usa `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SUPABASE_URL`).
7. Probar escribiéndole a la cuenta desde un usuario con **rol en la app** (administrador, desarrollador o tester). Sin App Review aprobada, el bot **no responde a cuentas ajenas**; para público general hay que pedir la revisión del permiso `instagram_manage_messages`.
8. Recordar la regla de Meta: solo se puede responder dentro de las 24 h posteriores al último mensaje del cliente.

- [ ] **Step 4: Prueba real**

Con un usuario de prueba, enviar: "Hola, qué autos tienen?" → debe responder con vehículos de `vehiculos_posse` en estado `disponible`, con link a la ficha. Después dar nombre y teléfono → debe aparecer una fila en `/admin/leads` con origen **Instagram**. Marcar un auto como `vendido` en el panel y volver a preguntar: ya no debe ofrecerlo.

- [ ] **Step 5: Revisar costo (opcional)**

En la consola de Anthropic (Usage), comprobar tokens por mensaje. Si el prompt supera el mínimo cacheable del modelo, los mensajes siguientes deberían mostrar tokens de lectura de caché; si el prompt es más corto, el cache simplemente no se aplica (no es un error).

- [ ] **Step 6: Eliminar `whatsapp-bot/` — SOLO con confirmación explícita del usuario**

**No ejecutar este paso sin que el usuario lo confirme en el chat.** Antes de pedirla, informarle:

- `whatsapp-bot/` está **sin versionar en git**: borrarlo no se puede deshacer con `git`.
- Contiene `.env` con claves reales (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) y `data/solicitudes.jsonl` con solicitudes locales. Si quiere conservar algo, que lo copie fuera del proyecto primero.
- Las claves de ese `.env` ya viven (o deben vivir) en las variables de entorno de Netlify.

Con la confirmación, ejecutar: `rm -rf whatsapp-bot` y comprobar con `git status --short` que ya no aparece `?? whatsapp-bot/`. No hay nada que commitear porque nunca estuvo versionado.

- [ ] **Step 7: Commit final de notas (si hubo ajustes)**

Si durante la verificación hubo que corregir algo, commitear esos cambios con su propio mensaje. Si no hubo cambios, no hay commit.
