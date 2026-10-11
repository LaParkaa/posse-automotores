# Bot de Instagram por reglas (sin modelo de IA) — Diseño

Fecha: 2026-10-11

**Reemplaza** la capa de IA del diseño `2026-10-06-bot-instagram-design.md` (Claude, y despues Groq). De ese diseño **se reutiliza** todo lo demas: webhook, firma de Meta, envio por Graph API, deduplicacion por `mid`, guardado de leads, panel `/admin/leads`, tablas `ig_mensajes` y `leads`.

## 1. Evidencia: lo que muestran los chats reales

Capturas de conversaciones de la cuenta (septiembre-octubre 2026):

1. Instagram ya manda un mensaje automatico generico ("Posse Automotores recibio tu mensaje. En minutos recibiras nuestra respuesta...") y despues hay **horas de silencio**; el dueño abre con "disculpa no me habia visto tu mensaje". **Ahi se pierden clientes.**
2. **La mayoria de las consultas son respuestas a una historia** ("Respondio a la historia de @Posse Automotores") sobre un auto concreto, sin nombrarlo: "me decis el precio?", "hola que valor tiene?". La historia muestra un texto superpuesto (ej. "206 1.6 Modelo: 2010 177.000 kilometros").
3. Preguntan por **autos ya vendidos** ("esa es la que habia visto" → "esa se vendio") y pasan a pedir algo parecido ("algun utilitario asi?").
4. **Escriben coloquial**: "chatita", "me pasas mas info del 206", "algun utilitario asi?".
5. Mandan **audios y fotos**, y a veces piden una persona ("hablo con el dueño?"); el dueño los deriva a un vendedor (Marcos).
6. **El dueño tambien contesta a mano**: el bot no puede pisarlo.
7. El dueño informa el precio **en pesos** por el chat ("y esta en $9,500.000").

## 2. Objetivos y no-objetivos

**Objetivos (Etapa 1)**
- Responder en segundos, 24 h, sin costo por mensaje y **sin inventar datos** (todo sale del catalogo real).
- Entender palabras clave coloquiales (con errores de tipeo) y mantener una conversacion de varios turnos.
- Detectar respuestas a historias e identificar el auto.
- Conocer los autos vendidos y reservados ("ese ya se vendio" + alternativas).
- Responder precio, info del auto, financiacion, permuta, pagos, horarios, ubicacion, garantia, documentacion.
- Derivar a una persona y **callarse cuando el dueño contesta a mano**.
- Captar leads (nombre + telefono) en `/admin/leads`.
- Manejar audios, fotos y emojis sin trabarse.

**No-objetivos (Etapa 2 o despues)**
- Leer automaticamente el texto de la imagen de la historia (OCR).
- Reconocer reels/posts compartidos, transcribir audios, reconocer fotos.
- Filtrar por **presupuesto** (hoy `precio_texto` es texto libre: "USD 9.500", "$9.500.000", "Consulta"). Se guarda lo que diga el cliente en el lead. Requiere un campo numerico de precio en el panel o un parseo confiable.
- Panel de conversaciones, aviso externo de leads, seguimientos proactivos, estadisticas por historia.

## 3. Decisiones del dueño

1. **Sin IA con modelo**: motor de reglas (palabras clave + estado de conversacion).
2. **Historias**: si el cliente nombra el auto, se toma directo; si no, **se pregunta una vez cual es y se recuerda** la respuesta para esa historia (los siguientes clientes de la misma historia se resuelven solos).
3. **Precios**: se informa lo que este en el campo precio del auto. Si dice "Consulta..." o esta vacio: lo confirma un vendedor, se pide nombre y telefono y queda en Leads.
4. **Derivacion a una persona**: se da el WhatsApp del local (+54 9 3537 55-8947).
5. **Aviso de leads**: solo panel `/admin/leads` (sin notificacion externa).
6. Hosting Vercel, base Supabase (sin cambios).

## 4. Flujo

`POST /api/instagram/webhook` → validar firma → extraer eventos (mensajes de cliente y ecos) → por cada evento:

- **Eco** (mensaje enviado desde la cuenta): esperar ~3 s y comprobar si su `mid` es de un mensaje que mando el bot. Si **no** lo es, lo mando una persona → **pausar el bot** en ese chat (default 6 h, configurable en `negocio.ts`).
- **Mensaje de cliente**: deduplicar por `mid` → si el chat esta pausado, solo registrar → cargar sesion + catalogo → `conversar()` (motor puro) → guardar sesion → (lead / aprendizaje de historia) → enviar → registrar los `mid` enviados → `200`.

Con firma valida siempre se responde 200. No hay llamadas a modelos: la respuesta tarda lo que tardan Supabase y la Graph API.

## 5. Componentes

