-- Asistente de la pagina web: sesiones, historial de conversaciones y nuevos eventos de estadisticas.
-- Correr en el SQL Editor de Supabase sobre el proyecto de Posse (despues de schema-eventos.sql y schema-instagram.sql).

-- Una fila por visitante. "visitante" es el numero al azar que el navegador guarda (posse_vid), no identifica a nadie.
-- "estado" es la sesion del motor del bot (auto que se esta mirando, datos juntados) y "guion" el paso en el que va
-- el guion por opciones (financiar, usado, disponible, hablar con Marcos).
create table if not exists public.web_sesiones (
  visitante text primary key,
  estado jsonb not null default '{}',
  guion jsonb not null default '{}',
  ficha text,
  actualizado timestamptz not null default now()
);

-- "ficha": slug de la ultima ficha desde la que escribio (null en el catalogo). Si la tabla ya se creo sin esta
-- columna, esta linea la agrega.
alter table public.web_sesiones add column if not exists ficha text;

-- Un mensaje por fila.
-- tipo: texto = burbuja comun · tarjetas = autos con foto y botones · cierre = el mensaje armado para Marcos.
-- via (solo en los del cliente): opcion = toco un chip · texto = escribio.
-- nota: para marcar lo que el asistente no entendio ('no_entendido') y mejorar el diccionario.
create table if not exists public.web_mensajes (
  id uuid primary key default gen_random_uuid(),
  visitante text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tipo text not null default 'texto' check (tipo in ('texto', 'tarjetas', 'cierre')),
  via text check (via in ('opcion', 'texto')),
  vehiculo_slug text,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists web_mensajes_visitante_fecha_idx
  on public.web_mensajes (visitante, created_at desc);
create index if not exists web_mensajes_fecha_idx
  on public.web_mensajes (created_at desc);

-- Sin politicas a proposito: solo la service_role key (que ignora RLS) accede.
-- Las conversaciones son privadas y no deben leerse con la anon key.
alter table public.web_sesiones enable row level security;
alter table public.web_mensajes enable row level security;

-- Para no llenar la base: borra lo que tenga mas de 90 dias. Se puede correr a mano de vez en cuando
-- (o programar con pg_cron desde Database > Extensions).
create or replace function public.limpiar_web_viejos() returns void
language sql security definer set search_path = public as $$
  delete from public.web_mensajes where created_at < now() - interval '90 days';
  delete from public.web_sesiones where actualizado < now() - interval '90 days';
$$;
revoke all on function public.limpiar_web_viejos() from public, anon, authenticated;

-- Estadisticas: dos tipos de evento nuevos.
-- chat_abrio: abrio el asistente · chat_whatsapp: toco un link a WhatsApp dentro del chat.
-- El check de schema-eventos.sql era anonimo, asi que Postgres lo llamo eventos_tipo_check.
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('visita', 'whatsapp', 'simular', 'simulacion', 'chat_abrio', 'chat_whatsapp'));

-- Los leads tambien pueden venir de la web (el telefono va en "whatsapp"; instagram_id queda vacio).
-- "web_visitante": id al azar del visitante que dejo los datos, para marcar su conversacion en el admin.
alter table public.leads add column if not exists web_visitante text;

alter table public.leads drop constraint if exists leads_contacto_check;
alter table public.leads add constraint leads_contacto_check
  check (whatsapp is not null or instagram_id is not null or origen = 'web');
