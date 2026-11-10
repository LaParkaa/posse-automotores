# Asistente de la página (chat con el robot de Posse) — Diseño

Fecha: 2026-11-09

## 1. Por qué

Los números de los últimos 7 días (panel admin, estadísticas): **397 visitas** (254 del sitio + 143 de anuncios de Instagram), **75 visitantes distintos**, **3 consultas por WhatsApp (4 %)** y **11 simulaciones de financiación**. La gente entra, mira autos (Taos 8 visitas, Ranger 8) y casi nadie escribe.

Lo que se sabe del sitio hoy:

- Los botones de WhatsApp **ya están** y se ven: uno en cada card del catálogo y dos en la ficha (arriba y en el recuadro de precio), con el mensaje armado con el nombre del auto. El problema no es que no los encuentren.
- El botón verde flotante es genérico ("quiero consultar un vehículo") y en la ficha compite con el botón dorado "Simular mi financiación", que va primero.
- El simulador sí convierte (11 contra 3), pero **el contador de "consultas por WhatsApp" no cuenta lo que sale del simulador** (solo toques directos a links `wa.me`): las consultas reales probablemente son más que 3.
- Hipótesis del dueño y mía: mucha gente no sabe qué escribir. Una pregunta concreta ("¿querés saber si podés financiarlo?") y respuestas para tocar bajan esa barrera.
- Ya existe un **bot de Instagram por reglas** (sin modelo de IA, decisión del 2026-10-11) con un motor puro `conversar()` que responde precio, info, financiación, permuta, horarios, etc. sin inventar datos. Reutilizarlo en la web es barato y da respuestas iguales en los dos canales.

Próximo paso del negocio: el dueño va a grabar un tutorial corto después de cada anuncio de auto (catálogo y fichas) para traer más gente a la página. El asistente es lo que convierte esa gente en consultas.

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Subir las consultas por WhatsApp a Marcos desde la página, sin bajar las simulaciones.
- Un asistente de chat en la **ficha de cada auto** y en el **catálogo**, con el robot de Posse como cara, que contesta al instante, muestra autos como cards y termina siempre en WhatsApp con el mensaje ya armado.
- Que el dueño vea **qué le preguntan al asistente y cuánto lo usan**: conversaciones y estadísticas del bot de la página en el admin, al lado de las del bot de Instagram.

**No-objetivos**
- No se usa un modelo de IA (cero costo por mensaje, no inventa datos). Si más adelante se quiere, es un proyecto aparte.
- No va en el inicio (`/`), ni en financiación, vendidos, lavadero ni privacidad: ahí queda el botón flotante de WhatsApp actual.
- No se toca el simulador de financiación ni el bot de Instagram (salvo lo mínimo compartido de la sección 5.3).
- No se arregla en este proyecto el conteo de consultas del simulador (ver sección 10, es una mejora aparte).
- El admin no responde dentro del chat de la web: la pantalla es de solo lectura, como la de Instagram.

**Anti-objetivos (sería un fracaso aunque "funcione")**
- Que el asistente **diga algo falso** (precio, disponibilidad, condiciones). Todo sale del catálogo real y de `negocio.ts`; lo no confirmado se deriva a Marcos.
- Que el chat **frene** a quien ya iba a escribir: el WhatsApp directo y el simulador tienen que seguir a un toque.
- Que **tape contenido** o moleste en el celular (la mayoría del tráfico viene de Instagram).
- Que **finja ser una persona**: el robot es un asistente automático y lo dice si le preguntan.
- Que un emoji u otro carácter rompa el link de WhatsApp en el navegador de Instagram (ya pasó: los links `wa.me` no llevan emojis).

## 3. Decisiones del dueño

1. **Dónde:** ficha de cada auto y catálogo. No en el inicio.
2. **Cara y nombre:** el robot de `public/icons/botlogo.png` (1080×1350, fondo transparente; lleva el logo de Posse en el pecho). Nombre: **"Asistente de Posse Automotores"**. Estado: **"En línea"** (siempre).
3. **Aspecto:** como la muestra aprobada: globo que invita a preguntar + botón flotante con el robot; chat con el robot chiquito junto a cada mensaje del asistente; **cards de auto con foto** dentro de la conversación cuando se habla de un auto.
4. **Simulador:** queda como está. Conviven y las estadísticas dicen cuál rinde más.
5. **Mensajes:** los sigue recibiendo **Marcos** por WhatsApp (+54 9 3537 66-2444, el de `WHATSAPP_LOCAL`).
6. **Admin:** ver las conversaciones del bot de la página **junto al bot de Instagram** en `/admin/conversaciones`, y sumar **estadísticas del bot** (cuánto lo usan).
7. **Sin modelo de IA**, mismo criterio que el bot de Instagram.

