create table public.exercise_catalog (
  id uuid not null default gen_random_uuid(),
  content_version integer not null check (content_version > 0),
  title text not null check (char_length(title) > 0),
  instructions text not null check (char_length(instructions) > 0),
  cues text[] not null default '{}',
  contraindications text[] not null default '{}',
  safety_guidance text not null check (char_length(safety_guidance) > 0),
  equipment_tags text[] not null default '{}',
  movement_tags text[] not null default '{}',
  media_references jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, content_version),
  check (retired_at is null or published_at is not null)
);

create table private.plan_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaire_submissions(id) on delete restrict,
  status text not null check (status in ('queued', 'running', 'validated', 'published', 'rejected', 'failed')),
  idempotency_key text not null check (char_length(idempotency_key) > 0),
  input_schema_version integer not null check (input_schema_version > 0),
  input_snapshot jsonb not null,
  output_schema_version integer check (output_schema_version is null or output_schema_version > 0),
  output_snapshot jsonb,
  ruleset_version text,
  prompt_version text,
  model_version text,
  generator_version text,
  safety_result jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  sanitized_error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, idempotency_key)
);

create index plan_generation_jobs_athlete_created_at_idx
  on private.plan_generation_jobs (athlete_id, created_at desc);

create function private.validate_plan_generation_job_questionnaire_athlete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.questionnaire_submissions q
    where q.id = new.questionnaire_id
      and q.athlete_id = new.athlete_id
  ) then
    raise exception 'questionnaire_id must reference a questionnaire for the same athlete'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_plan_generation_job_questionnaire_athlete
  before insert or update on private.plan_generation_jobs
  for each row execute function private.validate_plan_generation_job_questionnaire_athlete();

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  source_questionnaire_id uuid references public.questionnaire_submissions(id) on delete restrict,
  source_generation_job_id uuid references private.plan_generation_jobs(id) on delete restrict,
  status text not null check (status in ('draft', 'active', 'superseded')),
  generator_version text,
  ruleset_version text,
  prompt_version text,
  model_version text,
  output_schema_version integer check (output_schema_version is null or output_schema_version > 0),
  rationale text not null,
  safety_result jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (athlete_id, version_number),
  unique (id, athlete_id),
  check ((status = 'draft' and published_at is null) or (status in ('active', 'superseded') and published_at is not null))
);

create unique index training_plans_one_active_per_athlete_idx
  on public.training_plans (athlete_id)
  where status = 'active';

create function private.validate_training_plan_source_athlete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  generation_job_questionnaire_id uuid;
begin
  if new.source_questionnaire_id is not null and not exists (
    select 1
    from public.questionnaire_submissions q
    where q.id = new.source_questionnaire_id
      and q.athlete_id = new.athlete_id
  ) then
    raise exception 'source_questionnaire_id must reference a questionnaire for the same athlete'
      using errcode = '23514';
  end if;

  if new.source_generation_job_id is not null then
    select j.questionnaire_id
      into generation_job_questionnaire_id
      from private.plan_generation_jobs j
      where j.id = new.source_generation_job_id
        and j.athlete_id = new.athlete_id;

    if generation_job_questionnaire_id is null then
      raise exception 'source_generation_job_id must reference a generation job for the same athlete'
        using errcode = '23514';
    end if;

    if new.source_questionnaire_id is not null
      and generation_job_questionnaire_id <> new.source_questionnaire_id then
      raise exception 'source questionnaire must match the generation job questionnaire'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_training_plan_source_athlete
  before insert or update on public.training_plans
  for each row execute function private.validate_training_plan_source_athlete();

create table public.plan_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  athlete_id uuid not null,
  position integer not null check (position > 0),
  scheduled_offset_days integer not null check (scheduled_offset_days >= 0),
  phase text not null,
  objective text not null,
  intensity text not null,
  expected_duration_minutes integer not null check (expected_duration_minutes > 0),
  recovery_guidance text not null,
  created_at timestamptz not null default now(),
  unique (plan_id, position),
  unique (id, athlete_id),
  foreign key (plan_id, athlete_id)
    references public.training_plans (id, athlete_id) on delete restrict
);

