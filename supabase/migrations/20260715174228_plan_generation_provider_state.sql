alter table private.plan_generation_jobs
  drop constraint plan_generation_jobs_status_check,
  add constraint plan_generation_jobs_status_check
    check (status in ('queued', 'running', 'validated', 'published', 'rejected', 'failed', 'provider_not_configured'));
