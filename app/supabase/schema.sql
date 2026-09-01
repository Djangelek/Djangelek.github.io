-- ============================================================
-- Colombia Navega v3 — Esquema de base de datos (Supabase/Postgres)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--   (o: SUPABASE_ACCESS_TOKEN=sbp_... node gps-scraper/apply-schema.mjs <project_ref>)
--
-- Cambios v3:
--   * Roles: capitan | marinero | operacion | ventas (solo lectura)
--   * Nuevas tablas: rutas (administrables) y bitacoras (registro diario)
--   * asignaciones ahora es la TRIPULACIÓN completa (es_capitan)
--   * reportes: maletas + bolsos (equipaje se mantiene como suma)
--   * estados.es_recogida: "Recogida de pasajeros" despliega PAX/maletas/bolsos
--   * GATE: no se insertan reportes sin bitácora del día (se aplica en RLS)
--   * Fix seguridad: solo operación edita perfiles (adiós auto-promoción)
-- ============================================================

-- 0) UTILIDADES ------------------------------------------------
-- Rol del usuario actual (para políticas RLS)
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

-- Fecha "hoy" en la zona horaria de la operación (Colombia, UTC-5)
create or replace function public.hoy_local()
returns date
language sql
stable
as $$
  select ((now() at time zone 'America/Bogota'))::date;
$$;

-- 1) PERFILES (extiende auth.users) ---------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'capitan'
             check (rol in ('capitan','marinero','operacion','ventas')),
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    'capitan'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) BARCOS ----------------------------------------------------
create table if not exists public.barcos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text unique not null,
  capacidad_pax int  not null default 0 check (capacidad_pax >= 0),
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 3) ESTADOS / ACTIVIDADES -------------------------------------
-- es_recogida=true → el reporte pide PAX/maletas/bolsos (embarque);
-- es_recogida=false → el reporte solo pide lugar y actividad.
create table if not exists public.estados (
  id          uuid primary key default gen_random_uuid(),
  nombre      text unique not null,
  color       text not null default '#38bdf8',
  es_recogida boolean not null default false
);

insert into public.estados (nombre, color, es_recogida) values
  ('Recogida de pasajeros', '#e0a03c', true),
  ('En navegación',         '#22c55e', false),
  ('Fondeado',              '#38bdf8', false),
  ('En puerto',             '#f59e0b', false),
  ('Emergencia',            '#ef4444', false)
on conflict (nombre) do nothing;

-- 4) RUTAS (administradas por operación) ------------------------
create table if not exists public.rutas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text unique not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5) TRIPULACIÓN: capitán o marinero → barco --------------------
-- (antes "asignaciones": solo capitanes. Ahora toda la tripulación;
--  es_capitan=true para capitanes, false para marineros.)
create table if not exists public.asignaciones (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references public.profiles(id) on delete cascade,
  barco_id     uuid not null references public.barcos(id)  on delete cascade,
  es_capitan   boolean not null default true,
  es_principal boolean not null default false,
  unique (perfil_id, barco_id)
);

-- 6) BITÁCORAS (Check Bitácora diaria — una por barco y día) -----
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

-- Una sola bitácora por barco y día
create unique index if not exists uq_bitacoras_barco_fecha
  on public.bitacoras (barco_id, fecha);

-- Marineros a bordo en cada bitácora (seleccionados de la tripulación)
create table if not exists public.bitacora_tripulantes (
  id          uuid primary key default gen_random_uuid(),
  bitacora_id uuid not null references public.bitacoras(id) on delete cascade,
  perfil_id   uuid not null references public.profiles(id) on delete cascade,
  unique (bitacora_id, perfil_id)
);

