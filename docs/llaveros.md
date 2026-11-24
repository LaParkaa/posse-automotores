# Llaveros: la foto de cada llave en el panel

En el panel del celular (`/panel`) hay una pestaña nueva, **Llaves**. Muestra cada auto en venta con la foto de su llave, la patente y una foto chica del auto, y tiene un buscador instantáneo (marca, modelo, año o patente). Sirve para saber cómo es la llave antes de ir a buscarla al tablero.

## Puesta en marcha (una sola vez)

1. **Correr el SQL.** En Supabase abrí el **SQL Editor**, pegá el contenido de `supabase/schema-llaves.sql` y tocá **Run**. Agrega dos columnas a los autos (la foto de la llave y la patente). Se puede correr dos veces sin problema. Hacelo **antes** de publicar: sin las columnas la pestaña se ve pero no puede guardar.
2. **Conectar el buscador de imágenes** (opcional, es lo que permite el botón "Sincronizar llaves"). Sin esto igual podés cargar cada foto a mano. Elegí una opción:
   - **Serper (la más fácil):** creá una cuenta en https://serper.dev (te regala 2.500 búsquedas), copiá la clave y cargala en Vercel como `SERPER_API_KEY` (Settings > Environment Variables). Después hacé un nuevo deploy.
   - **Google:** creá un buscador en https://programmablesearchengine.google.com (activá "Búsqueda de imágenes") y una clave en Google Cloud. Cargá `GOOGLE_CSE_API_KEY` y `GOOGLE_CSE_ID` en Vercel. Tiene 100 búsquedas gratis por día.

## Cómo se usa

- **Sincronizar llaves:** el botón dorado de arriba busca solo la foto de todas las llaves que faltan, de a una, con barra de progreso. Busca "llave Marca Modelo Año original" y guarda la primera imagen que se pueda usar. Se puede cancelar en cualquier momento.
- **Tocar un auto** abre su llave en grande. Desde ahí:
  - **Buscar sola / Buscar otra:** vuelve a buscar en internet (sirve si la foto encontrada no es la correcta).
  - **Pegar link:** pegás la dirección de una imagen y se guarda.
  - **Foto:** sacás una foto con el celular (o elegís una de la galería). Ideal para autos con una llave común o con un llavero de alarma.
  - **Patente:** tocá la patente (o "+ Patente") para cargarla; después el buscador la encuentra.
  - **Quitar la foto:** la deja sin llave.
- Las fotos se guardan en tu Storage de Supabase (carpeta `llaves/` del bucket `vehiculos-posse`), así el link nunca se rompe aunque la página original desaparezca.

## Qué conviene saber

- Las imágenes que trae la búsqueda son de internet: pueden no ser la llave exacta de ese auto. Por eso está el botón **Buscar otra** y la opción de sacar la foto.
- Los autos vendidos no aparecen en Llaves.
- La patente no se muestra en la web pública, solo en el panel.
- Cada búsqueda automática descuenta una búsqueda de tu plan de Serper o de Google.