**Modificar**
- `src/lib/instagram/payload.ts`: devuelve eventos tipados: `mensaje` (`senderId`, `mid`, `texto|null`, `historiaId?`, `adjuntos: string[]` con los `type`) y `eco` (`destinatarioId`, `mid`). Hoy descarta los ecos; pasan a conservarse. Historia: `message.reply_to.story.id`.
- `src/lib/instagram/graph.ts`: `enviarMensajeInstagram` devuelve los `message_id` de cada parte enviada; nueva `obtenerPerfil(igsid)` → `{ nombre?, usuario? }` (mejor esfuerzo; si falla, el bot sigue sin nombre).
- `src/lib/bot/handler.ts`, `deps.ts`: reescritos para el flujo de arriba (siguen con dependencias inyectadas y testeables).
- `src/lib/bot/conversations.ts`: queda la deduplicacion y el registro; se agrega guardar mensajes del bot **con su `mid`** y `esMensajePropio(mid)`. El historial para el modelo deja de usarse.
- `src/lib/bot/stock.ts`: pasa a `obtenerCatalogo(db)`: vehiculos `disponible`, `reservado` y `vendido` (ultimos ~60 vendidos), solo columnas publicas, sin precios de venta ni notas internas.
- `src/app/api/instagram/webhook/route.ts`: pasa ecos al handler.

**Nuevos (puros, sin red ni base de datos)**
- `src/lib/bot/nlu/normalizar.ts`: minusculas, sin tildes ni signos, colapsa letras repetidas ("holaaa"), tokens.
- `src/lib/bot/nlu/vocabulario.ts`: marcas, modelos y tokens de nombre tomados **del catalogo en cada mensaje** (un auto nuevo se reconoce solo) + diccionarios fijos y editables: tipos (auto, moto, camioneta, pick-up, utilitario, SUV, sedan...), combustibles, transmision y **sinonimos regionales** ("chatita"→utilitario, "pickup"/"pick up", "automatico"/"at"...).
- `src/lib/bot/nlu/intenciones.ts`: puntaje por palabras clave, con tolerancia a errores de tipeo (distancia de edicion 1 en palabras de 4-7 letras, 2 en las de 8+). Intenciones: saludo, cortesia ("como estas"), gracias/despedida, precio, info del auto, disponibilidad/catalogo, financiacion, permuta, formas de pago, horarios, ubicacion, garantia, documentacion, humano ("dueño", "vendedor", "persona"), afirmacion, negacion, "ver mas", "avisame".
- `src/lib/bot/nlu/entidades.ts`: filtros (marca, modelo, tipo, combustible, transmision, año) y referencias ("el 206", "ese", "el segundo", "el ultimo").
- `src/lib/bot/busqueda.ts`: filtra y ordena; si no hay coincidencia exacta **relaja filtros** ("no tengo X, pero tengo Y") y ofrece "te aviso cuando entre".
- `src/lib/bot/respuestas.ts`: plantillas rioplatenses con variantes, formato de vehiculo (año, km, combustible, transmision, precio, link), maximo 3 autos y 1000 bytes por mensaje, maximo 3 mensajes por turno.
- `src/lib/bot/negocio.ts`: **unico archivo editable** con horarios, pagos, financiacion, permutas, garantia, documentacion, ubicacion, WhatsApp, horas de pausa. Lo que no este confirmado queda marcado `PENDIENTE` y el bot responde "te lo confirma un vendedor" en lugar de inventar.
- `src/lib/bot/sesion.ts`: tipo `Sesion` y vigencia (24 h sin actividad reinicia el contexto).
- `src/lib/bot/motor.ts`: `conversar(entrada) → { mensajes, sesion, lead?, aprendizajeHistoria?, notaNoEntendido? }`. Funcion pura: la maquina de estados.

**Se elimina**: `src/lib/bot/ai.ts`, `prompt.ts` (parte del modelo; `EMPRESA` pasa a `negocio.ts`), y su manejo de variables `LLM_*`/`ANTHROPIC_*`.

## 6. Datos (Supabase)

Migracion nueva `supabase/schema-instagram-reglas.sql` (todas con RLS activa y sin politicas: solo `service_role`):

- `ig_sesiones(ig_user_id text primary key, estado jsonb not null, pausa_hasta timestamptz, perfil jsonb, actualizado timestamptz not null default now())`.
- `ig_historias(story_id text primary key, vehiculo_id uuid references vehiculos_posse(id), confirmaciones int not null default 1, creado timestamptz default now(), actualizado timestamptz default now())`.
- `alter table ig_mensajes add column if not exists nota text` (marca `no_entendido` para ir mejorando el diccionario con trafico real).

Forma de `estado` (sesion): `filtros`, `vehiculoActual`, `mostrados[]` (para "el segundo"), `pagina` (para "ver mas"), `paso` (`libre` | `pidiendo_nombre` | `pidiendo_telefono` | `eligiendo_historia`), `lead{nombre,telefono,vehiculoId}`, `preguntaPendiente`, `historiaPendiente`, `fallos`, `saludado`, `ultimaActividad`.

## 7. Comportamiento clave

