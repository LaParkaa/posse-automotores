-- Bot de Instagram por reglas: estado de la conversacion y vinculo historia -> auto.
-- Correr en el SQL Editor de Supabase (proyecto de Posse), DESPUES de schema-instagram.sql.

-- Una fila por cliente de Instagram: contexto de la conversacion, pausa cuando contesta una
-- persona y perfil (nombre y @usuario) para saludar y para identificar los leads.
create table if not exists public.ig_sesiones (
  ig_user_id text primary key,
  estado jsonb not null default '{}'::jsonb,
  pausa_hasta timestamptz,
  perfil jsonb,
  actualizado timestamptz not null default now()
);

-- Vinculo "historia de Instagram -> auto". El bot lo aprende cuando un cliente confirma de
-- que auto era la historia; los siguientes clientes de esa historia se resuelven solos.
create table if not exists public.ig_historias (
  story_id text primary key,
  vehiculo_id uuid not null references public.vehiculos_posse(id) on delete cascade,
  confirmaciones integer not null default 1,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Sin politicas a proposito: solo la service_role key (que ignora RLS) accede.
alter table public.ig_sesiones enable row level security;
alter table public.ig_historias enable row level security;

-- Marca los mensajes que el bot no entendio ("no_entendido") para mejorar el diccionario.
alter table public.ig_mensajes add column if not exists nota text;