## 4. Experiencia del visitante

### 4.1 Cómo se presenta
- En ficha y catálogo, abajo a la derecha, **reemplaza al botón flotante verde**: círculo con el robot y un puntito verde de "en línea".
- **Globo invitador** (una vez por visita, a los ~6 s, se descarta con una X y no vuelve a salir en esa sesión): en la ficha, "¿Querés saber si podés financiarlo? Preguntame"; en el catálogo, "¿Buscás algo en particular? Te ayudo a encontrarlo". Tocar el globo o el círculo abre el chat.
- En celular el chat abre como hoja que cubre casi toda la pantalla, con botón de cerrar visible; en compu, como ventana de ~380 px abajo a la derecha. Nunca tapa el botón de enviar de otras pantallas ni los botones principales de la ficha mientras está cerrado.

### 4.2 Dentro del chat
- Encabezado: robot, "Asistente de Posse Automotores", "En línea", cerrar.
- **Saludo con contexto:** en la ficha, "Hola, soy el asistente de Posse Automotores. Veo que estás mirando este auto. ¿Qué querés saber?" + la **card del auto** (foto de portada, nombre, año · km · combustible, precio, estado, botones "Ver ficha" y "Simular"). En el catálogo, el saludo sin card y con opciones para buscar.
- **Opciones para tocar (chips)** debajo del último mensaje, y también un campo de texto libre.
  - Ficha: "Quiero financiarlo", "Tengo un usado para entregar", "¿Sigue disponible?", "Hablar con Marcos".
  - Catálogo: "Quiero financiarlo", "Ver autos por marca o tipo", "Tengo un usado para entregar", "Hablar con Marcos".
- **Guiones cortos por opciones** (los que se vieron en la muestra), que al terminar arman el mensaje para Marcos:
  - *Financiar:* anticipo (sin anticipo / hasta 3 millones / más de 3 millones, o "solo el usado" si ya dijo que tiene usado) → cuotas (12 / 24 / 36 / 48) → mensaje armado.
  - *Usado:* "contame qué auto tenés (marca, modelo y año)" → mensaje armado.
  - *Disponible:* respuesta según el estado real del auto (disponible, reservado, vendido) → ofrece que Marcos confirme y mande fotos y video, o ir a financiación.
  - *Hablar con Marcos:* mensaje armado directo.
- **Texto libre → motor del bot** (`conversar()`): entiende "cuánto sale", "tienen una pick-up", "aceptan permuta", "dónde están", "horarios", un modelo por nombre (muestra su card), errores de tipeo, etc. Si el texto mezcla cosas ("quiero financiarlo pero no sé cómo, tengo un BMW 2016 para entregar"), el mensaje armado para Marcos conserva los dos datos.
- Al buscar o mencionar autos aparece un **carrusel de hasta 5 cards** (como en Instagram: foto, año/km/combustible/precio, botones "Ver ficha", "Simular", "Hablar con Marcos").
- **Cierre:** una burbuja con el **mensaje prearmado para Marcos** (se ve completo para que la persona lo revise) y un botón verde **"Enviar por WhatsApp"** que abre `wa.me/5493537662444?text=…` en pestaña nueva. Ejemplo: "Hola Marcos, te escribo desde la web. Me interesa el Volkswagen Taos 2022. Quiero financiarlo. Anticipo: hasta 3 millones. Cuotas: 24. ¿Sigue disponible?". Sin emojis en ese texto.
- Después del cierre quedan las opciones "Seguir preguntando" y "Hablar con Marcos".
- Si el asistente no entiende dos veces seguidas, ofrece directamente el botón de Marcos (el motor ya hace esto con `fallos`).
- Pie fijo, chico: "Guardamos esta conversación para atenderte mejor" con link a `/privacidad`.

