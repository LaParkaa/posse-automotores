-- Estadisticas del sitio: visitas y clics (WhatsApp, simulador de financiacion).
-- Correr una vez en el SQL Editor de Supabase.
--
-- No guarda datos personales: ni IP, ni nombre, ni telefono. `visitante` es un numero al azar que el navegador
-- genera y guarda para contar visitantes unicos; no identifica a nadie.

create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  -- visita: entro a una pagina · whatsapp: toco un boton de WhatsApp
  -- simular: toco "Simular mi financiacion" · simulacion: envio el formulario de financiacion
  tipo text not null check (tipo in ('visita', 'whatsapp', 'simular', 'simulacion')),
  vehiculo_slug text,
  ruta text not null,
  visitante text,
  origen text check (origen in ('instagram', 'facebook', 'google', 'whatsapp', 'directo', 'otro')),
  dispositivo text check (dispositivo in ('celular', 'compu')),
  creado timestamptz not null default now()
);

create index if not exists eventos_creado_idx on public.eventos (creado desc);
create index if not exists eventos_vehiculo_idx on public.eventos (vehiculo_slug, tipo);

-- Sin politicas: nadie lee ni escribe desde el navegador. El sitio escribe y el admin lee con la clave de servicio.
alter table public.eventos enable row level security;

-- Para no llenar la base: borra lo que tenga mas de 120 dias. Se puede correr a mano de vez en cuando
-- (o programar con pg_cron desde Database > Extensions).
create or replace function public.limpiar_eventos_viejos() returns void
language sql security definer set search_path = public as $$
  delete from public.eventos where creado < now() - interval '120 days';
$$;
revoke all on function public.limpiar_eventos_viejos() from public, anon, authenticated;
