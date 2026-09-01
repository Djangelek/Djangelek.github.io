-- Reset del esquema public (SOLO para proyectos recién creados sin datos).
-- Borra policies, objetos y tablas del esquema public, luego vuelve a
-- ejecutar schema.sql.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

drop view  if exists public.ultimos_reportes;
drop table if exists public.reportes, public.asignaciones, public.estados,
                    public.barcos, public.profiles cascade;
drop function if exists public.is_operacion();
drop function if exists public.handle_new_user();
drop function if exists public.set_operador();
drop function if exists public.set_updated_at();