### 4.3 Qué no cambia
Los botones de WhatsApp de las cards y de la ficha, el botón "Simular mi financiación" y el simulador siguen igual. El botón flotante verde sigue en el resto de las páginas.

## 5. Cómo se arma

### 5.1 Piezas nuevas
- **`src/components/asistente/`** (cliente): globo, botón flotante, ventana de chat, burbujas, card de auto, chips, campo de texto. Recibe por props la página (`"ficha"` con `slug` o `"catalogo"`). Se monta en `src/app/vehiculos/[slug]/page.tsx` y `src/app/catalogo/page.tsx` **en lugar de** `<FloatingWhatsApp />`.
- **`POST /api/chat`** (ruta nueva, mismo estilo que `/api/eventos` y el webhook de Instagram): recibe `{ visitante, texto? , opcion?, slug?, pagina }`, valida, carga la sesión y el catálogo, llama al motor o al guion, guarda mensajes y devuelve `{ mensajes: [{tipo:"texto"|"tarjetas"|"cierre", …}], sugerencias: string[] }`. Nunca devuelve el texto de un error técnico crudo: ante un fallo responde un mensaje fijo con el botón de Marcos.
- **`src/lib/bot/web/guiones.ts`** (puro, testeable): máquina de estados de los guiones por opciones (financiar, usado, disponible, Marcos) y armado del mensaje para Marcos. Su estado vive en la sesión web (`web_sesiones.guion`).
- **`src/lib/bot/web/sugerencias.ts`** (puro): qué chips mostrar después de cada respuesta según la sesión.
- **Estado y registro**: mismas dependencias inyectadas que `DepsBot` donde convenga, para testear sin red ni base de datos.

### 5.2 Base de datos (script nuevo `supabase/schema-web-bot.sql`, a correr a mano en Supabase como los anteriores)
- `web_sesiones`: `visitante text primary key`, `estado jsonb` (la `Sesion` del motor), `guion jsonb`, `actualizado timestamptz`.
- `web_mensajes`: `id`, `visitante`, `role` (`user` | `assistant`), `content`, `tipo` (`texto` | `tarjetas` | `cierre`; el cierre es la burbuja del mensaje armado para Marcos), `via` (solo en los del cliente: `opcion` si tocó un chip, `texto` si escribió), `vehiculo_slug text null`, `nota text null` (para "no_entendido"), `created_at`; índice por `(visitante, created_at desc)`. Con `tipo`, `via` y `created_at` el embudo de la sección 6.2 se calcula sin eventos extra: "escribieron o tocaron una opción" = conversaciones con algún mensaje del cliente; "armaron el mensaje" = conversaciones con algún mensaje `tipo = 'cierre'`.
- RLS activada **sin políticas** (solo la service role lee y escribe), igual que `ig_mensajes`.
- Función `limpiar_web_viejos()` que borra lo de más de **90 días** (mismo patrón que `limpiar_eventos_viejos`).
- `eventos`: ampliar el `check` de `tipo` con `chat_abrio` (abrió el chat) y `chat_whatsapp` (tocó "Enviar por WhatsApp" dentro del chat). Un toque a `wa.me` dentro del chat cuenta además como `whatsapp` por el rastreador existente, así las consultas generales incluyen las del chat.
- `leads`: se reutiliza con `origen = 'web'` (el teléfono va en `whatsapp`, así se cumple `leads_contacto_check`; `instagram_id` queda nulo).

### 5.3 Cambios mínimos en el motor del bot
- `EntradaMotor` gana `canal: "instagram" | "web"` (por defecto `"instagram"`, así el bot actual no cambia).
- Con `canal = "web"`: los links de WhatsApp dicen "te escribo desde la web" (nueva función hermana de `buildWhatsAppUrlInstagram`), se omite lo propio de Instagram (menciones a historias, "Instagram tomó tu número como contacto", límites de 3 botones y 1000 bytes), y las tarjetas pueden llevar los botones "Ver ficha" con link relativo.
- El bot de Instagram debe seguir pasando **todos sus tests actuales** sin cambios.
- La sesión web inicializa `vehiculoActualId` con el auto de la ficha (si el `slug` es válido y existe en el catálogo), para que "¿cuánto sale?" y "¿sigue disponible?" se refieran a ese auto.

