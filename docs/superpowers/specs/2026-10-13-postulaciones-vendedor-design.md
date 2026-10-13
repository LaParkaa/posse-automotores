# Postulaciones de vendedor por Instagram — Diseño

> **Revisión del 2026-10-13 (reemplaza lo que contradiga el resto de este documento).** Por pedido del dueño, la postulación es **100 % gratis y sin guardar nada**: no hay tabla `postulantes`, ni pantalla `/admin/postulantes`, ni SQL, ni cambios en el `handler`. Lo que se junta vive en la sesión de la charla y, al terminar, el bot arma **el mensaje completo para Marcos** (un dato por línea, con símbolos del plano básico de Unicode) en un botón de WhatsApp: el candidato toca enviar y adjunta su CV. El bot no puede escribirle a Marcos por su cuenta (haría falta la API de pago de WhatsApp Business); si el candidato no toca el botón, la postulación no llega. Además: se entienden edades en palabras ("veintiocho") y la experiencia con su tiempo ("5 años", "seis meses", "año y medio"); si cuenta su experiencia en ventas sin decir cuánto tiempo, el bot pregunta una vez; un mensaje con varios datos ("tengo 28, vivo en Posse y 5 años en ventas") se toma completo. Implementado en `src/lib/bot/postulacion.ts` y `src/lib/bot/nlu/numeros.ts`.

Fecha: 2026-10-13

## Objetivo

Posse Automotores va a publicar una historia de Instagram buscando **vendedor** ("mandanos tu CV"). Cuando alguien responda a esa historia o escriba al bot pidiendo trabajo, el bot entra en **modo postulante**: charla de forma natural, junta los datos de un CV, los guarda y deriva al candidato a **Marcos** por WhatsApp. Es una extensión del bot por reglas ya existente (`docs/superpowers/specs/2026-10-11-bot-reglas-instagram-design.md`): mismo motor, mismo tono, sin modelo de IA.

## Decisiones (acordadas con el dueño)

- **Detección:** solo por palabras clave en el mensaje (también cuando es respuesta a una historia). No se aprende ni se configura el identificador de la historia. Quien conteste "hola" a la historia sin decir nada más recibe la charla de autos de siempre.
- **Destino:** el candidato se deriva a **Marcos**, `+54 9 3537 66-2444` (número del flyer), no a Nati. Nati sigue siendo el contacto para clientes que compran.
- **Dónde queda:** las dos cosas. Se guarda en una tabla nueva `postulantes`, visible en `/admin/postulantes`, y el candidato recibe un botón de WhatsApp a Marcos con el resumen prearmado. El bot no puede escribirle a Marcos por su cuenta (no se usa la API de WhatsApp).
- **Datos a pedir (8, uno por mensaje, en este orden):** nombre y apellido, edad, localidad, teléfono/WhatsApp, experiencia en ventas, experiencia en el rubro automotor (agencias, gestoría), conocimientos de financiaciones, disponibilidad horaria. Salen de los requisitos del flyer.
- **El CV en archivo** se lo manda el candidato a Marcos por WhatsApp. Instagram no recibe bien PDFs por DM y no se intenta.
- **Tono:** el mismo de siempre. Charla humana con 1 a 3 emojis por mensaje, rioplatense, sin decir nunca que es una persona.

## Fuera de alcance

Recibir el CV como archivo, ordenar o puntuar candidatos, responder a los descartados, varias búsquedas laborales a la vez, y cambiar el estado de un postulante desde el panel (la columna existe pero la pantalla es de solo lectura).

## Detección

Nueva intención `empleo` en `src/lib/bot/nlu/intenciones.ts`, con el mismo mecanismo de reglas, tolerancia a errores de tipeo y prioridad que las demás.

- **Palabras que la disparan:** `cv`, `curriculum`, `curriculum vitae`, `empleo`, `laburo`, `postular`/`postularme`/`postulo`, y frases: "busco trabajo", "busco laburo", "trabajar con ustedes", "trabajar en la agencia", "buscan vendedor", "necesitan vendedor", "puesto de vendedor".
- **Palabras que NO la disparan solas:** `vendedor` (hoy "quiero hablar con un vendedor" es la intención `humano`) y `trabajo` ("lo necesito para trabajo" es de autos). `cv` va en `exactas` (sin tolerancia): con tolerancia chocaría con palabras cortas.
- Se evalúa **antes** de las intenciones de autos y de `humano`, y solo cuando el chat no está ya en otro paso de captación.
- El mismo mensaje puede traer también un dato ("soy Juan, mando mi CV"): se aprovecha.

