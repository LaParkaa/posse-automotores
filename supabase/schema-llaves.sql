-- Llaveros: foto de la llave fisica de cada auto y patente, para buscar rapido desde el panel del celular.
-- Correr una vez en el SQL Editor de Supabase (proyecto de Posse). Se puede correr dos veces sin problema.

-- Foto de la llave. Se guarda en el bucket "vehiculos-posse" (carpeta llaves/), asi el link nunca se rompe.
alter table public.vehiculos_posse add column if not exists key_image_url text;

-- Patente (dominio) del auto, en mayusculas y sin espacios (ej. AB123CD). Sirve para buscar la llave en el panel.
-- No se muestra en la web publica.
alter table public.vehiculos_posse add column if not exists patente text;