### 5.4 Medición en el navegador
- `chat_abrio` al abrir el chat por primera vez en la visita (vía `registrarEvento`, respetando "No rastrear").
- `chat_whatsapp` al tocar **cualquier link a WhatsApp dentro del chat** ("Enviar por WhatsApp" del cierre, "Hablar con Marcos" de una card o de una opción), con el `vehiculo_slug` si lo hay. El rastreador existente además lo cuenta como `whatsapp` (consulta general), así que el total de consultas del sitio incluye las del chat sin duplicarse en la comparación del admin (que usa `chat_whatsapp` solo para atribuir al chat).
- Los visitantes se identifican con el mismo id al azar del sitio (`posse_vid`); si el navegador no lo permite, se usa uno temporal de la sesión.

## 6. Admin

### 6.1 Conversaciones
- `/admin/conversaciones` pasa a tener **dos pestañas arriba: "Instagram" y "Página web"** (el dueño pidió el bot de la página "al costadito" del de Instagram). Por defecto abre Instagram, como hoy; el período (7/30/90 días) y los filtros se conservan al cambiar de pestaña. La URL lleva `?canal=web` para poder guardarla.
- La lista y el detalle de cada conversación se reutilizan (`ListaConversaciones`, `ChatConversacion`, `armarConversaciones`, `traerChat`), generalizados para recibir los datos del canal web. En el detalle web se muestra el auto de la ficha desde la que se abrió el chat y si dejó datos (lead).
- Las conversaciones web **no tienen nombre ni @usuario**: se muestran como "Visitante" + fecha + auto consultado, con el mismo texto de solo lectura al pie.

### 6.2 Estadísticas del bot de la página
Un bloque (arriba de la lista, en la pestaña "Página web", y un resumen en `/admin/estadisticas`) con, para el período elegido:
- **Embudo:** visitas a ficha/catálogo → abrieron el chat → escribieron o tocaron una opción → armaron el mensaje para Marcos → tocaron "Enviar por WhatsApp".
- Conversaciones, mensajes por conversación, leads dejados (nombre y teléfono).
- **Autos por los que más preguntan** en el chat.
- **Lo que el asistente no entendió** (mensajes con nota `no_entendido`), para mejorar el diccionario.
- Una línea de comparación para decidir sobre el simulador: simulaciones vs. mensajes armados en el chat vs. toques de WhatsApp.

Se calcula en cada visita a la pantalla (como el resto del admin), sin tareas programadas.

## 7. Privacidad, seguridad y abuso

- Se guardan: el texto que la persona escribe, las respuestas del asistente, el auto consultado, un id al azar de visitante y, solo si el motor lo pide y la persona los da, nombre y teléfono (en `leads`). No se guarda IP ni datos del dispositivo en el chat. Hay que actualizar `/privacidad` con una línea sobre el asistente y la retención de 90 días.
- La ruta es pública, así que: tope de tamaño del cuerpo (~2 KB) y del texto (~500 caracteres), validación estricta de `slug`, `pagina` y `opcion`, **límite por visitante** (30 mensajes cada 10 minutos, contado en `web_mensajes`), **más un tope global** (por ejemplo 300 mensajes cada 10 minutos entre todos), porque el id de visitante lo manda el navegador y se puede cambiar. No se guarda la IP, ni siquiera para limitar. Se rechazan robots igual que `/api/eventos`. Cuando se pasa de un límite responde con un mensaje amable y el botón de Marcos, no con un error.
- El motor no ejecuta nada del texto ni hace llamadas externas: no hay costo por mensaje ni riesgo de inyección hacia un modelo.
- Nunca se envía al navegador información interna: el catálogo que ve el asistente es solo la parte pública (como `stock.ts` del bot de Instagram: sin precios de venta ni notas internas).

## 8. Cómo sabemos que está bien (criterio de "terminado")

- Los tests actuales del bot de Instagram siguen pasando; los guiones, las sugerencias, el motor con `canal: "web"`, la validación y el límite de `/api/chat`, y las estadísticas nuevas tienen tests (Vitest, como el resto).
- En el navegador, en celular (≈375 px) y en compu: abrir/cerrar, globo una sola vez, las cuatro opciones de la ficha de punta a punta hasta un `wa.me` válido con el texto correcto, texto libre ("bmw", "cuánto sale", "tengo una hilux para entregar y quiero financiar"), card con foto real, y que el botón de WhatsApp existente y el simulador sigan funcionando.
- Con la base real: una conversación de prueba aparece en `/admin/conversaciones?canal=web` y suma en las estadísticas; los eventos `chat_abrio` y `chat_whatsapp` se cuentan.
- La imagen del robot se sirve **optimizada** (avatar chico recortado a la cabeza, unos pocos KB; la original pesa 1,4 MB) y no hace más lento el primer pintado de la ficha: el chat y la imagen cargan recién cuando hace falta.
- Sin romper lo existente: `npm run lint`, `npm test` y `npm run build` en verde.

