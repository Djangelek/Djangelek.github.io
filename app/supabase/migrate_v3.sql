-- ============================================================
-- Colombia Navega v2 → v3 — MIGRACIÓN incremental
-- Para bases de datos EXISTENTES (con datos). Si la BD está vacía,
-- ejecuta mejor app/supabase/schema.sql completo.
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 0) Roles ampliados: capitan | marinero | operacion | ventas
alter table public.profiles
  drop constraint if exists profiles_rol_check;
alter table public.profiles
  add constraint profiles_rol_check
  check (rol in ('capitan','marinero','operacion','ventas'));

-- 1) Estados: nueva columna es_recogida + estado de recogida
alter table public.estados
  add column if not exists es_recogida boolean not null default false;

insert into public.estados (nombre, color, es_recogida) values
  ('Recogida de pasajeros', '#e0a03c', true)
on conflict (nombre) do nothing;

-- 2) Rutas (administradas por operación)
create table if not exists public.rutas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text unique not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) Tripulación: asignaciones ahora incluye marineros
alter table public.asignaciones
  add column if not exists es_capitan boolean not null default true;

-- 4) Bitácoras (Check Bitácora diaria)
create or replace function public.hoy_local()
returns date
language sql
stable
as $$
  select ((now() at time zone 'America/Bogota'))::date;
$$;

create table if not exists public.bitacoras (
  id          uuid primary key default gen_random_uuid(),
  barco_id    uuid not null references public.barcos(id) on delete cascade,
  capitan_id  uuid references public.profiles(id) on delete set null,
  fecha       date not null default public.hoy_local(),
  ruta_id     uuid references public.rutas(id) on delete set null,
  pasajeros   int  not null default 0 check (pasajeros >= 0),
  combustible int  check (combustible >= 0 and combustible <= 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists uq_bitacoras_barco_fecha
  on public.bitacoras (barco_id, fecha);

-- Marineros a bordo en cada bitácora
create table if not exists public.bitacora_tripulantes (
  id          uuid primary key default gen_random_uuid(),
  bitacora_id uuid not null references public.bitacoras(id) on delete cascade,
  perfil_id   uuid not null references public.profiles(id) on delete cascade,
  unique (bitacora_id, perfil_id)
);

-- 5) Reportes: maletas + bolsos y vínculo con la bitácora del día
alter table public.reportes
  add column if not exists bitacora_id uuid references public.bitacoras(id) on delete set null;
alter table public.reportes
  add column if not exists maletas int not null default 0 check (maletas >= 0);
alter table public.reportes
  add column if not exists bolsos int not null default 0 check (bolsos >= 0);

create index if not exists idx_reportes_bitacora on public.reportes(bitacora_id);

-- equipaje legado = maletas + bolsos
create or replace function public.sync_equipaje()
returns trigger
language plpgsql
as $$
begin
  new.equipaje := coalesce(new.maletas, 0) + coalesce(new.bolsos, 0);
  return new;
end $$;

drop trigger if exists trg_reportes_equipaje on public.reportes;
create trigger trg_reportes_equipaje
  before insert or update on public.reportes
  for each row execute function public.sync_equipaje();

-- updated_at en bitácoras
drop trigger if exists trg_bitacoras_updated on public.bitacoras;
create trigger trg_bitacoras_updated
  before update on public.bitacoras
  for each row execute function public.set_updated_at();

-- 6) Funciones RLS
create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.rol from public.profiles p where p.id = auth.uid()),
    'anon'
  );
$$;

-- 7) RLS — reemplazar políticas
alter table public.profiles     enable row level security;
alter table public.barcos       enable row level security;
alter table public.estados      enable row level security;
alter table public.rutas        enable row level security;
alter table public.asignaciones enable row level security;
alter table public.bitacoras    enable row level security;
alter table public.bitacora_tripulantes enable row level security;
alter table public.reportes     enable row level security;

-- (limpiar políticas antiguas)
drop policy if exists "profiles_select"      on public.profiles;
drop policy if exists "profiles_update"      on public.profiles;
drop policy if exists "barcos_select"        on public.barcos;
drop policy if exists "barcos_insert"        on public.barcos;
drop policy if exists "barcos_update"        on public.barcos;
drop policy if exists "barcos_delete"        on public.barcos;
drop policy if exists "estados_select"       on public.estados;
drop policy if exists "estados_insert"       on public.estados;
drop policy if exists "estados_delete"       on public.estados;
drop policy if exists "asignaciones_select"  on public.asignaciones;
drop policy if exists "asignaciones_insert"  on public.asignaciones;
drop policy if exists "asignaciones_delete"  on public.asignaciones;
drop policy if exists "reportes_select"      on public.reportes;
drop policy if exists "reportes_insert"      on public.reportes;
drop policy if exists "reportes_delete"      on public.reportes;

-- Perfiles: selección (propio / operación / ventas / compañeros de barco)
-- y edición solo operación
create policy "profiles_select" on public.profiles
  for select using (
    profiles.id = auth.uid()
    or public.rol_actual() in ('operacion','ventas')
    or exists (
      select 1 from public.asignaciones mia
      where mia.perfil_id = auth.uid()
        and exists (
          select 1 from public.asignaciones a2
          where a2.perfil_id = profiles.id and a2.barco_id = mia.barco_id
        )
    )
  );

