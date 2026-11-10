# Asistente de la página — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un chat con el robot de Posse en la ficha de cada auto y en el catálogo, que reutiliza el motor del bot de Instagram, termina siempre en un WhatsApp a Marcos con el mensaje armado, y deja conversaciones y estadísticas en el admin.

**Architecture:** El motor puro `conversar()` gana un `canal` (`"instagram"` | `"web"`). Una capa nueva `src/lib/bot/web/` (pura, con dependencias inyectadas) suma guiones por opciones (financiar, usado, disponible, Marcos), traduce las tarjetas del motor a un formato para el navegador y decide quién responde cada turno. `POST /api/chat` la conecta a Supabase (tablas `web_*`); un componente cliente `Asistente` la consume. El admin lee las tablas nuevas en una pestaña "Página web" de `/admin/conversaciones`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase (`@supabase/supabase-js`), Vitest (entorno `node`, sin jsdom).

**Spec:** `docs/superpowers/specs/2026-11-09-asistente-web-design.md` (leerlo antes de empezar: las secciones 4, 5, 6, 7 y 9 mandan).

## Global Constraints

- **Sin modelo de IA**: todo por reglas; cero llamadas externas en el chat.
- **Los tests actuales del bot de Instagram siguen pasando sin tocarlos** (`npx vitest run src/lib/bot` verde después de cada tarea que toque `src/lib/bot`). El comportamiento por defecto del motor (`canal` ausente) es el de Instagram.
- **Marcos recibe todo**: el número sale de `WHATSAPP_LOCAL` (`src/lib/utils.ts`), nunca escrito a mano.
- **Sin emojis ni caracteres invisibles en ningún link `wa.me` ni en el mensaje armado para Marcos** (el navegador de Instagram los rompe). Largo máximo del link: 1700 caracteres.
- **Textos**: español rioplatense, cortos, sin markdown, sin prometer tasas ni cuotas, sin fingir ser una persona. Nombre: "Asistente de Posse Automotores". Estado: "En línea".
- **Privacidad**: no guardar IP ni datos del dispositivo en el chat. Retención de 90 días. RLS activada **sin políticas** en las tablas nuevas (solo service role).
- **Límites del chat**: texto ≤ 500 caracteres, cuerpo ≤ 2000 bytes, 30 mensajes por visitante cada 10 min, 300 globales cada 10 min.
- **Alcance de páginas**: el asistente va solo en `src/app/vehiculos/[slug]/page.tsx` y `src/app/catalogo/page.tsx`, en lugar de `<FloatingWhatsApp />`. Las demás páginas no cambian.
- Cada commit termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Mensajes en español con prefijo `feat:`/`fix:`/`test:`. Agregar solo los archivos de cada tarea (el árbol tiene archivos sin seguimiento ajenos a este trabajo: no usar `git add .`).
- Rama: crear `feat/asistente-web` desde la rama actual (`feat/conversaciones-bot`, que tiene el motor del bot) antes de la Tarea 1, y hacer el primer commit con la spec y este plan.

## Review Focus

Cada línea tiene su test en la tarea indicada.

1. **Mensaje armado con texto raro** (emojis, saltos de línea, 500 caracteres de "usado", comillas, `&`, `#`): el link sigue siendo `wa.me` válido, sin emojis, ≤ 1700 caracteres, y decodificado coincide con el texto mostrado. → Tarea 3.
2. **Pedido inválido a `/api/chat`** (cuerpo que no es JSON, visitante ausente o corto, `slug` con `../`, `opcion` inventada, texto vacío o de 5000 caracteres, texto y opción juntos): responde sin romper ni guardar nada. → Tarea 5.
3. **Ficha de un auto inexistente, reservado o vendido**: el asistente no falla; trata el auto inexistente como catálogo, y un vendido/reservado lo dice y ofrece alternativas. → Tarea 4.
4. **Doble toque o dos mensajes seguidos**: el cliente no manda otro mientras espera respuesta, y dos pedidos simultáneos del mismo visitante no dejan un estado corrupto (gana el último guardado). → Tareas 7 y 6.
5. **Supabase caído, tablas `web_*` sin crear o catálogo vacío**: `/api/chat` responde 200 con un texto fijo y el botón de Marcos, nunca 500 ni pantalla en blanco. → Tarea 6.
6. **Almacenamiento del navegador bloqueado** (navegación privada): el chat funciona igual, solo que no se restaura al recargar. → Tarea 7.

---

### Task 1: Tipos de evento y script SQL

**Files:**
- Modify: `src/lib/eventos.ts` (`TIPOS_EVENTO`)
- Modify: `src/lib/eventos.test.ts`, `src/lib/estadisticas.test.ts`
- Create: `supabase/schema-web-bot.sql`

**Interfaces:**
- Produces: `TipoEvento` incluye `"chat_abrio"` y `"chat_whatsapp"`; tablas `web_sesiones`, `web_mensajes`, función `limpiar_web_viejos()`.