## 9. Mis decisiones (para que el dueño las revise)

1. **Tablas propias** (`web_*`) en vez de mezclar las conversaciones web dentro de `ig_*`: se evita contaminar las estadísticas y los filtros de Instagram.
2. **Pestañas** "Instagram | Página web" dentro de la misma pantalla de conversaciones (interpretación de "al costadito").
3. **Guiones por opciones** para financiar / usado / disponible / Marcos, además del motor de texto libre: es lo que mostró la muestra, y los dos conviven en la misma conversación.
4. **Retención de 90 días** de las conversaciones web y **límite de 30 mensajes cada 10 minutos** por visitante.
5. **Globo invitador una vez por visita a los ~6 segundos**, con los dos textos de la sección 4.1.
6. **Texto del asistente con emojis permitidos** dentro del chat (como el bot de Instagram) pero **nunca** en los links de WhatsApp ni en el mensaje prearmado para Marcos.
7. **Respuestas de dinero:** el asistente no calcula cuotas ni promete tasas (igual que el simulador, que no calcula): junta los datos y los pasa a Marcos.
8. **Captación de nombre y teléfono en la web:** igual que en Instagram (decisión 5 de `2026-10-11-bot-reglas-instagram-design.md`), solo si la persona **pide que la llamen o que le avisen cuando entre un auto**, o deja su número por su cuenta. En el flujo normal ("armá el mensaje y mandalo por WhatsApp") no se pide nada, porque Marcos ya recibe el número por WhatsApp. En esos casos puntuales se usan los pasos de captación del motor, con el texto "Marcos" (no "la secretaria") cuando `canal = "web"`, y el lead se guarda con `origen = 'web'`.
9. **Quién manda en un guion:** mientras hay una pregunta del guion pendiente (anticipo, cuotas, "qué auto tenés"), el texto libre pasa primero por el motor: si es una pregunta que el motor reconoce (precio, horarios, dónde están, permuta…), el asistente la contesta y **vuelve a hacer la pregunta pendiente**; si no, el texto se toma como la respuesta del paso y se guarda tal cual ("tengo 2 palos" queda en el mensaje para Marcos). Tocar un chip de otro guion reemplaza al guion en curso. Los datos que el motor detecta (por ejemplo el usado dentro de una frase de financiación) se suman al mensaje final.
10. **Qué pasa al recargar o cambiar de página:** el historial completo vive en el servidor (`web_mensajes`), pero el navegador solo guarda la conversación en pantalla en `sessionStorage` (por pestaña): al recargar o ir de ficha a catálogo y volver, el chat reaparece como estaba. En una visita nueva empieza limpio. La página actual (`slug` y `pagina`) viaja en **cada** mensaje, y si el auto de la ficha cambia, el asistente lo toma como el auto actual (`vehiculoActualId`) y lo avisa con una línea y la card del auto nuevo ("Ahora estás mirando…"). El saludo con card sale solo la primera vez que se abre en esa pestaña. El globo se muestra una vez por pestaña.

## 10. Para el constructor y mejoras separadas

**Lo decide quien construye:** detalle visual exacto (medidas, animaciones, accesibilidad: foco, teclado, `aria-live` para los mensajes nuevos), nombres de archivos, forma exacta de la API, cómo se parte el trabajo, qué chips se sugieren tras cada respuesta, redacción final de los textos nuevos (en español rioplatense, sin markdown, cortos), y cómo se optimiza y sirve el avatar.

**Mejoras que quedan afuera (aparte):**
- Contar como consulta los mensajes que salen del simulador de financiación (hoy el contador solo cuenta toques a `wa.me`).
- Anuncios de Instagram que abren WhatsApp directo (sin pasar por la web).
- Si el asistente anda bien, evaluar sumarlo al inicio o reemplazar el simulador.
