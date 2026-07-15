alter table public.questionnaire_submissions
  add column idempotency_key text;

update public.questionnaire_submissions
set idempotency_key = concat('legacy:', id::text);

alter table public.questionnaire_submissions
  add constraint questionnaire_submissions_idempotency_key_not_blank
  check (char_length(idempotency_key) > 0),
  alter column idempotency_key set not null,
  add constraint questionnaire_submissions_athlete_idempotency_key_key
    unique (athlete_id, idempotency_key);

alter table public.session_runs
  add column plan_id uuid;

update public.session_runs r
set plan_id = s.plan_id
from public.plan_sessions s
where s.id = r.plan_session_id;

alter table public.session_runs
  alter column plan_id set not null,
  add constraint session_runs_plan_athlete_fkey
    foreign key (plan_id, athlete_id)
    references public.training_plans (id, athlete_id) on delete restrict;

create or replace function private.validate_session_run_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.plan_sessions s
    where s.id = new.plan_session_id
      and s.plan_id = new.plan_id
      and s.athlete_id = new.athlete_id
  ) then
    raise exception 'plan_session_id must belong to the specified plan and athlete'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.ensure_athlete_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete_id uuid := auth.uid();
begin
  if v_athlete_id is null then
    raise exception 'authentication required'
      using errcode = '28000';
  end if;

  insert into public.athlete_profiles (athlete_id)
  values (v_athlete_id)
  on conflict (athlete_id) do nothing;
end;
$$;

revoke all on function public.ensure_athlete_profile() from public;
grant execute on function public.ensure_athlete_profile() to authenticated;