- [ ] **Step 1: Tests que fallan.** En `eventos.test.ts`: `validarEvento({ tipo: "chat_abrio", ruta: "/vehiculos/gol-2010", visitante: VID })` devuelve el evento con `vehiculo_slug: "gol-2010"`; igual con `chat_whatsapp` en `/catalogo` (`vehiculo_slug: null`); `validarEvento({ tipo: "chat_inventado", ruta: "/" })` es `null`. En `estadisticas.test.ts`: `resumir([ev("chat_abrio"), ev("chat_whatsapp")], AUTOS, 7, AHORA)` deja en 0 visitas, consultas por WhatsApp y simulaciones (los eventos del chat no se mezclan con las métricas existentes).
- [ ] **Step 2:** `npx vitest run src/lib/eventos.test.ts src/lib/estadisticas.test.ts` → FAIL.
- [ ] **Step 3:** Agregar los dos tipos a `TIPOS_EVENTO`. Si `resumir` o alguna vista usa un `Record<TipoEvento, …>` o un `switch` exhaustivo, ajustarlo para ignorar los nuevos. Correr `npx tsc --noEmit` y resolver lo que marque.
- [ ] **Step 4:** Crear `supabase/schema-web-bot.sql` (mismo estilo y comentarios que `schema-instagram.sql`; el dueño lo corre a mano en el SQL Editor de Supabase) con: `web_sesiones (visitante text primary key, estado jsonb not null default '{}', guion jsonb not null default '{}', actualizado timestamptz not null default now())`; `web_mensajes (id uuid pk default gen_random_uuid(), visitante text not null, role text check in ('user','assistant'), content text not null, tipo text not null default 'texto' check in ('texto','tarjetas','cierre'), via text check in ('opcion','texto'), vehiculo_slug text, nota text, created_at timestamptz not null default now())` con índice `(visitante, created_at desc)` y otro `(created_at desc)`; RLS activada sin políticas en ambas; función `limpiar_web_viejos()` (security definer, borra `web_mensajes` y `web_sesiones` de más de 90 días; `revoke all … from public, anon, authenticated`); reemplazo del `check` de `eventos.tipo` para aceptar los seis tipos (`alter table … drop constraint if exists …` leyendo el nombre real en `schema-eventos.sql`: si el check es anónimo, su nombre es `eventos_tipo_check`); y `leads_contacto_check` recreado como `check (whatsapp is not null or instagram_id is not null or origen = 'web')`.
- [ ] **Step 5:** Tests en verde, `tsc` sin errores. Commit: `feat: tipos de evento del chat y script SQL de las tablas web`.

### Task 2: Canal web en el motor

**Files:**
- Modify: `src/lib/utils.ts` (exportar `limpioParaLink`, agregar `buildWhatsAppUrlWeb`)
- Modify: `src/lib/bot/respuestas.ts` (`Contexto`, `botonContacto`, `tarjetaDe`, `tarjetaContacto`, `tarjetaFinanciacion`), `src/lib/bot/motor.ts` (`EntradaMotor`), `src/lib/bot/turno.ts` (arma el `ctx`), y lo que haga falta en `textos.ts`/`postulacion.ts`
- Create: `src/lib/bot/motor-web.test.ts`
- Modify: `src/lib/utils.test.ts` (o el archivo de tests de utils que exista)

**Interfaces:**
- Produces: `export type Canal = "instagram" | "web"` (en `respuestas.ts`); `Contexto = { negocio: Negocio; siteUrl: string; canal?: Canal }`; `EntradaMotor.canal?: Canal`; `buildWhatsAppUrlWeb(vehiculo: Pick<Vehiculo, "nombre" | "tipo"> | null): string`; `botonContacto(v, negocio, canal?: Canal)`.

- [ ] **Step 1: Tests que fallan** (`motor-web.test.ts`, con los fixtures de `src/lib/bot/__fixtures__`):
  - `buildWhatsAppUrlWeb(null)` empieza con `https://wa.me/${WHATSAPP_LOCAL}?text=` y decodificado es `"Hola, te escribo desde la web. Quiero consultar por un vehículo."`; con `{nombre:"Volkswagen Taos", tipo:"Auto"}` es `"Hola, te escribo desde la web. Me interesa el Volkswagen Taos. ¿Sigue disponible?"`; con tipo `"Moto"` dice "la".
  - `tarjetaDe(v, { negocio: NEGOCIO, siteUrl: "https://posse.test", canal: "web" })`: el botón "Hablar con Marcos" decodificado contiene "desde la web"; sin `canal` contiene "desde Instagram" (sin cambios).
  - Batería: para cada texto de `["hola","cuánto sale","tienen una pick-up","busco trabajo","sos un bot?","quiero financiar","aceptan permuta","dónde están","avisame cuando entre un gol","mi cel es 3537 123456","asdkj qwe"]`, `conversar({ ...entradaBase, canal: "web", texto })` produce mensajes cuyos textos, títulos/subtítulos de tarjetas, títulos de botones y URLs decodificadas **no contienen** `/instagram/i`.
  - `conversar({ canal: "web", texto: "busco trabajo", … })` no inicia la postulación de varios pasos: `sesion.paso` queda `"libre"` y responde con el contacto de Marcos.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar `buildWhatsAppUrlWeb` en `utils.ts` (sin emojis, mismo estilo que `buildWhatsAppUrlInstagram`). Pasar `canal` por `Contexto` hasta `botonContacto`. En `turno.ts` el `ctx` toma `canal: e.canal ?? "instagram"`. En `motor.ts`, con `canal === "web"` la intención de empleo responde con la tarjeta/texto de contacto de Marcos en lugar de iniciar la postulación. Revisar `textos.ts` y toda respuesta alcanzable sin historia ni adjuntos y reemplazar menciones a Instagram por redacción neutral **solo cuando `canal === "web"`** (no cambiar lo que ve Instagram).
- [ ] **Step 4:** `npx vitest run src/lib/bot` → todo verde (incluye los tests previos de Instagram).
- [ ] **Step 5: Commit** `feat: el motor del bot entiende el canal web`.

### Task 3: Tipos web, mensaje para Marcos y guiones

**Files:**
- Create: `src/lib/bot/web/tipos.ts`, `src/lib/bot/web/mensaje-marcos.ts`, `src/lib/bot/web/guiones.ts`
- Test: `src/lib/bot/web/mensaje-marcos.test.ts`, `src/lib/bot/web/guiones.test.ts`

