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

-- Privacidad de los datos de venta.
--
-- Las politicas RLS son por fila, no por columna, y el rol anon ya tiene un
-- SELECT a nivel tabla. Revocar columnas sueltas encima de ese grant no hace
-- nada: hay que revocar la tabla entera y volver a otorgar solo las columnas
-- publicas. Sin esto, la anon key -que viaja en el bundle de JavaScript- puede
-- leer cuanto se vendio cada auto, y el canal de Realtime se lo manda a
-- cualquiera que tenga el catalogo abierto.
--
-- El rol authenticated no se toca: el panel necesita sold_at para calcular los
-- KPIs en el cliente, y el SSR usa siempre la service_role key.

revoke select on public.vehiculos_posse from anon;

grant select (
  id, slug, nombre, marca, modelo, anio, kilometraje, combustible,
  transmision, motor, tipo, descripcion, precio_texto, cover_image_url,
  imagenes, videos, estado, badge, created_at, deleted_at
) on public.vehiculos_posse to anon;
