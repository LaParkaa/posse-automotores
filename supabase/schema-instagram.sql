-- Bot de Instagram: historial de conversaciones y origen de los leads.
-- Correr en el SQL Editor de Supabase sobre el proyecto de Posse.

-- Un mensaje por fila. "mid" es el id que asigna Meta a los mensajes del cliente:
-- el unique permite descartar los reintentos del webhook (Meta reenvia si tarda).
-- Las respuestas del bot no tienen mid.
create table if not exists public.ig_mensajes (
  id uuid primary key default gen_random_uuid(),
  mid text unique,
  ig_user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ig_mensajes_usuario_fecha_idx
  on public.ig_mensajes (ig_user_id, created_at desc);

-- Sin politicas a proposito: solo la service_role key (que ignora RLS) accede.
-- Las conversaciones son privadas y no deben leerse con la anon key.
alter table public.ig_mensajes enable row level security;

-- Los leads ahora pueden venir de Instagram, donde no hay numero de WhatsApp.
alter table public.leads
  add column if not exists origen text not null default 'whatsapp',
  add column if not exists instagram_id text;

alter table public.leads alter column whatsapp drop not null;

alter table public.leads drop constraint if exists leads_contacto_check;
alter table public.leads add constraint leads_contacto_check
  check (whatsapp is not null or instagram_id is not null);
