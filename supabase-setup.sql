-- Algebra Climb: run this once in Supabase -> SQL Editor -> New query -> Run.
-- It makes one table for progress and two functions the app calls.
-- The table itself is locked (row level security on, no policies), so the
-- only way in is through the functions, and only with the secret family code.

create table if not exists public.progress (
  code text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create or replace function public.get_progress(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.progress where code = p_code;
$$;

create or replace function public.save_progress(p_code text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_code) < 16 then
    raise exception 'family code too short';
  end if;
  if pg_column_size(p_data) > 500000 then
    raise exception 'progress too large';
  end if;
  insert into public.progress (code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now();
end;
$$;

revoke all on function public.get_progress(text) from public;
revoke all on function public.save_progress(text, jsonb) from public;
grant execute on function public.get_progress(text) to anon, authenticated;
grant execute on function public.save_progress(text, jsonb) to anon, authenticated;
