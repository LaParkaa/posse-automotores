# Asistente de la página web: guía para el dueño

El asistente es el chat que aparece en las fichas de los autos y en el catálogo (el botón con el robot). Atiende a la gente, muestra autos con foto y arma el mensaje para Marcos. El bot de Instagram sigue igual, no se tocó.

## Antes de publicar: orden de los pasos

1. Primero la base de datos (paso 1 de abajo).
2. Después se publica (merge a `main` y deploy en Vercel).

Si se publica antes de correr el SQL, la página no se rompe: el chat contesta igual, pero no recuerda los pasos de una charla ni guarda contactos, y en el admin la pestaña "Página web" muestra un cuadro de error. En cuanto se corre el SQL, todo empieza a funcionar solo.

## Puesta en marcha

### 1. Correr el SQL en Supabase (antes de publicar)

1. Entrá a Supabase, abrí el proyecto de Posse y andá a **SQL Editor**.
2. Abrí el archivo `supabase/schema-web-bot.sql`, copiá todo el contenido, pegalo en el editor y tocá **Run**.

Qué crea: las tablas donde se guardan las conversaciones del chat, los dos eventos nuevos de estadísticas (abrió el chat, tocó WhatsApp en el chat) y una columna para marcar qué conversación dejó sus datos. Es seguro correrlo dos veces: no pisa nada ni duplica.

### 2. Confirmar `SITE_URL` en Vercel

En Vercel, en **Settings > Environment Variables**, tiene que existir `SITE_URL` con la dirección real del sitio, empezando con `https://` (por ejemplo `https://tu-sitio.vercel.app`). Si falta o está mal, las cards de autos en el chat pierden el botón "Ver ficha". Si la cambiás, hay que volver a desplegar.

### 3. Opcional: borrar conversaciones de más de 90 días

Las conversaciones se guardan 90 días y después conviene borrarlas (también lo dice la página de privacidad). Hay dos formas:

- A mano, cada tanto: en el SQL Editor corré `select limpiar_web_viejos();`
- Automático: en Supabase, **Database > Extensions**, activá `pg_cron` y programá esa misma línea una vez por día.

Si no hacés ninguna de las dos, el chat funciona igual, pero las conversaciones viejas se van acumulando y la política de privacidad dejaría de ser cierta. Conviene dejarlo programado.

## Cómo leer los números

En el admin, entrá a **Conversaciones** y tocá la pestaña **Página web** (al lado de Instagram). Arriba del listado están los números y abajo las conversaciones una por una. Un resumen más corto también aparece en **Estadísticas**, bajo "Bot de la página".

**El embudo** ("De mirar un auto a tocar WhatsApp") cuenta personas distintas, no mensajes. Va de arriba hacia abajo y cada paso es un subconjunto del anterior:

1. Vieron la página: entraron a mirar autos.
2. Abrieron el chat: tocaron el botón del robot.
3. Escribieron o tocaron una opción: de verdad usaron el chat (esto es lo que se cuenta como "conversación").
4. Armaron el mensaje para Marcos: llegaron hasta el mensaje listo con los datos del auto.
5. Tocaron "Enviar por WhatsApp": pasaron a WhatsApp. Ojo: tocar no asegura que hayan mandado el mensaje.

Si entre dos pasos se cae mucha gente, ahí hay algo para mejorar.

**Otros números:** las conversaciones, los mensajes que escribe cada persona en promedio, cuántas dejaron nombre y teléfono, y los autos por los que más preguntan.

**Lo que el asistente no entendió:** son frases que la gente escribió y el asistente no supo contestar, con la cantidad de veces. Se lee como una lista de tareas: si "cuánto es la entrega" aparece muchas veces, hay que enseñarle esa frase al asistente. Una frase repetida pesa más que diez distintas de una sola vez.

**Chat y simulador:** compara cuántas simulaciones de financiación se hicieron en el simulador del sitio contra cuántos mensajes armó el chat para Marcos y cuántas veces se tocó "Enviar por WhatsApp" desde el chat. Sirve para ver por qué camino llegan los interesados en financiar.

## Qué hace y qué no hace el asistente

- No es inteligencia artificial con modelo: responde con reglas y guiones armados de antemano. Por eso no tiene costo por mensaje y no se pone a inventar.
- No inventa precios: muestra los datos que están cargados en el stock. Lo que no sabe, lo pasa a Marcos.
- No calcula ni promete cuotas ni tasas (igual que el simulador): junta los datos de la persona (qué auto, cuánto anticipo, si entrega un usado) y los deriva a Marcos.
- Para financiar, consultar un usado, ver si hay un auto disponible o hablar con una persona, ofrece opciones para tocar y también entiende lo que se escribe.
- Su salida final siempre es la misma: un mensaje armado para Marcos y un botón "Enviar por WhatsApp".
- Guarda las conversaciones 90 días. No guarda IP ni datos del dispositivo. Nombre y teléfono solo si la persona los da.
- El botón flotante verde de WhatsApp sigue en el resto de las páginas (inicio, financiación, etc.). En las fichas y el catálogo lo reemplaza el chat.