**Respuesta a una historia**
1. Si `ig_historias` conoce la historia → ese es el auto. Si esta vendido: "ese ya se vendio" + parecidos (mismo tipo/marca). Si esta reservado: lo dice y ofrece avisar.
2. Si no la conoce pero el texto nombra un solo auto del catalogo ("del 206") → se responde ese auto y se **aprende** la historia.
3. Si no: "¿Por cual auto de la historia me escribis?" con los ultimos 5 cargados numerados + "otro". Se guarda la pregunta del cliente (`preguntaPendiente`). Cuando elige (numero o nombre) se **aprende** la historia y se responde la pregunta original.
4. Si despues de identificarlo el cliente dice que no es ese, se invalida el vinculo y se vuelve a preguntar (corrige errores de aprendizaje).

**Precio / info**: usa `vehiculoActual`; sin auto en contexto, pregunta cual. Precio vacio o "Consulta" → vendedor + captacion de lead.

**Captacion de lead**: ante interes (quiere verlo, financiacion, precio sin cargar, "avisame") pide nombre y luego telefono (valida largo y digitos; "cancelar" sale), guarda en `leads` (origen instagram, con `@usuario` cuando se pudo obtener el perfil) y confirma. Si falla el guardado, **no confirma**: deriva al WhatsApp del local.

**Derivacion**: "dueño/vendedor/persona" → WhatsApp del local y ofrece dejar datos.

**No entendido**: una vez, repregunta con ejemplos; dos seguidas, ofrece menu corto y el WhatsApp. Se marca `nota = no_entendido`.

**No texto**: audio → "no puedo escuchar audios por aca, ¿me lo escribis?"; foto/adjunto → pide que cuente que auto busca. Solo emojis sin contexto (por ejemplo una reaccion a una historia) → **no se responde**; dentro de una conversacion un 👍 cuenta como afirmacion.

**Tono**: español rioplatense, calido, 1-2 emojis, maximo 4-5 lineas por mensaje, saluda por el nombre si el perfil lo trae. Las variantes de texto se eligen de forma determinista (semilla = `mid`) para que los tests sean estables.

## 8. Pruebas

- **Unitarias** de normalizar, vocabulario, intenciones, entidades, busqueda y respuestas.
- **Conversaciones doradas** (tabla de escenarios: mensajes del cliente → respuesta esperada y sesion resultante) sobre un catalogo de ejemplo, **incluyendo los chats reales**: Partner vendida + "algun utilitario asi?", historia 208 + "me decis el precio?", Vento + "que valor tiene?", 206 + "me pasas mas info del 206", "hablo con el dueño?", audio, foto, "chatita".
- Handler con dependencias falsas: dedupe, pausa por eco propio vs. humano, fallos de Supabase/Graph (siempre 200), lead que falla → no confirma.
- Manual: `curl` firmado contra `next dev` y una prueba real con una cuenta con rol en la app.

## 9. Operacion y supuestos a validar con trafico real

**Hay que hacer a mano**
- **Apagar la respuesta automatica de Instagram** ("respuesta instantanea"/saludo automatico): si no, el cliente recibe dos mensajes.
- Ejecutar la migracion nueva en Supabase.
- Completar `negocio.ts` (horarios, financiacion, etc.).
- Configurar Meta y las variables de Vercel (`IG_VERIFY_TOKEN`, `IG_APP_SECRET`, `PAGE_ACCESS_TOKEN`, `SITE_URL`). Ya **no** hacen falta `ANTHROPIC_API_KEY` ni `LLM_*`.

**Verificado en la documentacion de Meta**: las respuestas a historias traen `message.reply_to.story.{id,url}` dentro de `entry[].messaging[]`; los adjuntos traen `type` (`audio`, `image`, `share`, `ig_post`, `ig_reel`, `story_mention`...); los mensajes enviados desde la cuenta llegan con `is_echo: true`.

**A validar en las primeras pruebas reales** (no pude confirmarlo en la documentacion): que los ecos llegan por el campo `messages` y si traen `app_id`; que la API de perfil devuelve `name` y `username` con el permiso actual; como llega la reaccion a una historia; que el tiempo de espera de ~3 s para clasificar un eco alcanza. El motor registra los tipos de evento desconocidos en los logs para ajustar rapido.

## 10. Riesgos y limites

- Entiende palabras clave y frases cortas, **no** charla libre: cuando no entiende, repregunta y deriva. El diccionario mejora con el uso real (`nota = no_entendido`).
- El aprendizaje de historias puede equivocarse si el primer cliente elige mal; la negacion lo corrige. Etapa 2: panel para corregir.
- Dos mensajes simultaneos del mismo cliente pueden pisar la sesion (ultimo guardado gana); se acepta por baja frecuencia.
- Las sesiones guardan nombre y telefono: tablas privadas (RLS sin politicas); definir una purga (p. ej. 90 dias) cuando haya volumen.

## 11. Etapas

- **Etapa 1**: todo lo de las secciones 5 a 9.
- **Etapa 2**: lectura automatica de historias (OCR), reels/posts compartidos, presupuesto numerico, panel de conversaciones y de historias, estadisticas, "visto/escribiendo".