create table public.plan_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.plan_sessions(id) on delete restrict,
  position integer not null check (position > 0),
  phase text not null,
  title text not null,
  instructions text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  completion_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, position)
);

create table public.plan_block_exercises (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.plan_blocks(id) on delete restrict,
  position integer not null check (position > 0),
  exercise_id uuid not null,
  exercise_content_version integer not null check (exercise_content_version > 0),
  sets integer check (sets is null or sets > 0),
  reps integer check (reps is null or reps > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  load jsonb not null default '{}'::jsonb,
  rest_seconds integer check (rest_seconds is null or rest_seconds >= 0),
  cues text[] not null default '{}',
  substitutions jsonb not null default '[]'::jsonb,
  generator_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (block_id, position),
  foreign key (exercise_id, exercise_content_version)
    references public.exercise_catalog (id, content_version) on delete restrict,
  check (sets is not null or reps is not null or duration_seconds is not null)
);

create index training_plans_athlete_published_at_idx
  on public.training_plans (athlete_id, published_at desc);

create index plan_sessions_plan_position_idx
  on public.plan_sessions (plan_id, position);

create index plan_blocks_session_position_idx
  on public.plan_blocks (session_id, position);

create index plan_block_exercises_block_position_idx
  on public.plan_block_exercises (block_id, position);

create function private.reject_published_plan_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  published boolean;
begin
  if tg_op = 'INSERT' and tg_table_name <> 'training_plans' then
    select p.published_at is not null
      into published
      from public.training_plans p
      left join public.plan_sessions s on s.plan_id = p.id
      left join public.plan_blocks b on b.session_id = s.id
      where (tg_table_name = 'plan_sessions' and p.id = new.plan_id)
         or (tg_table_name = 'plan_blocks' and s.id = new.session_id)
         or (tg_table_name = 'plan_block_exercises' and b.id = new.block_id);

    if coalesce(published, false) then
      raise exception 'published plan content is immutable' using errcode = '55000';
    end if;

    return new;
  end if;

  if tg_table_name = 'training_plans' then
    if old.published_at is not null
      and not (
        current_setting('private.allow_plan_status_transition', true) = 'on'
        and tg_op = 'UPDATE'
        and old.status = 'active'
        and new.status = 'superseded'
        and (to_jsonb(new) - 'status') is not distinct from (to_jsonb(old) - 'status')
      ) then
      raise exception 'published plan content is immutable' using errcode = '55000';
    end if;
  else
    select p.published_at is not null
      into published
      from public.training_plans p
      join public.plan_sessions s on s.plan_id = p.id
      left join public.plan_blocks b on b.session_id = s.id
      left join public.plan_block_exercises e on e.block_id = b.id
      where (tg_table_name = 'plan_sessions' and s.id = old.id)
         or (tg_table_name = 'plan_blocks' and b.id = old.id)
         or (tg_table_name = 'plan_block_exercises' and e.id = old.id);

    if coalesce(published, false) then
      raise exception 'published plan content is immutable' using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger reject_published_training_plan_mutation
  before update or delete on public.training_plans
  for each row execute function private.reject_published_plan_mutation();

create trigger reject_published_plan_session_mutation
  before insert or update or delete on public.plan_sessions
  for each row execute function private.reject_published_plan_mutation();

create trigger reject_published_plan_block_mutation
  before insert or update or delete on public.plan_blocks
  for each row execute function private.reject_published_plan_mutation();

create trigger reject_published_plan_block_exercise_mutation
  before insert or update or delete on public.plan_block_exercises
  for each row execute function private.reject_published_plan_mutation();

create function private.publish_training_plan(
  p_athlete_id uuid,
  p_source_questionnaire_id uuid,
  p_source_generation_job_id uuid,
  p_rationale text,
  p_safety_result jsonb,
  p_generator_version text default null,
  p_ruleset_version text default null,
  p_prompt_version text default null,
  p_model_version text default null,
  p_output_schema_version integer default null
)
returns public.training_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
  published_plan public.training_plans;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_athlete_id::text, 0));

  select coalesce(max(version_number), 0) + 1
    into next_version
    from public.training_plans
    where athlete_id = p_athlete_id;

  perform set_config('private.allow_plan_status_transition', 'on', true);

  update public.training_plans
    set status = 'superseded'
    where athlete_id = p_athlete_id
      and status = 'active';

  insert into public.training_plans (
    athlete_id,
    version_number,
    source_questionnaire_id,
    source_generation_job_id,
    status,
    generator_version,
    ruleset_version,
    prompt_version,
    model_version,
    output_schema_version,
    rationale,
    safety_result,
    published_at
  ) values (
    p_athlete_id,
    next_version,
    p_source_questionnaire_id,
    p_source_generation_job_id,
    'active',
    p_generator_version,
    p_ruleset_version,
    p_prompt_version,
    p_model_version,
    p_output_schema_version,
    p_rationale,
    p_safety_result,
    now()
  ) returning * into published_plan;

  return published_plan;
