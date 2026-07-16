create unique index training_plans_source_generation_job_id_key
  on public.training_plans (source_generation_job_id)
  where source_generation_job_id is not null;

create function private.claim_plan_generation_job(
  p_athlete_id uuid,
  p_questionnaire_id uuid,
  p_idempotency_key text,
  p_input_schema_version integer,
  p_input_snapshot jsonb,
  p_ruleset_version text
)
returns private.plan_generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_job private.plan_generation_jobs;
begin
  insert into private.plan_generation_jobs (
    athlete_id, questionnaire_id, idempotency_key, status,
    input_schema_version, input_snapshot, ruleset_version, attempts
  ) values (
    p_athlete_id, p_questionnaire_id, p_idempotency_key, 'queued',
    p_input_schema_version, p_input_snapshot, p_ruleset_version, 1
  )
  on conflict (athlete_id, idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning * into claimed_job;

  if claimed_job.questionnaire_id <> p_questionnaire_id then
    raise exception 'idempotency key already belongs to another questionnaire'
      using errcode = '22023';
  end if;

  return claimed_job;
end;
$$;

create function private.publish_and_finalize_training_plan(
  p_athlete_id uuid,
  p_source_questionnaire_id uuid,
  p_source_generation_job_id uuid,
  p_rationale text,
  p_safety_result jsonb,
  p_hierarchy jsonb,
  p_generator_version text default null,
  p_ruleset_version text default null,
  p_prompt_version text default null,
  p_model_version text default null,
  p_output_schema_version integer default null,
  p_output_snapshot jsonb default null
)
returns public.training_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  generation_job private.plan_generation_jobs;
  published_plan public.training_plans;
begin
  select * into generation_job
    from private.plan_generation_jobs
    where id = p_source_generation_job_id
      and athlete_id = p_athlete_id
    for update;

  if not found or generation_job.questionnaire_id <> p_source_questionnaire_id then
    raise exception 'generation job does not match the athlete questionnaire'
      using errcode = '22023';
  end if;

  select * into published_plan
    from public.training_plans
    where source_generation_job_id = p_source_generation_job_id;
  if found then
    update private.plan_generation_jobs
      set status = 'published',
          output_schema_version = p_output_schema_version,
          output_snapshot = p_output_snapshot,
          completed_at = now(),
          sanitized_error = null
      where id = p_source_generation_job_id
        and athlete_id = p_athlete_id;
    return published_plan;
  end if;

  if generation_job.status = 'published' then
    raise exception 'published generation job has no published plan' using errcode = '55000';
  end if;

  published_plan := private.publish_training_plan(
    p_athlete_id, p_source_questionnaire_id, p_source_generation_job_id,
    p_rationale, p_safety_result, p_hierarchy, p_generator_version,
    p_ruleset_version, p_prompt_version, p_model_version, p_output_schema_version
  );

  update private.plan_generation_jobs
    set status = 'published',
        output_schema_version = p_output_schema_version,
        output_snapshot = p_output_snapshot,
        completed_at = now(),
        sanitized_error = null
    where id = p_source_generation_job_id
      and athlete_id = p_athlete_id;

  return published_plan;
end;
$$;

grant execute on function private.claim_plan_generation_job(uuid, uuid, text, integer, jsonb, text) to service_role;
grant execute on function private.publish_and_finalize_training_plan(uuid, uuid, uuid, text, jsonb, jsonb, text, text, text, text, integer, jsonb) to service_role;
