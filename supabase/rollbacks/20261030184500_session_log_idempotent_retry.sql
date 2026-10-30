-- Restores the partial session-log idempotency index and the previous hydration payload.

alter function private.normalize_session_log() security invoker;

drop index if exists public.session_logs_athlete_idempotency_key_idx;

create unique index session_logs_athlete_idempotency_key_idx
  on public.session_logs (athlete_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.hydrate_athlete_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'facts', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at)
      from public.athlete_facts f where f.athlete_id = (select auth.uid())), '[]'::jsonb),
    'sessionLogs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at)
      from public.session_logs l where l.athlete_id = (select auth.uid())), '[]'::jsonb),
    'guided', coalesce((select state from public.athlete_guided_states where athlete_id = (select auth.uid())),
      '{"schemaVersion":1,"activeRun":null,"history":[]}'::jsonb),
    'activePlan', (
      select to_jsonb(v) - 'athlete_id'
      from public.training_plan_read_model v
      where v.athlete_id = (select auth.uid()) and v.status = 'active'
    ),
    'currentProfile', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fact_key', c.fact_key,
        'fact_id', c.fact_id,
        'value', c.value,
        'source', c.source,
        'recorded_at', c.recorded_at
      ) order by c.fact_key)
      from public.current_athlete_profile c
      where c.athlete_id = (select auth.uid())
    ), '[]'::jsonb),
    'profile', jsonb_build_object(
      'avatarPath', (select avatar_path from public.athlete_profiles where athlete_id = (select auth.uid()))
    )
  );
$$;