## Flujo en el motor

Cambios en el motor puro (`conversar`), que sigue sin tocar red ni base:

- `sesion.ts`: nuevo `Paso` `"postulando"` y `Sesion.postulacion: { datos: DatosPostulacion; campo: Campo }`, normalizado desde jsonb como el resto de la sesión (lo inválido se descarta).
- `src/lib/bot/postulacion.ts` (nuevo, un solo propósito): `iniciarPostulacion(t)` y `pasoPostulacion(t, texto)`, con la misma forma que `captacion.ts` (devuelve `false` si el cliente cambió de tema).
- `ResultadoMotor` suma `postulacion: PostulacionInput | null`, igual que `lead`.

Comportamiento:

1. **Arranque:** saludo cálido ("qué bueno que quieras sumarte al equipo") y primera pregunta. Si ya había progreso guardado en la sesión, retoma donde quedó.
2. **Una pregunta por mensaje.** Lo que el candidato ya dijo no se vuelve a preguntar. De cualquier mensaje se aprovechan: el `telefono` (reusa `telefonoEn`), la `edad` solo si dice "tengo N años" (N de 16 a 75; "tengo 5 años de experiencia" no es una edad) y la `localidad` si viene con "vivo en…" o "soy de…". Cuando se pregunta ese dato también se acepta suelto ("28", "Justiniano Posse"). El **nombre** solo se toma cuando se pregunta: un "soy vendedor hace 3 años" no es un nombre.
3. **Respuestas libres** (experiencia, financiaciones, disponibilidad): se guardan tal cual, recortadas a 300 caracteres.
4. **Saltear:** "no sé", "paso", "después", "prefiero no" dejan el campo vacío y siguen. **Cancelar** (`cancelar`, `no`, `dejalo`…) sale del flujo y guarda el progreso en la sesión.
5. **Preguntas ajenas a los datos:** sueldo, comisión, "cuánto pagan", horario de trabajo, en blanco, obra social → "eso lo ve Marcos directo 😉" y se repite la pregunta pendiente. Lista de palabras cerrada y chica.
6. **Cambio de tema** (pregunta por un auto, por el precio de un auto…): se sale del paso, se responde eso y el progreso queda en la sesión. Si el candidato vuelve a decir "cv", continúa.
7. **Dos fallos seguidos en la misma pregunta** (una respuesta que no se entiende, por ejemplo una edad que no es un número): si es el nombre, deja el paso y manda al candidato a Marcos sin guardar (punto 8); si es cualquier otro dato, lo da por salteado y sigue con la pregunta siguiente. Así el chat nunca se traba y no se pierden las preguntas de experiencia por una edad mal escrita.
8. **Nombre obligatorio:** sin nombre no se guarda; el bot lo pide una vez más y, si sigue sin él, deriva a Marcos sin guardar. Un "no sé" o "después" como nombre cuenta como respuesta inválida.
9. **Cierre:** con el nombre y lo que haya, el motor devuelve `postulacion` con los datos, muestra un resumen corto y la tarjeta de contacto de Marcos. La sesión queda con la postulación como enviada: un nuevo "cv" responde que los datos ya están anotados y vuelve a mostrar el botón, sin pedir todo de nuevo.
10. **Fotos, audios y archivos durante la postulación:** el bot responde que por acá no puede recibirlos, manda el botón a Marcos para que le mande el CV por WhatsApp, y la pregunta pendiente queda para cuando el candidato siga.

## Guardado y derivación