**Interfaces:**
- Produces (en `tipos.ts`):
  ```ts
  export type OpcionId = "financiar" | "usado" | "disponible" | "marcos" | "buscar" | "seguir" | "ver_financiacion" | "confirmar_si"
    | "anticipo_sin" | "anticipo_hasta_3" | "anticipo_mas_3" | "anticipo_solo_usado" | "cuotas_12" | "cuotas_24" | "cuotas_36" | "cuotas_48";
  export const ETIQUETAS_OPCION: Record<OpcionId, string>; // "Quiero financiarlo", "Tengo un usado para entregar", "¿Sigue disponible?", "Hablar con Marcos", "Ver autos por marca o tipo", "Seguir preguntando", "Mejor veo la financiación", "Sí, quiero", "Sin anticipo", "Hasta 3 millones", "Más de 3 millones", "Solo el usado", "12", "24", "36", "48"
  export const esOpcionId: (v: unknown) => v is OpcionId;
  export type TarjetaWeb = { slug: string | null; titulo: string; subtitulo: string; imagenUrl: string | null; estado: EstadoVehiculo | null; botones: Boton[] };
  export type MensajeWeb =
    | { tipo: "texto"; texto: string }
    | { tipo: "tarjetas"; tarjetas: TarjetaWeb[] }
    | { tipo: "cierre"; texto: string; url: string; vehiculoSlug: string | null };
  export type RespuestaChat = { mensajes: MensajeWeb[]; sugerencias: OpcionId[] };
  export type Pagina = "ficha" | "catalogo";
  export type EntradaChat = { pagina: Pagina; slug: string | null; texto?: string; opcion?: OpcionId; inicio?: true };
  export type Guion = {
    flujo: "financiar" | "usado" | "disponible" | null;
    paso: "anticipo" | "cuotas" | "usado" | "confirmar" | null;
    datos: { anticipo?: string; cuotas?: string; usado?: string };
  };
  ```
- Produces (`mensaje-marcos.ts`): `armarMensajeMarcos(a: { vehiculo: Pick<VehiculoCatalogo, "nombre" | "anio" | "tipo" | "slug"> | null; detalle: string[] }): { texto: string; url: string }`.
- Produces (`guiones.ts`): `guionNuevo(): Guion`; `type ContextoGuion = { vehiculo: VehiculoCatalogo | null; extra?: string; negocio: Negocio; siteUrl: string }`; `type ResultadoGuion = { guion: Guion; mensajes: MensajeWeb[]; sugerencias: OpcionId[] }`; `avanzarGuion(g: Guion, entrada: { opcion?: OpcionId; texto?: string }, ctx: ContextoGuion): ResultadoGuion`; `preguntaPendiente(g: Guion, ctx: ContextoGuion): MensajeWeb | null`.

- [ ] **Step 1: Tests de `mensaje-marcos.test.ts`** (fallan):
  - Con `vehiculo {nombre:"Volkswagen Taos", anio:2022, tipo:"Auto", slug:"vw-taos-2022"}` y `detalle ["Quiero financiarlo.","Anticipo: hasta 3 millones.","Cuotas: 24."]`: `texto === "Hola Marcos, te escribo desde la web. Me interesa el Volkswagen Taos 2022. Quiero financiarlo. Anticipo: hasta 3 millones. Cuotas: 24. ¿Sigue disponible?"`, `url` empieza con `https://wa.me/${WHATSAPP_LOCAL}?text=` y `decodeURIComponent(url.split("text=")[1]) === texto`.
  - `vehiculo: null` → `"Hola Marcos, te escribo desde la web. Quiero consultar por un vehículo. …detalle"` y sin "¿Sigue disponible?".
  - Emojis, `\n`, `‍` en `detalle` desaparecen del texto y del link; `detalle` con `"Tengo para entregar: " + "a".repeat(500)` → `url.length <= 1700` y la URL decodificada sigue terminando en `"?"`/frase completa sin cortarse a mitad de un `%XX`; caracteres `& # % "` quedan bien codificados (round-trip).
- [ ] **Step 2: Tests de `guiones.test.ts`** (`ctx` con un auto del fixture):
  - `avanzarGuion(guionNuevo(), { opcion: "financiar" }, ctx)` → `guion.flujo "financiar"`, `paso "anticipo"`, un texto `"Dale. ¿Con cuánto pensás entregar?"`, `sugerencias ["anticipo_sin","anticipo_hasta_3","anticipo_mas_3"]`.
  - Luego `{opcion:"anticipo_hasta_3"}` → `paso "cuotas"`, sugerencias `["cuotas_12","cuotas_24","cuotas_36","cuotas_48"]`; luego `{opcion:"cuotas_24"}` → último mensaje `tipo "cierre"` con texto que contiene `"Anticipo: hasta 3 millones."` y `"Cuotas: 24."`, `guion` vuelve a `guionNuevo()`, sugerencias `["seguir","marcos"]`.
  - Con `ctx.extra = "Tengo para entregar: bmw 2016."` el primer paso dice `"Dale, tomamos tu usado como parte de pago. ¿Entregás algo más en efectivo?"`, la primera sugerencia es `"anticipo_solo_usado"`, y el cierre incluye el extra.
  - Texto libre en `paso "anticipo"`: `{texto:"tengo 2 palos"}` → pasa a `"cuotas"` y `datos.anticipo === "tengo 2 palos"`; el cierre lo contiene.
  - `{opcion:"usado"}` → `paso "usado"`, sin sugerencias; `{texto:"Hilux 2015"}` → cierre con `"Tengo para entregar: Hilux 2015."`.
  - `{opcion:"disponible"}` con auto `estado "vendido"` → texto contiene `"se vendió"`, sugerencias `["buscar","marcos"]`; con `"reservado"` → contiene `"reservado"`; con `"disponible"` → ofrece que Marcos confirme, sugerencias `["confirmar_si","ver_financiacion"]`; `confirmar_si` → cierre `"Quiero que me confirmen si sigue disponible y que me manden fotos y video."`; `ver_financiacion` → arranca el flujo financiar.
  - `{opcion:"marcos"}` → cierre directo con `"Quiero hablar con alguien del equipo."`.
  - Dentro de `paso "cuotas"`, `{opcion:"usado"}` reemplaza el guion (`flujo "usado"`).
  - `preguntaPendiente(g con paso "anticipo", ctx)` devuelve el texto de la pregunta; con `flujo null` devuelve `null`.
