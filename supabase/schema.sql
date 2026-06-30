-- Vehiculos table for Posse Automotores
create table vehiculos (
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
  estado text not null default 'disponible' check (estado in ('disponible', 'vendido')),
  badge text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Enable Row Level Security
alter table vehiculos enable row level security;

-- Policy: Public can read available vehicles
create policy "Public can read available"
  on vehiculos for select
  using (deleted_at is null);

-- Policy: Authenticated users can do all operations
create policy "Authenticated can do all"
  on vehiculos for all
  using (auth.role() = 'authenticated');