create policy "profiles_update" on public.profiles
  for update using (public.rol_actual() = 'operacion');

-- Barcos
create policy "barcos_select" on public.barcos
  for select using (auth.role() = 'authenticated');
create policy "barcos_insert" on public.barcos
  for insert with check (public.rol_actual() = 'operacion');
create policy "barcos_update" on public.barcos
  for update using (public.rol_actual() = 'operacion');
create policy "barcos_delete" on public.barcos
  for delete using (public.rol_actual() = 'operacion');

-- Estados
create policy "estados_select" on public.estados
  for select using (auth.role() = 'authenticated');
create policy "estados_insert" on public.estados
  for insert with check (public.rol_actual() = 'operacion');
create policy "estados_update" on public.estados
  for update using (public.rol_actual() = 'operacion');
create policy "estados_delete" on public.estados
  for delete using (public.rol_actual() = 'operacion');

-- Rutas
create policy "rutas_select" on public.rutas
  for select using (auth.role() = 'authenticated');
create policy "rutas_insert" on public.rutas
  for insert with check (public.rol_actual() = 'operacion');
create policy "rutas_update" on public.rutas
  for update using (public.rol_actual() = 'operacion');
create policy "rutas_delete" on public.rutas
  for delete using (public.rol_actual() = 'operacion');

-- Tripulación
create policy "asignaciones_select" on public.asignaciones
  for select using (auth.role() = 'authenticated');
create policy "asignaciones_insert" on public.asignaciones
  for insert with check (public.rol_actual() = 'operacion');
create policy "asignaciones_delete" on public.asignaciones
  for delete using (public.rol_actual() = 'operacion');

-- Bitácoras
create policy "bitacoras_select" on public.bitacoras
  for select using (auth.role() = 'authenticated');

create policy "bitacoras_insert" on public.bitacoras
  for insert with check (
    public.rol_actual() = 'operacion'
    or (
      public.rol_actual() = 'capitan'
      and bitacoras.capitan_id = auth.uid()
      and exists (
        select 1 from public.asignaciones a
        where a.perfil_id = auth.uid() and a.barco_id = bitacoras.barco_id and a.es_capitan
      )
    )
  );

create policy "bitacoras_update" on public.bitacoras
  for update using (
    public.rol_actual() = 'operacion'
    or (
      public.rol_actual() = 'capitan'
      and bitacoras.capitan_id = auth.uid()
      and bitacoras.fecha = public.hoy_local()
    )
  );

create policy "bitacoras_delete" on public.bitacoras
  for delete using (public.rol_actual() = 'operacion');

-- Marineros a bordo
create policy "bitacora_tripulantes_select" on public.bitacora_tripulantes
  for select using (auth.role() = 'authenticated');

create policy "bitacora_tripulantes_insert" on public.bitacora_tripulantes
  for insert with check (
    public.rol_actual() = 'operacion'
    or (
      public.rol_actual() = 'capitan'
      and exists (
        select 1 from public.bitacoras b
        where b.id = bitacora_tripulantes.bitacora_id
          and b.capitan_id = auth.uid()
          and b.fecha = public.hoy_local()
      )
    )
  );

create policy "bitacora_tripulantes_delete" on public.bitacora_tripulantes
  for delete using (
    public.rol_actual() = 'operacion'
    or (
      public.rol_actual() = 'capitan'
      and exists (
        select 1 from public.bitacoras b
        where b.id = bitacora_tripulantes.bitacora_id
          and b.capitan_id = auth.uid()
          and b.fecha = public.hoy_local()
      )
    )
  );

-- Reportes (con el GATE de bitácora del día)
create policy "reportes_select" on public.reportes
  for select using (auth.role() = 'authenticated');

create policy "reportes_insert" on public.reportes
  for insert with check (
    auth.uid() = reportes.operador_id
    and (
      public.rol_actual() = 'operacion'
      or (
        public.rol_actual() in ('capitan','marinero')
        and exists (
          select 1 from public.asignaciones a
          where a.perfil_id = auth.uid() and a.barco_id = reportes.barco_id
        )
        and exists (
          select 1 from public.bitacoras b
          where b.barco_id = reportes.barco_id and b.fecha = public.hoy_local()
        )
      )
    )
  );

create policy "reportes_update" on public.reportes
  for update using (
    public.rol_actual() = 'operacion'
    or (
      reportes.operador_id = auth.uid()
      and public.rol_actual() in ('capitan','marinero')
      and exists (
        select 1 from public.asignaciones a
        where a.perfil_id = auth.uid() and a.barco_id = reportes.barco_id
      )
      and exists (
        select 1 from public.bitacoras b
        where b.barco_id = reportes.barco_id and b.fecha = public.hoy_local()
      )
    )
  );

create policy "reportes_delete" on public.reportes
  for delete using (public.rol_actual() = 'operacion');

-- 8) Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'reportes'
  ) then
    alter publication supabase_realtime add table public.reportes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'bitacoras'
  ) then
    alter publication supabase_realtime add table public.bitacoras;
  end if;
end $$;