- [ ] **Step 3:** Correr → FAIL. Implementar los tres archivos. `armarMensajeMarcos` usa `limpioParaLink` (exportado en Tarea 2) por cada fragmento y `WHATSAPP_LOCAL`; recorta por fragmentos completos, nunca a mitad de una secuencia `%XX`. Los textos de los guiones son los de la spec (sección 4.2).
- [ ] **Step 4:** Tests en verde. Commit: `feat: guiones por opciones y mensaje armado para Marcos`.

### Task 4: Orquestador `responderWeb`

**Files:**
- Create: `src/lib/bot/web/asistente.ts`, `src/lib/bot/web/tarjetas.ts`, `src/lib/bot/web/sugerencias.ts`
- Test: `src/lib/bot/web/asistente.test.ts`

**Interfaces:**
- Consumes: Tarea 2 (`conversar`, `canal`), Tarea 3 (todo `tipos.ts`, `guiones.ts`, `armarMensajeMarcos`).
- Produces:
  ```ts
  export type EstadoWeb = { sesion: Sesion; guion: Guion };
  export type DepsAsistente = { negocio: Negocio; siteUrl: string; ahora: () => Date };
  export type SalidaAsistente = { respuesta: RespuestaChat; estado: EstadoWeb; lead: LeadInput | null; noEntendido: boolean };
  export function responderWeb(entrada: EntradaChat & { mid: string }, estado: EstadoWeb | null, catalogo: VehiculoCatalogo[], deps: DepsAsistente): SalidaAsistente;
  // tarjetas.ts
  export function tarjetasAWeb(tarjetas: Tarjeta[], catalogo: VehiculoCatalogo[]): TarjetaWeb[]; // slug por el botón "Ver en la web" (/vehiculos/<slug>), estado por el catálogo
  // sugerencias.ts
  export function sugerenciasPara(a: { pagina: Pagina; tieneAuto: boolean; ofrecio: Sesion["ofrecio"] }): OpcionId[];
  ```

- [ ] **Step 1: Tests que fallan** (`asistente.test.ts`, catálogo del fixture; `deps.ahora` fijo):
  - `inicio` en ficha con slug existente: `mensajes[0]` texto contiene `"asistente de Posse Automotores"`, `mensajes[1].tipo === "tarjetas"` con `tarjetas[0].slug === slug`; `sugerencias` = `["financiar","usado","disponible","marcos"]`; `estado.sesion.vehiculoActualId` es el id del auto.
  - `inicio` en catálogo: sin tarjetas; `sugerencias` = `["financiar","buscar","usado","marcos"]`. `inicio` en ficha con slug inexistente: se comporta como catálogo, sin lanzar.
  - Ficha de un auto `vendido`: el inicio dice que ya se vendió y ofrece `["buscar","marcos"]`.
  - Texto `"cuánto sale"` en ficha: la respuesta contiene el `precio_texto` del auto.
  - Texto `"bmw"`: `tarjetas[0].slug` es el del BMW del fixture, `estado "disponible"`, botones incluyen "Ver en la web" y "Hablar con Marcos"; `estado.sesion.vehiculoActualId` pasa a ese auto.
  - Estado previo en `paso "anticipo"` (guion financiar): `texto "cuánto sale"` → responde el precio y el **último mensaje** es la pregunta pendiente, con `guion.paso` aún `"anticipo"`; `texto "tengo 2 palos"` → avanza a `"cuotas"`.
  - `texto "quiero financiarlo, tengo un bmw 2016 para entregar"` → `guion.flujo "financiar"`; completar con `anticipo_sin` y `cuotas_12` → el `cierre` contiene `"Tengo para entregar:"` y `"2016"`.
  - Estado previo con auto A y entrada con `slug` de B (ficha): primer mensaje texto contiene `"Ahora estás mirando"`, luego tarjeta de B, y `vehiculoActualId` es B. Mismo slug que antes: no repite el aviso.
  - `texto "avisame cuando entre un gol"` → responde pidiendo nombre (menciona "Marcos", no "Instagram"); luego `"Juan"` y `"3537123456"` → `lead` no nulo con `nombre "Juan"` y `telefono` con esos dígitos.
  - `texto "asdkj qwe"` → `noEntendido true`; la segunda vez seguida incluye un botón de Marcos (`tarjetas` con botón "Hablar con Marcos").
  - `opcion "seguir"` → texto `"Dale, ¿qué más querés saber?"` y las sugerencias iniciales de la página; `opcion "buscar"` → texto que pide marca, tipo o combustible (`"Contame qué buscás: marca, tipo o combustible, y te muestro lo que tenemos."`) sin sugerencias (el campo de texto queda a la espera); luego `texto "pick-up"` muestra tarjetas de pick-ups del catálogo.
  - `mid` igual + entrada igual → salida igual (determinista).
- [ ] **Step 2:** Correr → FAIL. Implementar. Orden de decisión de `responderWeb`: (1) normalizar estado (`normalizarSesion`) y aplicar contexto de página (auto de la ficha, aviso de cambio); (2) `inicio` → saludo + tarjeta + chips; (3) `opcion` → `avanzarGuion`; (4) `texto` con pregunta pendiente de guion → pasar por `conversar({canal:"web"})`: si el motor reconoce un tema (no `noEntendido` y respondió), concatenar su respuesta + `preguntaPendiente`; si no, `avanzarGuion` con el texto como respuesta del paso; (5) `texto` sin guion → `conversar`; si dice "financiar/cuotas" y el motor propone el flujo, arrancar el guion `financiar` con `extra` = usado detectado por `extraerUsado`; (6) calcular `sugerencias` con `sugerenciasPara`. Máximo 3 mensajes por respuesta (como el motor).
- [ ] **Step 3:** Tests en verde + `npx vitest run src/lib/bot` verde. Commit: `feat: orquestador del asistente web`.

