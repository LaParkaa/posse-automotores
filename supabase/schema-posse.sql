-- Posse Automotores: tabla propia (separada de "vehiculos" que usa Sudeste)
create table if not exists public.vehiculos_posse (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  marca text not null,
  modelo text not null,
  anio integer not null,
  kilometraje text not null default 'Consultá km',
  combustible text not null,
  transmision text not null,
  motor text,
  tipo text,
  descripcion text,
  precio_texto text not null default 'Consultá precio',
  cover_image_url text,
  imagenes text[] default '{}',
  videos text[] default '{}',
  estado text not null default 'disponible' check (estado in ('disponible', 'vendido')),
  badge text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table public.vehiculos_posse enable row level security;

create policy "Posse: lectura publica"
  on public.vehiculos_posse for select
  using (deleted_at is null);

create policy "Posse: autenticados full access"
  on public.vehiculos_posse for all
  using (auth.role() = 'authenticated');

-- Storage: politicas para el bucket vehiculos-posse (el bucket ya fue creado por script)
create policy "Posse: lectura publica de fotos"
  on storage.objects for select
  using (bucket_id = 'vehiculos-posse');

create policy "Posse: autenticados suben fotos"
  on storage.objects for insert
  with check (bucket_id = 'vehiculos-posse' and auth.role() = 'authenticated');

create policy "Posse: autenticados borran fotos"
  on storage.objects for delete
  using (bucket_id = 'vehiculos-posse' and auth.role() = 'authenticated');
