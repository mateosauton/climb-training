-- Keep generation internals in the unexposed private schema.  These are the
-- only RPCs the generate-plan Edge Function may call with service_role.
revoke all on schema private from service_role;
revoke all on table private.plan_generation_jobs from service_role;
revoke execute on function private.claim_plan_generation_job(uuid, uuid, text, integer, jsonb, text) from service_role;
revoke execute on function private.publish_training_plan(uuid, uuid, uuid, text, jsonb, jsonb, text, text, text, text, integer) from service_role;
revoke execute on function private.publish_and_finalize_training_plan(uuid, uuid, uuid, text, jsonb, jsonb, text, text, text, text, integer, jsonb) from service_role;

create function public.claim_plan_generation_job(
  p_athlete_id uuid,
  p_questionnaire_id uuid,
  p_idempotency_key text,
  p_input_schema_version integer,
  p_input_snapshot jsonb,
  p_ruleset_version text
)
returns table(id uuid, status text)
language sql
security definer
set search_path = ''
as $$
  select job.id, job.status
  from private.claim_plan_generation_job(
    p_athlete_id,
    p_questionnaire_id,
    p_idempotency_key,
    p_input_schema_version,
    p_input_snapshot,
    p_ruleset_version
  ) as job;
$$;

create function public.get_plan_generation_job(
  p_athlete_id uuid,
  p_job_id uuid
)
returns table(id uuid, status text)
language sql
security definer
set search_path = ''
as $$
  select job.id, job.status
  from private.plan_generation_jobs as job
  where job.id = p_job_id
    and job.athlete_id = p_athlete_id;
$$;

create function public.update_plan_generation_job(
  p_athlete_id uuid,
  p_job_id uuid,
  p_status text,
  p_ruleset_version text,
  p_safety_result jsonb,
  p_sanitized_error jsonb,
  p_started_at timestamptz,
  p_completed_at timestamptz
)
returns table(id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('running', 'validated', 'rejected', 'failed', 'provider_not_configured') then
    raise exception 'invalid plan generation status' using errcode = '22023';
  end if;

  return query
    update private.plan_generation_jobs as job
    set status = p_status,
        ruleset_version = coalesce(p_ruleset_version, job.ruleset_version),
        safety_result = coalesce(p_safety_result, job.safety_result),
        sanitized_error = coalesce(p_sanitized_error, job.sanitized_error),
        started_at = coalesce(p_started_at, job.started_at),
        completed_at = coalesce(p_completed_at, job.completed_at)
    where job.id = p_job_id
      and job.athlete_id = p_athlete_id
    returning job.id, job.status;
end;
$$;

create function public.publish_and_finalize_training_plan(
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
language sql
security definer
set search_path = ''
as $$
  select private.publish_and_finalize_training_plan(
    p_athlete_id,
    p_source_questionnaire_id,
    p_source_generation_job_id,
    p_rationale,
    p_safety_result,
    p_hierarchy,
    p_generator_version,
    p_ruleset_version,
    p_prompt_version,
    p_model_version,
    p_output_schema_version,
    p_output_snapshot
  );
$$;

revoke all on function public.claim_plan_generation_job(uuid, uuid, text, integer, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.get_plan_generation_job(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.update_plan_generation_job(uuid, uuid, text, text, jsonb, jsonb, timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.publish_and_finalize_training_plan(uuid, uuid, uuid, text, jsonb, jsonb, text, text, text, text, integer, jsonb) from public, anon, authenticated, service_role;

grant execute on function public.claim_plan_generation_job(uuid, uuid, text, integer, jsonb, text) to service_role;
grant execute on function public.get_plan_generation_job(uuid, uuid) to service_role;
grant execute on function public.update_plan_generation_job(uuid, uuid, text, text, jsonb, jsonb, timestamptz, timestamptz) to service_role;
grant execute on function public.publish_and_finalize_training_plan(uuid, uuid, uuid, text, jsonb, jsonb, text, text, text, text, integer, jsonb) to service_role;

-- Import Edge Functions use these existing public RPCs.  Make their trusted
-- server access explicit while retaining browser-role denial.
revoke all on function public.import_local_metadata(uuid, text, text, jsonb) from service_role;
revoke all on function public.complete_local_import_videos(uuid, uuid, jsonb) from service_role;
grant execute on function public.import_local_metadata(uuid, text, text, jsonb) to service_role;
grant execute on function public.complete_local_import_videos(uuid, uuid, jsonb) to service_role;
