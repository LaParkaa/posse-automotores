# Bot de Instagram (migración desde WhatsApp) — Diseño

> **Reemplazado en lo referido a la IA por** docs/superpowers/specs/2026-10-11-bot-reglas-instagram-design.md (el bot ahora funciona por reglas, sin modelo de IA).

Fecha: 2026-10-06

## Objetivo

Reemplazar el bot de `whatsapp-web.js` (`whatsapp-bot/`) por un webhook serverless de Instagram DM dentro del Next.js existente (Vercel). El bot responde consultas, consulta el stock real y capta leads, gastando la menor cantidad de tokens posible.

## Decisiones

- **Hosting:** ruta de App Router en el Next.js actual, desplegado en Vercel. No se crea otro servicio.
- **Stock:** estado `'disponible'` de `vehiculos_posse` (no existe `'DISP'`; el bot viejo leía la tabla equivocada, `vehiculos`). Se inyecta compacto en el system prompt. **Una sola llamada al modelo por mensaje**, sin loop de herramientas.
- **IA:** proveedor con plan gratis vía API compatible con OpenAI (Groq por defecto), configurable con `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`. Reemplaza a Claude por costo. Los modelos chicos siguen peor las instrucciones: el handler ya deriva al WhatsApp cuando la IA falla o se acaba la cuota.
- **Leads:** herramienta `guardar_lead`, ejecutada sin segunda llamada al modelo. Se guardan en `leads` con `origen = 'instagram'` y se ven en `/admin/leads`. Sin aviso externo (decisión del usuario).
- **Derivación a humano:** el bot entrega el WhatsApp del local (+54 9 3537 55-8947).
- **Estado:** historial y deduplicación en Supabase. La memoria en RAM de `sessionStore.js` no sirve en serverless.
- **Limpieza:** `whatsapp-bot/` se elimina en un commit aparte cuando Instagram esté probado.

## Archivos

| Archivo | Rol |
|---|---|
| `src/app/api/instagram/webhook/route.ts` (nuevo) | `GET` verificación `hub.challenge`; `POST` mensajes |
| `src/lib/instagram/payload.ts` (nuevo) | Extrae `sender.id`, `text`, `mid` de `entry[].messaging[]`; ignora ecos y no-texto |
| `src/lib/instagram/signature.ts` (nuevo) | Valida `X-Hub-Signature-256` (HMAC SHA-256, `IG_APP_SECRET`, body crudo) |
| `src/lib/instagram/graph.ts` (nuevo) | `enviarMensajeInstagram()` → `POST graph.facebook.com/v21.0/me/messages` con `PAGE_ACCESS_TOKEN`; parte textos > 1000 caracteres |
| `src/lib/bot/stock.ts` (nuevo) | Lee y compacta vehículos disponibles |
| `src/lib/bot/ai.ts` (nuevo) | Llamada única a un modelo vía API compatible con OpenAI (Groq por defecto), herramienta `guardar_lead` |
| `src/lib/bot/conversations.ts` (nuevo) | Historial (~10 mensajes) y dedupe por `mid` |
| `src/lib/bot/types.ts` (nuevo) | Tipos compartidos del bot |
| `src/lib/bot/prompt.ts` (nuevo) | Datos de la empresa y system prompt |
| `src/lib/bot/leads.ts` (nuevo) | Guardado de leads de Instagram (evita duplicados) |
| `src/lib/bot/handler.ts` (nuevo) | Orquestación del flujo por mensaje, con dependencias inyectadas (testeable) |
| `src/lib/bot/deps.ts` (nuevo) | Cableado real de dependencias (Supabase, modelo de IA, Graph API) |
| `supabase/schema-instagram.sql` (nuevo) | Tabla `ig_mensajes`; `leads` + `origen`, `instagram_id`; `whatsapp` nullable |
| `src/app/admin/leads/page.tsx` (modif.) | Mostrar origen/ID para leads de Instagram |
| `package.json`, `.env.example` (modif.) | `IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `PAGE_ACCESS_TOKEN`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `SITE_URL` |

## Flujo

`POST` → validar firma → extraer mensajes de texto → dedupe por `mid` → cargar historial + stock → 1 llamada al modelo → (si `guardar_lead`: insertar en `leads`, reusar el texto de la misma respuesta o una confirmación fija) → enviar por Graph API → guardar turno → `200`.

## Errores

- `GET` con token incorrecto: 403. `POST` con firma inválida: 401.
- Con firma válida siempre se responde 200 (evita reintentos en bucle de Meta); el error se loguea.
- `try/catch` por mensaje; uno que falle no afecta al resto del lote.
- Fallo al leer stock: el bot dice que no puede confirmar disponibilidad; no inventa autos.
- Adjuntos: respuesta fija, sin llamar al modelo.

## Testing

Vitest: extracción de payload, firma HMAC, partido de mensajes largos, formato del stock. Manual: `curl` contra `next dev` y herramienta de prueba de webhooks de Meta.

## Límites de Meta (fuera de código)

Sin App Review el bot solo responde a cuentas con rol en la app. Solo se puede responder dentro de las 24 h posteriores al último mensaje del cliente. Requiere cuenta profesional de Instagram vinculada a una página de Facebook y suscripción al campo `messages`.
