-- Módulo de Financiación, Créditos y Documentación Comercial.
-- Correr en el SQL Editor de Supabase sobre el proyecto de Posse.

-- =====================================================================
-- 1. Catálogo de referencia de vehículos (para cotizar autos que no
--    están en nuestro stock, ej. el usado que trae el cliente o un
--    0km que todavía no tenemos).
-- =====================================================================
create table if not exists public.catalogo_vehiculos_ref (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in (
    'Autos 2012-2026', 'Autos 2005-2011', 'Utilitarios', 'Motos', 'Camiones', 'Maquinaria'
  )),
  marca text not null,
  modelo text not null,
  version text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists catalogo_vehiculos_ref_busqueda_idx
  on public.catalogo_vehiculos_ref (categoria, marca, modelo);

alter table public.catalogo_vehiculos_ref enable row level security;

create policy "Creditos: catalogo ref lectura autenticados"
  on public.catalogo_vehiculos_ref for select
  using (auth.role() = 'authenticated');

create policy "Creditos: catalogo ref escritura autenticados"
  on public.catalogo_vehiculos_ref for all
  using (auth.role() = 'authenticated');

-- Seed de marcas/modelos más comercializados en Argentina.
insert into public.catalogo_vehiculos_ref (categoria, marca, modelo, version) values
  ('Autos 2012-2026', 'Volkswagen', 'Gol Trend', 'Trendline'),
  ('Autos 2012-2026', 'Volkswagen', 'Polo', 'Trendline'),
  ('Autos 2012-2026', 'Volkswagen', 'Vento', 'Advance'),
  ('Autos 2012-2026', 'Volkswagen', 'Amarok', 'V6'),
  ('Autos 2012-2026', 'Toyota', 'Corolla', 'XEI'),
  ('Autos 2012-2026', 'Toyota', 'Etios', 'XLS'),
  ('Autos 2012-2026', 'Toyota', 'Hilux', 'SRV'),
  ('Autos 2012-2026', 'Ford', 'Focus', 'SE'),
  ('Autos 2012-2026', 'Ford', 'EcoSport', 'Freestyle'),
  ('Autos 2012-2026', 'Ford', 'Ranger', 'XLT'),
  ('Autos 2012-2026', 'Chevrolet', 'Onix', 'LTZ'),
  ('Autos 2012-2026', 'Chevrolet', 'Cruze', 'LTZ'),
  ('Autos 2012-2026', 'Chevrolet', 'S10', 'LTZ'),
  ('Autos 2012-2026', 'Fiat', 'Cronos', 'Drive'),
  ('Autos 2012-2026', 'Fiat', 'Argo', 'Drive'),
  ('Autos 2012-2026', 'Fiat', 'Toro', 'Freedom'),
  ('Autos 2012-2026', 'Renault', 'Sandero', 'Privilege'),
  ('Autos 2012-2026', 'Renault', 'Logan', 'Privilege'),
  ('Autos 2012-2026', 'Renault', 'Duster', 'Privilege'),
  ('Autos 2012-2026', 'Peugeot', '208', 'Allure'),
  ('Autos 2012-2026', 'Peugeot', '308', 'Allure'),
  ('Autos 2012-2026', 'Peugeot', 'Partner', 'Confort'),
  ('Autos 2012-2026', 'Citroën', 'C3', 'Feel'),
  ('Autos 2012-2026', 'Citroën', 'C4 Cactus', 'Feel'),
  ('Autos 2012-2026', 'Honda', 'HR-V', 'EX'),
  ('Autos 2012-2026', 'Honda', 'Civic', 'EXL'),
  ('Autos 2005-2011', 'Volkswagen', 'Gol', 'Power'),
  ('Autos 2005-2011', 'Volkswagen', 'Fox', 'Trendline'),
  ('Autos 2005-2011', 'Chevrolet', 'Corsa', 'GL'),
  ('Autos 2005-2011', 'Chevrolet', 'Astra', 'GL'),
  ('Autos 2005-2011', 'Fiat', 'Palio', 'Fire'),
  ('Autos 2005-2011', 'Fiat', 'Punto', '1.4'),
  ('Autos 2005-2011', 'Renault', 'Clio', '1.2'),
  ('Autos 2005-2011', 'Renault', 'Megane', 'Expression'),
  ('Autos 2005-2011', 'Peugeot', '207', 'XS'),
  ('Autos 2005-2011', 'Ford', 'Fiesta', 'Ambiente'),
  ('Utilitarios', 'Fiat', 'Fiorino', 'Fire'),
  ('Utilitarios', 'Renault', 'Kangoo', 'Confort'),
  ('Utilitarios', 'Peugeot', 'Partner', 'Furgón'),
  ('Utilitarios', 'Volkswagen', 'Saveiro', 'Trendline'),
  ('Utilitarios', 'Chevrolet', 'Montana', 'LS'),
  ('Motos', 'Honda', 'Wave', '110'),
  ('Motos', 'Honda', 'XR', '150'),
  ('Motos', 'Honda', 'XR', '250'),
  ('Motos', 'Yamaha', 'YBR', '125'),
  ('Motos', 'Yamaha', 'FZ', '16'),
  ('Motos', 'KTM', 'Duke', '200'),
  ('Motos', 'KTM', 'Duke', '390'),
  ('Camiones', 'Mercedes-Benz', 'Accelo', '815'),
  ('Camiones', 'Ford', 'Cargo', '1119'),
  ('Maquinaria', 'New Holland', 'TL5', '75'),
  ('Maquinaria', 'John Deere', '5075E', null)