end;
$$;

alter table public.exercise_catalog enable row level security;
alter table public.training_plans enable row level security;
alter table public.plan_sessions enable row level security;
alter table public.plan_blocks enable row level security;
alter table public.plan_block_exercises enable row level security;
alter table private.plan_generation_jobs enable row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on schema private from service_role;
revoke all on all tables in schema private from service_role;
revoke all on all functions in schema private from service_role;

grant usage on schema private to service_role;
grant select, insert, update, delete on private.plan_generation_jobs to service_role;
grant execute on function private.publish_training_plan(uuid, uuid, uuid, text, jsonb, text, text, text, text, integer) to service_role;

grant select on public.exercise_catalog to authenticated;
grant select on public.training_plans to authenticated;
grant select on public.plan_sessions to authenticated;
grant select on public.plan_blocks to authenticated;
grant select on public.plan_block_exercises to authenticated;

revoke insert, update, delete on public.exercise_catalog from authenticated;
revoke insert, update, delete on public.training_plans from authenticated;
revoke insert, update, delete on public.plan_sessions from authenticated;
revoke insert, update, delete on public.plan_blocks from authenticated;
revoke insert, update, delete on public.plan_block_exercises from authenticated;
revoke all on public.exercise_catalog, public.training_plans, public.plan_sessions, public.plan_blocks, public.plan_block_exercises from anon;

create policy "athletes read published exercises"
  on public.exercise_catalog for select to authenticated
  using (published_at is not null and retired_at is null);

create policy "athletes read own published plans"
  on public.training_plans for select to authenticated
  using ((select auth.uid()) = athlete_id and published_at is not null);

create policy "athletes read own published plan sessions"
  on public.plan_sessions for select to authenticated
  using (
    (select auth.uid()) = athlete_id
    and exists (
      select 1
      from public.training_plans p
      where p.id = plan_sessions.plan_id
        and p.published_at is not null
    )
  );

create policy "athletes read own published plan blocks"
  on public.plan_blocks for select to authenticated
  using (
    exists (
      select 1
      from public.plan_sessions s
      join public.training_plans p on p.id = s.plan_id
      where s.id = plan_blocks.session_id
        and s.athlete_id = (select auth.uid())
        and p.published_at is not null
    )
  );

create policy "athletes read own published plan prescriptions"
  on public.plan_block_exercises for select to authenticated
  using (
    exists (
      select 1
      from public.plan_blocks b
      join public.plan_sessions s on s.id = b.session_id
      join public.training_plans p on p.id = s.plan_id
      where b.id = plan_block_exercises.block_id
        and s.athlete_id = (select auth.uid())
        and p.published_at is not null
    )
  );
