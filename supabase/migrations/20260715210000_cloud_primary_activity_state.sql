-- Client-generated keys make interrupted browser writes safe to retry.
alter table public.session_logs add column if not exists idempotency_key uuid;
create unique index if not exists session_logs_athlete_idempotency_key_idx
  on public.session_logs (athlete_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.athlete_guided_states (
  athlete_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  idempotency_key uuid not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(state) = 'object')
);

alter table public.athlete_guided_states enable row level security;
grant select, insert, update on public.athlete_guided_states to authenticated;
create policy "athletes read own guided state" on public.athlete_guided_states
  for select to authenticated using ((select auth.uid()) = athlete_id);
create policy "athletes write own guided state" on public.athlete_guided_states
  for insert to authenticated with check ((select auth.uid()) = athlete_id);
create policy "athletes update own guided state" on public.athlete_guided_states
  for update to authenticated using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

create or replace function public.hydrate_athlete_state()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'facts', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at)
      from public.athlete_facts f where f.athlete_id = auth.uid()), '[]'::jsonb),
    'sessionLogs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at)
      from public.session_logs l where l.athlete_id = auth.uid()), '[]'::jsonb),
    'guided', coalesce((select state from public.athlete_guided_states where athlete_id = auth.uid()),
      '{"schemaVersion":1,"activeRun":null,"history":[]}'::jsonb),
    'activePlan', (select to_jsonb(p) from public.training_plans p
      where p.athlete_id = auth.uid() and p.status = 'active')
  );
$$;
revoke all on function public.hydrate_athlete_state() from public;
grant execute on function public.hydrate_athlete_state() to authenticated;