-- 7) REPORTES (historial completo; el mapa usa la vista #8) -----
create table if not exists public.reportes (
  id          uuid primary key default gen_random_uuid(),
  barco_id    uuid not null references public.barcos(id),
  bitacora_id uuid references public.bitacoras(id) on delete set null,
  estado_id   uuid references public.estados(id),
  operador_id uuid not null references auth.users(id),
  pasajeros   int  not null default 0 check (pasajeros >= 0),
  maletas     int  not null default 0 check (maletas >= 0),
  bolsos      int  not null default 0 check (bolsos >= 0),
  equipaje    int  not null default 0 check (equipaje >= 0), -- legado: maletas + bolsos
  lugar       text,
  lat         double precision,
  lng         double precision,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_reportes_barco_fecha on public.reportes(barco_id, created_at desc);
create index if not exists idx_reportes_fecha      on public.reportes(created_at desc);
create index if not exists idx_reportes_bitacora   on public.reportes(bitacora_id);

-- El operador SIEMPRE es el usuario autenticado (no se puede falsear)
create or replace function public.set_operador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.operador_id := auth.uid();
  return new;
end $$;

drop trigger if exists trg_reportes_operador on public.reportes;
create trigger trg_reportes_operador
  before insert on public.reportes
  for each row execute function public.set_operador();

-- equipaje = maletas + bolsos (mantiene la columna legada coherente)
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

-- updated_at automático (bitácoras y reportes)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_reportes_updated on public.reportes;
create trigger trg_reportes_updated
  before update on public.reportes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_bitacoras_updated on public.bitacoras;
create trigger trg_bitacoras_updated
  before update on public.bitacoras
  for each row execute function public.set_updated_at();

-- 8) VISTA: último reporte por barco (para el mapa) ------------
-- security_invoker: RLS se aplica por usuario (no como dueño de la vista)
create or replace view public.ultimos_reportes
with (security_invoker = true) as
  select distinct on (r.barco_id) r.*
  from public.reportes r
  order by r.barco_id, r.created_at desc;

-- ============================================================
-- SEGURIDAD POR FILA (RLS)
-- ============================================================
alter table public.profiles     enable row level security;
alter table public.barcos       enable row level security;
alter table public.estados      enable row level security;
alter table public.rutas        enable row level security;
alter table public.asignaciones enable row level security;
alter table public.bitacoras    enable row level security;
alter table public.bitacora_tripulantes enable row level security;
alter table public.reportes     enable row level security;

-- Perfiles: cada uno ve el suyo; operación y ventas ven todos;
-- la tripulación ve a sus compañeros de barco (para la bitácora).
-- SOLO operación actualiza (nadie puede auto-promoverse).
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

-- Barcos: lectura autenticada, escritura solo operación
create policy "barcos_select" on public.barcos
  for select using (auth.role() = 'authenticated');
create policy "barcos_insert" on public.barcos
  for insert with check (public.rol_actual() = 'operacion');
create policy "barcos_update" on public.barcos
  for update using (public.rol_actual() = 'operacion');
create policy "barcos_delete" on public.barcos
  for delete using (public.rol_actual() = 'operacion');

-- Estados: lectura autenticada, gestión solo operación
create policy "estados_select" on public.estados
  for select using (auth.role() = 'authenticated');
create policy "estados_insert" on public.estados
  for insert with check (public.rol_actual() = 'operacion');
create policy "estados_update" on public.estados
  for update using (public.rol_actual() = 'operacion');
create policy "estados_delete" on public.estados
  for delete using (public.rol_actual() = 'operacion');

-- Rutas: lectura autenticada, gestión solo operación
create policy "rutas_select" on public.rutas
  for select using (auth.role() = 'authenticated');
create policy "rutas_insert" on public.rutas
  for insert with check (public.rol_actual() = 'operacion');
create policy "rutas_update" on public.rutas
  for update using (public.rol_actual() = 'operacion');
create policy "rutas_delete" on public.rutas
  for delete using (public.rol_actual() = 'operacion');

-- Tripulación: lectura autenticada, gestión por operación
create policy "asignaciones_select" on public.asignaciones
  for select using (auth.role() = 'authenticated');
create policy "asignaciones_insert" on public.asignaciones
  for insert with check (public.rol_actual() = 'operacion');
create policy "asignaciones_delete" on public.asignaciones
  for delete using (public.rol_actual() = 'operacion');

-- Bitácoras:
--  - leer: cualquier autenticado (la flota es del equipo)
--  - insertar: el capitán para SUS barcos (o operación)
--  - actualizar: el capitán dueño el mismo día (o operación)
--  - borrar: solo operación
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

-- Marineros a bordo: lectura autenticada; gestión por el capitán dueño u operación
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

-- Reportes:
--  - leer: cualquier autenticado (toda la flota es del equipo)
--  - insertar/actualizar: el capitán o marinero de la tripulación del barco
--    SOLO si ya existe la bitácora del día (el gate del ritual matutino);
--    operación puede sin gate (flexibilidad administrativa).
--  - borrar: solo operación
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

-- ============================================================
-- Realtime: reportes y bitácoras en vivo
-- ============================================================
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