- **Tabla `postulantes`** (`supabase/schema-postulantes.sql`, a correr en el SQL Editor): `id`, `created_at`, `actualizado`, `instagram_id` (único), `usuario_instagram` (el @ del candidato, para encontrarlo si no dejó teléfono), `nombre`, `edad` (int de 16 a 75, nullable), `localidad`, `telefono`, `experiencia_ventas`, `experiencia_rubro`, `financiaciones`, `disponibilidad`, `estado` (`nuevo` por defecto), todos los de texto nullable salvo `nombre`. RLS activado **sin políticas**: solo la service role accede, como las tablas `ig_*`. El panel usa `createAdminSupabaseClient` (service role) y exige sesión de admin, así que no hace falta política (a diferencia de `leads`, que hoy es legible por cualquier usuario autenticado).
- **No duplicar:** una fila por cuenta de Instagram. Si la misma persona vuelve a postularse, la fila se actualiza (upsert por `instagram_id`) y conserva el `estado` que le puso el equipo.
- **Handler:** `DepsBot.guardarPostulacion(senderId, input, usuario)` y, en `handler.ts`, el mismo manejo que los leads. Si el guardado falla, **no se confirma**: el bot manda `MENSAJE_POSTULACION_FALLIDA` con el botón a Marcos y la sesión vuelve a quedar con la postulación sin enviar, así el próximo "cv" reintenta el guardado.
- **Botón de WhatsApp:** `buildWhatsAppUrlPostulacion(datos)` en `utils.ts` arma `https://wa.me/5493537662444?text=…` con "Hola Marcos, te escribo desde Instagram por el puesto de vendedor. Soy {nombre}, tengo {edad} años y vivo en {localidad}. Te mando mi CV." (solo con lo que haya). **Sin emojis**: el navegador interno de Instagram los rompe en `wa.me` (visto con Nati). El texto se recorta para que el link no pase de unos 1500 caracteres.
- **Datos del reclutador:** `NEGOCIO.reclutador = { nombre: "Marcos", whatsappNumero: "5493537662444", whatsappVisible: "+54 9 3537 66-2444" }` en `negocio.ts`. `WHATSAPP_LOCAL` sigue siendo el de Nati.

## Panel

- `/admin/postulantes` (`src/app/admin/postulantes/page.tsx`): tabla de solo lectura, 100 más recientes: fecha, nombre, edad, localidad, teléfono (link `wa.me`), experiencia en ventas y en el rubro, financiaciones, disponibilidad, estado. Mismo estilo que `/admin/leads`.
- Item nuevo "Postulantes (CV)" en el menú de `admin-shell.tsx`.

## Privacidad

`/privacidad` suma un párrafo: si alguien se postula por Instagram, se guardan los datos que escribe en la charla (nombre, edad, localidad, teléfono, experiencia) para evaluar su postulación; misma retención (12 meses) y mismo pedido de eliminación (30 días) que el resto. Lo revisa el dueño antes de publicar, como el texto original.

## Errores

- Un mensaje que el bot no entiende dentro del flujo se trata como un fallo de la pregunta actual (ver punto 7), nunca deja al candidato sin respuesta.
- El motor sigue siendo puro: nada de red ni base. Toda la persistencia pasa por `DepsBot`.
- Con firma válida el webhook siempre responde 200; el error se loguea sin texto del candidato.

## Pruebas (Vitest, TDD)

- **Detección:** casos de las palabras que disparan y de las que no ("quiero hablar con un vendedor", "lo necesito para trabajo", "hola" solo).
- **Motor:** flujo completo de 8 pasos; extracción múltiple ("soy Juan, 28 años, vivo en Posse"); saltear; cancelar; pregunta de sueldo; cambio de tema y retomar; dos fallos; nombre ausente; el resultado no muta la sesión de entrada; cada texto con 1 a 3 emojis y sin afirmar ser una persona.
- **`buildWhatsAppUrlPostulacion`:** número de Marcos, contenido, sin emojis, recorte.
- **Handler:** guardado exitoso, guardado fallido (no confirma y manda el botón a Marcos), postulación duplicada.
- **`normalizarSesion`:** postulación inválida o corrupta se descarta.

## Puesta en marcha (pasos del dueño)

1. Correr `supabase/schema-postulantes.sql` en el SQL Editor de Supabase.
2. Mergear a `main` (Vercel despliega solo).
3. Revisar el texto de `/privacidad`.
4. Probar con una cuenta con rol: responder "cv" y recorrer los 8 pasos; ver el resultado en `/admin/postulantes`.
5. Subir la historia.