### Task 5: Validación del pedido, límites y almacén

**Files:**
- Create: `src/lib/bot/web/pedido.ts`, `src/lib/bot/web/limites.ts`, `src/lib/bot/web/almacen.ts`
- Test: `src/lib/bot/web/pedido.test.ts`, `limites.test.ts`, `almacen.test.ts` (seguir el patrón de fake de Supabase de `src/lib/bot/conversations.test.ts`)

**Interfaces:**
- Produces:
  ```ts
  export type PedidoChat = EntradaChat & { visitante: string };
  export function validarPedidoChat(crudo: unknown): PedidoChat | null;
  export const LIMITES = { maxTexto: 500, maxBytes: 2000, porVisitante: 30, global: 300, ventanaMinutos: 10 } as const;
  export function evaluarLimite(c: { visitante: number; global: number }): "ok" | "visitante" | "global";
  export type FilaMensajeWeb = { role: "user" | "assistant"; content: string; tipo: "texto" | "tarjetas" | "cierre"; via: "opcion" | "texto" | null; vehiculo_slug: string | null; nota: string | null };
  export function cargarEstadoWeb(db: SupabaseClient, visitante: string, ahora: Date): Promise<EstadoWeb | null>;
  export function guardarEstadoWeb(db: SupabaseClient, visitante: string, e: EstadoWeb): Promise<void>;
  export function guardarMensajesWeb(db: SupabaseClient, visitante: string, filas: FilaMensajeWeb[]): Promise<void>;
  export function contarMensajesWeb(db: SupabaseClient, desde: Date, visitante?: string): Promise<number>; // solo role "user"
  export function guardarLeadWeb(db: SupabaseClient, visitante: string, lead: LeadInput): Promise<void>; // origen "web", sin duplicar por teléfono
  ```

- [ ] **Step 1: Tests que fallan.**
  - `pedido.test.ts`: acepta `{visitante: <uuid>, pagina:"ficha", slug:"vw-taos-2022", opcion:"financiar"}`, `{…, texto:"hola"}` y `{…, inicio:true}`. Rechaza (devuelve `null`): visitante `"x"`; `pagina:"inicio"`; `slug:"../etc/passwd"`; `opcion:"hack"`; `texto` de 501 caracteres o solo espacios; `texto` y `opcion` juntos; ninguno de `texto`/`opcion`/`inicio`; `null`, `"hola"`, `[]` como cuerpo. En catálogo `slug` debe ser `null`/ausente. El texto aceptado viene recortado (`trim`) y sin caracteres de control.
  - `limites.test.ts`: `evaluarLimite({visitante:0,global:0})` → `"ok"`; `({visitante:30,global:10})` → `"visitante"`; `({visitante:29,global:300})` → `"global"`.
  - `almacen.test.ts`: `guardarMensajesWeb` inserta una fila por mensaje con los campos de `FilaMensajeWeb` y el `visitante`; `cargarEstadoWeb` devuelve `null` sin fila y, con fila corrupta (`estado: "xx"`), devuelve un estado válido gracias a `normalizarSesion`; `contarMensajesWeb` filtra `role = 'user'` y `created_at >= desde` (y por visitante si se pasa); `guardarLeadWeb` inserta con `origen: "web"` y no inserta dos veces el mismo teléfono; todas lanzan `Error` con el mensaje de Supabase si la base falla.
- [ ] **Step 2:** Correr → FAIL. Implementar (el `guion` jsonb se normaliza igual que la sesión: lo inválido se descarta).
- [ ] **Step 3:** Tests en verde. Commit: `feat: validación, límites y almacén del chat web`.

### Task 6: Ruta `POST /api/chat`

**Files:**
- Create: `src/lib/bot/web/chat.ts` (lógica con dependencias inyectadas), `src/app/api/chat/route.ts`
- Test: `src/lib/bot/web/chat.test.ts`

**Interfaces:**
- Consumes: Tareas 3–5, `obtenerCatalogo` (`src/lib/bot/catalogo.ts`), `createBotSupabaseClient` (`src/lib/supabase`), `esRobot` (`src/lib/eventos.ts`).
- Produces:
  ```ts
  export type DepsChat = {
    catalogo(): Promise<VehiculoCatalogo[] | null>;
    cargarEstado(v: string): Promise<EstadoWeb | null>;
    guardarEstado(v: string, e: EstadoWeb): Promise<void>;
    guardarMensajes(v: string, filas: FilaMensajeWeb[]): Promise<void>;
    contar(desde: Date, visitante?: string): Promise<number>;
    guardarLead(v: string, l: LeadInput): Promise<void>;
    ahora(): Date; mid(): string; siteUrl: string; negocio: Negocio;
  };
  export function procesarChat(pedido: PedidoChat, deps: DepsChat): Promise<RespuestaChat>; // nunca lanza
  export const RESPUESTA_FALLA: (negocio: Negocio) => RespuestaChat; // texto fijo + cierre con botón de Marcos
  ```
  La ruta responde `200` con `RespuestaChat` en JSON; `400` si el pedido es inválido; `204` si es robot.