on conflict do nothing;

-- =====================================================================
-- 2. Planes de financiación (editables desde /admin/creditos/tasas).
-- =====================================================================
create table if not exists public.planes_financiacion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tna_pct numeric(6,2) not null,
  gastos_otorgamiento_pct numeric(6,2) not null default 0,
  max_financiable_pct numeric(6,2) not null default 100,
  antiguedad_max_anios integer,
  plazos_habilitados integer[] not null default '{12,24,36,48,60}',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.planes_financiacion enable row level security;

create policy "Creditos: planes lectura autenticados"
  on public.planes_financiacion for select
  using (auth.role() = 'authenticated');

create policy "Creditos: planes escritura autenticados"
  on public.planes_financiacion for all
  using (auth.role() = 'authenticated');

-- El simulador público necesita leer los planes activos (sin exponer
-- gastos_otorgamiento_pct, que es margen interno): se hace con una vista
-- pública en vez de abrir la tabla entera a `anon`.
create or replace view public.planes_financiacion_publicos as
  select id, nombre, plazos_habilitados,
         round(tna_pct + gastos_otorgamiento_pct, 2) as tna_final_pct
  from public.planes_financiacion
  where activo;

grant select on public.planes_financiacion_publicos to anon;

insert into public.planes_financiacion (nombre, tna_pct, gastos_otorgamiento_pct, max_financiable_pct, antiguedad_max_anios, plazos_habilitados)
values
  ('Financiación Propia de la Casa', 45, 5, 80, 15, '{12,24,36}'),
  ('Crédito Prendario Bancor', 60, 3, 70, 10, '{12,24,36,48,60}'),
  ('Crédito Prendario Santander', 58, 3.5, 70, 10, '{12,24,36,48,60}')
on conflict do nothing;

-- =====================================================================
-- 3. Operaciones de crédito (simulación → venta financiada).
-- =====================================================================
create table if not exists public.operaciones_credito (
  id uuid primary key default gen_random_uuid(),

  -- Vehículo a comprar: o bien está en nuestro stock, o se elige del catálogo de referencia.
  vehiculo_stock_id uuid references public.vehiculos_posse (id),
  vehiculo_ref_id uuid references public.catalogo_vehiculos_ref (id),
  vehiculo_descripcion text,
  precio_pactado numeric(14,2) not null default 0,
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),

  -- Toma de usado (permuta).
  entrega_usado boolean not null default false,
  usado_marca text,
  usado_modelo text,
  usado_anio integer,
  usado_version text,
  usado_dominio text,
  usado_km text,
  valor_toma numeric(14,2),

  -- Datos del cliente / solicitante.
  cliente_nombre text not null default '',
  cliente_dni_cuil text,
  cliente_whatsapp text,
  cliente_email text,
  cliente_domicilio text,
  cliente_localidad text,
  situacion_laboral text,
  notas_internas text,

  -- Cálculo financiero.
  entrega_efectivo numeric(14,2) not null default 0,
  capital_a_financiar numeric(14,2) not null default 0,
  plan_id uuid references public.planes_financiacion (id),
  plazo_meses integer,
  tna_aplicada numeric(6,2),
  gastos_aplicados_pct numeric(6,2),
  valor_cuota_pura numeric(14,2),
  valor_cuota_final numeric(14,2),
  estado text not null default 'Simulado' check (estado in (
    'Simulado', 'Simulado (Web)', 'En Evaluación', 'Aprobado', 'Liquidado / Entregado', 'Rechazado'
  )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operaciones_credito_estado_idx on public.operaciones_credito (estado);
create index if not exists operaciones_credito_created_at_idx on public.operaciones_credito (created_at desc);

alter table public.operaciones_credito enable row level security;

create policy "Creditos: operaciones full access autenticados"
  on public.operaciones_credito for all
  using (auth.role() = 'authenticated');

-- El simulador público (anon) solo puede CREAR una operación "Simulado (Web)";
-- nunca leer, editar ni ver las demás operaciones.
create policy "Creditos: anon crea simulaciones web"
  on public.operaciones_credito for insert
  to anon
  with check (estado = 'Simulado (Web)');

-- =====================================================================
-- 4. Recibos y documentos (numeración correlativa).
-- =====================================================================
create sequence if not exists public.recibos_documentos_numero_seq;

create table if not exists public.recibos_documentos (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references public.operaciones_credito (id) on delete cascade,
  numero_comprobante text not null unique
    default ('0001-' || lpad(nextval('public.recibos_documentos_numero_seq')::text, 8, '0')),
  tipo_documento text not null check (tipo_documento in (
    'Presupuesto', 'Recibo de Seña', 'Recibo de Entrega', 'Recibo de Cuota', 'Boleto de Compraventa'
  )),
  monto numeric(14,2),
  medio_pago text check (medio_pago in ('Efectivo ARS', 'Efectivo USD', 'Transferencia', 'Cheque', 'Usado')),
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists recibos_documentos_operacion_idx on public.recibos_documentos (operacion_id);

alter table public.recibos_documentos enable row level security;

create policy "Creditos: recibos full access autenticados"
  on public.recibos_documentos for all
  using (auth.role() = 'authenticated');
