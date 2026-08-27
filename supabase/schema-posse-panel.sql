-- Panel móvil: estado "reservado" + registro de venta.
-- Correr en el SQL Editor de Supabase sobre el proyecto de Posse.

alter table public.vehiculos_posse drop constraint if exists vehiculos_posse_estado_check;
alter table public.vehiculos_posse add constraint vehiculos_posse_estado_check
  check (estado in ('disponible', 'reservado', 'vendido'));

alter table public.vehiculos_posse
  add column if not exists sold_at    timestamptz,
  add column if not exists sale_price numeric(12,2),
  add column if not exists sale_notes text;

create index if not exists vehiculos_posse_sold_at_idx
  on public.vehiculos_posse (sold_at desc);

-- Habilita que el navegador reciba los cambios de esta tabla en vivo.
-- Las politicas RLS existentes ya permiten el select publico, no hacen falta nuevas.
alter publication supabase_realtime add table public.vehiculos_posse;