- [ ] **Step 1: Tests que fallan** (`chat.test.ts`, deps falsas):
  - Camino feliz con `opcion:"financiar"`: devuelve mensajes, guarda 1 fila `role "user"` (`via "opcion"`, `content "Quiero financiarlo"`, `vehiculo_slug` de la ficha) y las filas `assistant` con su `tipo`, y guarda el estado.
  - Texto libre: fila `user` con `via "texto"` y `nota "no_entendido"` cuando el orquestador marca `noEntendido`.
  - `inicio`: guarda solo las filas `assistant`.
  - Límite por visitante (`contar` devuelve 30 para el visitante): no llama al orquestador, devuelve un texto amable más un `cierre` con botón de Marcos, no guarda nada.
  - Límite global (`contar` devuelve 300 sin visitante): igual.
  - `catalogo()` devuelve `null` o lanza: devuelve `RESPUESTA_FALLA`, no lanza. `guardarEstado`/`guardarMensajes` lanzan: la respuesta igual se devuelve (se registra el error en consola).
  - `lead` no nulo → llama a `guardarLead`; si falla, la respuesta incluye igual el botón de Marcos.
  - Dos llamadas seguidas con el mismo visitante usan el estado guardado por la primera (el guion avanza de `anticipo` a `cuotas`).
- [ ] **Step 2:** Correr → FAIL. Implementar `procesarChat` y la ruta (`runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 10`): lee el cuerpo como texto, rechaza `> LIMITES.maxBytes`, valida con `validarPedidoChat`, arma `DepsChat` reales con `createBotSupabaseClient()` y `siteUrl: process.env.SITE_URL ?? new URL(request.url).origin`. Nunca devuelve detalles de errores al navegador.
- [ ] **Step 3:** Tests en verde. Commit: `feat: ruta /api/chat del asistente web`.

### Task 7: Estado del cliente (puro)

**Files:**
- Create: `src/components/asistente/estado.ts`
- Test: `src/components/asistente/estado.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Burbuja = { id: string; de: "cliente" | "asistente"; mensaje: MensajeWeb | { tipo: "texto"; texto: string } };
  export type EstadoChat = { abierto: boolean; burbujas: Burbuja[]; sugerencias: OpcionId[]; pendiente: boolean; saludado: boolean };
  export type AccionChat =
    | { tipo: "abrir" } | { tipo: "cerrar" }
    | { tipo: "enviar"; texto: string }               // agrega burbuja del cliente y pendiente = true
    | { tipo: "recibir"; respuesta: RespuestaChat }   // agrega burbujas del asistente, reemplaza sugerencias, pendiente = false
    | { tipo: "fallo"; negocio: { whatsappUrl: string } }; // burbuja fija con link a Marcos, pendiente = false
  export function reducirChat(e: EstadoChat, a: AccionChat): EstadoChat;
  export const estadoInicial: EstadoChat;
  export function serializarChat(e: EstadoChat): string;
  export function leerChatGuardado(raw: string | null): EstadoChat | null; // valida la forma; null si no sirve
  export function guardarChatEnSesion(storage: Pick<Storage, "setItem">, e: EstadoChat): void;   // atrapa errores
  export function cargarChatDeSesion(storage: Pick<Storage, "getItem">): EstadoChat | null;       // atrapa errores
  export function globoYaMostrado(storage: Pick<Storage, "getItem">): boolean;
  export function marcarGloboMostrado(storage: Pick<Storage, "setItem">): void;
  ```
  Claves de `sessionStorage`: `posse_chat` y `posse_chat_globo`.

- [ ] **Step 1: Tests que fallan:** `enviar` agrega la burbuja y pone `pendiente: true`; **un segundo `enviar` con `pendiente: true` se ignora** (estado idéntico); `recibir` agrega burbujas, reemplaza las sugerencias y apaga `pendiente`; `fallo` agrega el aviso y apaga `pendiente`; `abrir`/`cerrar` solo cambian `abierto`; `leerChatGuardado("basura")` y `leerChatGuardado(null)` → `null`; ida y vuelta `leerChatGuardado(serializarChat(e))` igual a `e` (con `abierto: false`, y con `pendiente: false` siempre); `guardarChatEnSesion` y `cargarChatDeSesion` no lanzan con un `storage` cuyos métodos lanzan; `globoYaMostrado` es `false` hasta `marcarGloboMostrado` y no lanza con storage roto (devuelve `true` para no insistir).
- [ ] **Step 2:** Correr → FAIL. Implementar. **Step 3:** verde. Commit: `feat: estado del chat del lado del navegador`.

### Task 8: Interfaz del asistente y montaje

**Files:**
- Create: `src/components/asistente/asistente.tsx` (entrada, `"use client"`), y los archivos de apoyo que convengan en `src/components/asistente/` (lanzador, globo, ventana, burbujas, tarjeta de auto, chips)
- Modify: `src/app/vehiculos/[slug]/page.tsx`, `src/app/catalogo/page.tsx` (reemplazar `<FloatingWhatsApp />` por `<Asistente … />`)
- Modify: `src/components/rastreador.tsx`

**Interfaces:**
- Consumes: Tarea 6 (`POST /api/chat`), Tarea 7 (`reducirChat`, almacenamiento), `registrarEvento` (`src/lib/rastreo.ts`), `public/icons/botlogo.png`.
- Produces: `export function Asistente(props: { pagina: Pagina; slug?: string | null }): JSX.Element`. Todo link a WhatsApp dentro del chat va dentro de un contenedor con el atributo `data-asistente`.

- [ ] **Step 1:** Implementar la interfaz según spec 4.1 y 4.2 y la muestra aprobada (botón flotante con el robot y punto verde, globo, ventana con encabezado "Asistente de Posse Automotores" / "En línea", robot chiquito junto a cada burbuja del asistente, chips, campo de texto, tarjeta de auto con foto, burbuja de cierre con "Enviar por WhatsApp", pie con link a `/privacidad`, indicador "escribiendo"). Colores y tipografía del sitio (`car-gold`, `car-black`, `car-gray2`, `font-condensed`). Imagen del robot con `next/image` sobre `/icons/botlogo.png` (con `sizes` chico, círculo, `object-fit: cover` y `object-position` para que se vea la cabeza; ajustar visualmente hasta que ojos y sonrisa se reconozcan a 42 px). Nada del chat ni la imagen se carga hasta el primer toque (componente de la ventana con `next/dynamic`). Al montar, restaura el chat con `cargarChatDeSesion`; el globo sale a los ~6 s si `!globoYaMostrado` y no está abierto.
- [ ] **Step 2:** Comportamiento: la primera apertura en la pestaña manda `{ inicio: true }`; cada mensaje manda `visitante` (el id de `posse_vid` de `localStorage`, o uno temporal por sesión si está bloqueado), `pagina`, `slug` y `texto` u `opcion`. Mientras `pendiente` los chips y el envío quedan inactivos. Ante red caída o respuesta inválida, `fallo` con el link de Marcos (`buildWhatsAppUrlWeb(null)`). `Esc` cierra; en celular la ventana ocupa casi toda la pantalla con "cerrar" siempre visible; en compu mide ~380 px abajo a la derecha. Accesibilidad: `role="dialog"` con `aria-label`, la lista de mensajes con `aria-live="polite"`, foco al campo de texto al abrir y de vuelta al botón al cerrar.
- [ ] **Step 3:** `rastreador.tsx`: al tocar un link `wa.me` dentro de `[data-asistente]`, además del `whatsapp` existente, registrar `chat_whatsapp` (con el mismo `deEsteAuto`). `Asistente` registra `chat_abrio` una vez por pestaña al abrirse (clave de `sessionStorage` propia).
- [ ] **Step 4:** Montar `<Asistente pagina="ficha" slug={v.slug} />` y `<Asistente pagina="catalogo" />`, y quitar el import de `FloatingWhatsApp` de esas dos páginas (se mantiene en las demás).
- [ ] **Step 5: Verificación en el navegador** (`preview_start`, con `SITE_URL` y las variables de Supabase del `.env.local`; si las tablas `web_*` todavía no existen, el chat debe mostrar igual el aviso con el botón de Marcos): en ancho 375 px y en escritorio, abrir/cerrar; el globo sale una sola vez; las cuatro opciones de la ficha llegan a un `wa.me` cuyo texto coincide con el mostrado; texto `bmw` muestra tarjeta con foto; recargar restaura la conversación; ir de ficha en ficha avisa "Ahora estás mirando"; sin scroll horizontal; el botón verde de las cards y "Simular mi financiación" siguen funcionando; en la pestaña de red aparecen `chat_abrio` y `chat_whatsapp`. Correr `npm run lint` y `npx tsc --noEmit`.
- [ ] **Step 6: Commit** `feat: asistente de chat en la ficha y el catálogo`.

### Task 9: Datos y resumen del admin (puros y lectores)

**Files:**
- Create: `src/lib/bot/web/estadisticas.ts`
- Modify: `src/lib/bot-datos.ts`, `src/lib/conversaciones.ts` (solo si hace falta exportar el helper de día en hora argentina que usa `resumirBot`)
- Test: `src/lib/bot/web/estadisticas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MensajeWebFila = { visitante: string; role: "user" | "assistant"; content: string; tipo: "texto" | "tarjetas" | "cierre"; vehiculo_slug: string | null; nota: string | null; created_at: string };
  export type EventoChat = { tipo: TipoEvento; ruta: string; vehiculo_slug: string | null; visitante: string | null; creado: string };
  export type ResumenBotWeb = {
    embudo: { vieronPagina: number; abrieron: number; interactuaron: number; armaronMensaje: number; tocaronWhatsapp: number };
    conversaciones: number; mensajesPorConversacion: number | null; dejaronDatos: number;
    autosMasConsultados: Array<{ slug: string; conversaciones: number }>;
    noEntendidos: Array<{ texto: string; veces: number }>;   // top 10, mismo texto normalizado
    comparacion: { simulaciones: number; mensajesArmados: number; toquesWhatsappChat: number };
    porDia: Array<{ dia: string; etiqueta: string; personas: number }>;
  };
  export function resumirBotWeb(a: { mensajes: MensajeWebFila[]; eventos: EventoChat[]; leadsWeb: number; dias: number; ahora: string }): ResumenBotWeb;
  export function armarConversacionesWeb(mensajes: MensajeWebFila[], conDatos: Set<string>): ConversacionResumen[]; // nombre "Visitante", más recientes primero
  // bot-datos.ts
  export type DatosWeb = { mensajes: MensajeWebFila[]; eventos: EventoChat[]; leadsWeb: number; truncado: boolean };
  export function cargarDatosWeb(db: SupabaseClient, dias: number): Promise<DatosWeb>;
  export function traerChatWeb(db: SupabaseClient, visitante: string): Promise<MensajeWebFila[]>;
  ```

- [ ] **Step 1: Tests que fallan:** embudo — 3 visitantes con `visita` a `/vehiculos/x` o `/catalogo`, 2 con `chat_abrio`, 1 con mensaje `user`, 1 con mensaje `tipo "cierre"`, 1 con `chat_whatsapp` → `{vieronPagina:3, abrieron:2, interactuaron:1, armaronMensaje:1, tocaronWhatsapp:1}` (cuenta personas distintas, no eventos; una visita a `/` o `/financiacion` no cuenta en `vieronPagina`); `conversaciones` = visitantes con algún mensaje `user`; `mensajesPorConversacion` = promedio de mensajes del cliente (o `null` sin conversaciones); `autosMasConsultados` cuenta conversaciones distintas por slug, de mayor a menor; `noEntendidos` agrupa textos iguales sin mayúsculas ni espacios de más; `comparacion` toma simulaciones de `eventos.tipo "simulacion"`; el corte del período usa el día argentino como `resumirBot`; sin datos, todo en 0/`null`/listas vacías y `porDia` con un elemento por día. `armarConversacionesWeb`: una por visitante, `nombre "Visitante"`, `dejoDatos` según el set, ordenadas por último mensaje.
- [ ] **Step 2:** Correr → FAIL. Implementar las funciones puras y los lectores de `bot-datos.ts` (paginado y con tope como `traerMensajes`; los eventos se leen de `eventos` con `tipo in ('visita','chat_abrio','chat_whatsapp','simulacion')` desde `haceDias(dias + 1)`; los leads con `origen = 'web'`).
- [ ] **Step 3:** Verde. Commit: `feat: resumen y conversaciones del bot de la página para el admin`.

### Task 10: Pantallas del admin

**Files:**
- Modify: `src/app/admin/conversaciones/page.tsx`, `src/app/admin/conversaciones/[id]/page.tsx`, `src/components/lista-conversaciones.tsx`, `src/app/admin/estadisticas/page.tsx` (y `src/components/estadisticas-vista.tsx` si hace falta)
- Create: `src/components/resumen-bot-web.tsx`

**Interfaces:**
- Consumes: Tarea 9. Produces: `export function ResumenBotWebVista(props: { resumen: ResumenBotWeb; titulo: string; verConversaciones?: boolean }): JSX.Element`; `ListaConversaciones` gana la prop opcional `canal?: "instagram" | "web"` (por defecto `"instagram"`) que se agrega a los links (`&canal=web`, y los links de detalle pasan a `/admin/conversaciones/<id>?canal=web`).

- [ ] **Step 1:** `/admin/conversaciones`: arriba dos pestañas "Instagram" / "Página web" (`?canal=`, por defecto Instagram; conservan `dias` y `filtro`). En "Página web": `ResumenBotWebVista` (embudo, conversaciones, mensajes por conversación, dejaron datos, autos más consultados, lo que no entendió, la línea de comparación con el simulador, personas por día) y `ListaConversaciones` con `armarConversacionesWeb`. Si la lectura falla (por ejemplo tablas sin crear), el cuadro de error rojo existente, no una excepción. El texto al pie aclara que es solo lectura. El filtro "Postulaciones" no aplica a la web: ocultarlo en esa pestaña.
- [ ] **Step 2:** Detalle: `/admin/conversaciones/[id]?canal=web` valida el id con `^[A-Za-z0-9-]{8,64}$`, lee `traerChatWeb`, muestra "Visitante", auto consultado (último `vehiculo_slug`), cantidad de mensajes, etiqueta "Dejó sus datos (ver en Leads)" si corresponde y reutiliza `ChatConversacion` (adaptando las filas a `MensajeIg`). No muestra `EnviarCardAuto`. Sin `canal`, el comportamiento de Instagram no cambia.
- [ ] **Step 3:** `/admin/estadisticas`: un bloque corto "Bot de la página" con los números principales y el link "Ver las conversaciones" (`?canal=web`), debajo del bloque del bot de Instagram.
- [ ] **Step 4: Verificación:** `npm run build` sin errores; en el navegador, `/admin/conversaciones` (Instagram igual que antes), `?canal=web` con datos y sin datos (estado vacío legible), detalle web, y `/admin/estadisticas`; ancho 375 px sin scroll horizontal. Si hay Supabase de prueba con el script de la Tarea 1 corrido, generar una conversación real desde la ficha y comprobar que aparece y suma en el embudo.
- [ ] **Step 5: Commit** `feat: conversaciones y estadísticas del bot de la página en el admin`.

### Task 11: Privacidad, documentación y verificación final

**Files:**
- Modify: `src/app/privacidad/page.tsx`
- Create: `docs/asistente-web.md`

- [ ] **Step 1:** Agregar a `/privacidad` un párrafo sobre el asistente: qué se guarda (lo que se escribe en el chat, las respuestas, el auto consultado, un número al azar de visitante y, solo si la persona lo da, nombre y teléfono), para qué (atenderla y mejorar el asistente) y que se borra a los 90 días.
- [ ] **Step 2:** Crear `docs/asistente-web.md` (corto, para el dueño): los pasos manuales de puesta en marcha — (1) correr `supabase/schema-web-bot.sql` en el SQL Editor de Supabase **antes** de publicar; (2) confirmar que `SITE_URL` está en Vercel; (3) opcional: programar `select limpiar_web_viejos();` con pg_cron o correrla a mano cada tanto — y cómo leer las estadísticas del bot de la página.
- [ ] **Step 3: Verificación final:** `npm run lint`, `npm test` (todo, incluido el bot de Instagram), `npm run build`, todos en verde; repetir el recorrido de la Tarea 8 (celular y compu) con las tablas creadas y comprobar de punta a punta: conversación en la ficha → aparece en el admin → suma en el embudo; el botón verde de las cards, el simulador y el botón flotante del resto de las páginas siguen igual.
- [ ] **Step 4: Commit** `feat: privacidad y guía de puesta en marcha del asistente web`.

---

## Autorevisión

- **Cobertura de la spec:** 4.1–4.3 → Tareas 7–8; 5.1 → 3, 4, 6, 8; 5.2 → 1, 5; 5.3 → 2; 5.4 → 1, 8; 6.1–6.2 → 9–10; 7 → 5, 6, 11; 8 (criterio de terminado) → verificaciones de 8, 10 y 11; 9 (decisiones) → 3 (guiones), 4 (regla del guion pendiente, cambio de ficha), 5 (límites global y por visitante), 7 (persistencia en `sessionStorage`), 8 (globo una vez por pestaña). El item "Retención de 90 días" → SQL de la Tarea 1 y texto de la Tarea 11.
- **Consistencia de nombres:** `OpcionId`, `MensajeWeb`, `TarjetaWeb`, `RespuestaChat`, `EntradaChat`, `Guion`, `EstadoWeb`, `PedidoChat`, `FilaMensajeWeb`, `MensajeWebFila` y `ResumenBotWeb` se definen una sola vez (Tareas 3, 4, 5 y 9) y las tareas posteriores los consumen con los mismos nombres. `FilaMensajeWeb` (lo que se guarda, Tarea 5) y `MensajeWebFila` (lo que se lee con fecha, Tarea 9) son distintos a propósito.
