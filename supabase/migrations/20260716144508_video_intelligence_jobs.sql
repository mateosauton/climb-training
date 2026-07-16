create extension if not exists pgmq;
create extension if not exists vector with schema extensions;

select pgmq.create('video_analysis');

create table private.climbing_knowledge_sources (
  id text primary key check (id ~ '^knowledge:[a-z0-9][a-z0-9-]+$'),
  title text not null check (char_length(title) > 0),
  source_url text not null check (source_url like 'https://%'),
  source_license text not null check (char_length(source_license) > 0),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'retired')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((review_status = 'approved') = (reviewed_at is not null))
);

create table private.climbing_knowledge_chunks (
  id text primary key check (id ~ '^knowledge:[a-z0-9][a-z0-9-]+$'),
  source_id text not null references private.climbing_knowledge_sources(id) on delete cascade,
  content text not null check (char_length(content) between 20 and 2000),
  content_hash text not null check (content_hash ~ '^[[:xdigit:]]{64}$'),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'retired')),
  embedding extensions.vector(384),
  embedding_model text,
  created_at timestamptz not null default now()
);

insert into private.climbing_knowledge_sources (
  id, title, source_url, source_license, review_status, reviewed_by, reviewed_at
) values
  (
    'knowledge:physical-testing-review',
    'Physical performance testing in climbing — systematic review',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC10203485/',
    'CC BY 4.0', 'approved', 'system-seed-v1', now()
  ),
  (
    'knowledge:performance-determinants-review',
    'Sport climbing performance determinants and functional testing methods',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC11904605/',
    'Open-access source; authored paraphrase only', 'approved', 'system-seed-v1', now()
  );

insert into private.climbing_knowledge_chunks (
  id, source_id, content, content_hash, review_status
) values
  (
    'knowledge:testing-specificity', 'knowledge:physical-testing-review',
    'Use climbing-specific tests and interpret them in the context of ability level, wall angle, route demands, and protocol. Do not treat a single general test as a complete measure of climbing ability.',
    encode(sha256(convert_to('Use climbing-specific tests and interpret them in the context of ability level, wall angle, route demands, and protocol. Do not treat a single general test as a complete measure of climbing ability.', 'utf8')), 'hex'),
    'approved'
  ),
  (
    'knowledge:finger-strength-testing', 'knowledge:physical-testing-review',
    'For monitoring finger maximum strength, applying force to a climbing hold is more specific than a general hand dynamometer. Keep test setup consistent before comparing sessions.',
    encode(sha256(convert_to('For monitoring finger maximum strength, applying force to a climbing hold is more specific than a general hand dynamometer. Keep test setup consistent before comparing sessions.', 'utf8')), 'hex'),
    'approved'
  ),
  (
    'knowledge:performance-is-multifactorial', 'knowledge:performance-determinants-review',
    'Climbing performance is multifactorial. Technique and attention interact with climbing-specific strength, endurance, power, and cardiorespiratory capacity, so coaching should not infer a single cause from one visible movement.',
    encode(sha256(convert_to('Climbing performance is multifactorial. Technique and attention interact with climbing-specific strength, endurance, power, and cardiorespiratory capacity, so coaching should not infer a single cause from one visible movement.', 'utf8')), 'hex'),
    'approved'
  );

create table private.video_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  video_asset_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  state text not null default 'queued'
    check (state in ('queued', 'processing', 'completed', 'failed')),
  stage text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  worker_id text,
  queue_message_id bigint,
  pipeline_version text not null default 'video-intelligence-v1',
  model_version text,
  checkpoints jsonb not null default '{}'::jsonb,
  safe_error jsonb,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (athlete_id, video_asset_id, idempotency_key),
  foreign key (video_asset_id, athlete_id)
    references public.video_assets (id, athlete_id) on delete cascade,
  check (jsonb_typeof(checkpoints) = 'object'),
  check (safe_error is null or jsonb_typeof(safe_error) = 'object')
);

create table public.video_analysis_status (
  job_id uuid primary key,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  video_asset_id uuid not null,
  state text not null check (state in ('queued', 'processing', 'completed', 'failed')),
  stage text not null,
  progress integer not null check (progress between 0 and 100),
  analysis_id uuid references public.video_analyses(id) on delete set null,
  safe_error jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (video_asset_id, athlete_id)
    references public.video_assets (id, athlete_id) on delete cascade,
  check (safe_error is null or jsonb_typeof(safe_error) = 'object')
);

create table public.video_evidence (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  video_asset_id uuid not null,
  frame_timestamp_ms integer not null check (frame_timestamp_ms >= 0),
  frame_path text,
  kind text not null,
  confidence real check (confidence is null or confidence between 0 and 1),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (video_asset_id, athlete_id)
    references public.video_assets (id, athlete_id) on delete cascade,
  check (jsonb_typeof(payload) = 'object')
);

create table public.video_observations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  video_asset_id uuid not null,
  category text not null,
  summary text not null check (char_length(summary) > 0),
  confidence real check (confidence is null or confidence between 0 and 1),
  start_ms integer check (start_ms is null or start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= coalesce(start_ms, 0)),
  evidence_ids uuid[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (video_asset_id, athlete_id)
    references public.video_assets (id, athlete_id) on delete cascade,
  check (jsonb_typeof(payload) = 'object')
);

create table public.video_recommendations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  video_asset_id uuid not null,
  priority integer not null default 1 check (priority between 1 and 5),
  title text not null check (char_length(title) > 0),
  body text not null check (char_length(body) > 0),
  drill jsonb,
  evidence_ids uuid[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'completed', 'dismissed', 'superseded')),
  created_at timestamptz not null default now(),
  check (drill is null or jsonb_typeof(drill) = 'object'),
  foreign key (video_asset_id, athlete_id)
    references public.video_assets (id, athlete_id) on delete cascade
);

create table public.video_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null references public.video_recommendations(id) on delete cascade,
  rating integer check (rating is null or rating between 1 and 5),
  outcome text check (outcome is null or outcome in ('helpful', 'not_helpful', 'completed')),
  note text,
  created_at timestamptz not null default now(),
  check (rating is not null or outcome is not null or nullif(btrim(note), '') is not null)
);

create table public.video_theme_snapshots (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  themes jsonb not null default '[]'::jsonb,
  coaching_summary text not null default '',
  created_at timestamptz not null default now(),
  check (jsonb_typeof(themes) = 'array')
);

create index video_analysis_jobs_queue_idx
  on private.video_analysis_jobs (state, created_at);
create index video_analysis_status_athlete_created_idx
  on public.video_analysis_status (athlete_id, created_at desc);
create index video_evidence_analysis_time_idx
  on public.video_evidence (analysis_id, frame_timestamp_ms);
create index video_observations_analysis_idx
  on public.video_observations (analysis_id);
create index video_recommendations_athlete_created_idx
  on public.video_recommendations (athlete_id, created_at desc);
create index video_recommendation_feedback_recommendation_idx
  on public.video_recommendation_feedback (recommendation_id, created_at desc);
create index video_theme_snapshots_athlete_created_idx
  on public.video_theme_snapshots (athlete_id, created_at desc);

alter table public.video_analysis_status enable row level security;
alter table public.video_evidence enable row level security;
alter table public.video_observations enable row level security;
alter table public.video_recommendations enable row level security;
alter table public.video_recommendation_feedback enable row level security;
alter table public.video_theme_snapshots enable row level security;

grant select on public.video_analysis_status to authenticated;
grant select on public.video_evidence to authenticated;
grant select on public.video_observations to authenticated;
grant select on public.video_recommendations to authenticated;
grant select, insert on public.video_recommendation_feedback to authenticated;
grant select on public.video_theme_snapshots to authenticated;

create policy "athletes read own video analysis status"
  on public.video_analysis_status for select to authenticated
  using ((select auth.uid()) = athlete_id);
create policy "athletes read own video evidence"
  on public.video_evidence for select to authenticated
  using ((select auth.uid()) = athlete_id);
create policy "athletes read own video observations"
  on public.video_observations for select to authenticated
  using ((select auth.uid()) = athlete_id);
create policy "athletes read own video recommendations"
  on public.video_recommendations for select to authenticated
  using ((select auth.uid()) = athlete_id);
create policy "athletes read own recommendation feedback"
  on public.video_recommendation_feedback for select to authenticated
  using ((select auth.uid()) = athlete_id);
create policy "athletes append own recommendation feedback"
  on public.video_recommendation_feedback for insert to authenticated
  with check (
    (select auth.uid()) = athlete_id
    and exists (
      select 1 from public.video_recommendations recommendation
      where recommendation.id = recommendation_id
        and recommendation.athlete_id = (select auth.uid())
    )
  );
create policy "athletes read own video themes"
  on public.video_theme_snapshots for select to authenticated
  using ((select auth.uid()) = athlete_id);

create function public.get_reviewed_climbing_knowledge()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', chunk.id,
        'content', chunk.content,
        'source_url', source.source_url
      ) order by chunk.id
    ),
    '[]'::jsonb
  )
  from (
    select * from private.climbing_knowledge_chunks
    where review_status = 'approved'
    order by id
    limit 20
  ) chunk
  join private.climbing_knowledge_sources source on source.id = chunk.source_id
  where source.review_status = 'approved';
$$;

create function public.request_video_analysis(
  p_video_asset_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete_id uuid := auth.uid();
  v_job_id uuid;
  v_message_id bigint;
begin
  if v_athlete_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if char_length(coalesce(p_idempotency_key, '')) not between 1 and 200 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;

  perform 1 from public.video_assets
  where id = p_video_asset_id
    and athlete_id = v_athlete_id
    and upload_status = 'uploaded'
  for update;
  if not found then
    raise exception 'video asset not found' using errcode = 'P0002';
  end if;

  select id into v_job_id
  from private.video_analysis_jobs
  where athlete_id = v_athlete_id
    and video_asset_id = p_video_asset_id
    and idempotency_key = p_idempotency_key;

  if v_job_id is null then
    insert into private.video_analysis_jobs (athlete_id, video_asset_id, idempotency_key)
    values (v_athlete_id, p_video_asset_id, p_idempotency_key)
    returning id into v_job_id;

    insert into public.video_analysis_status (
      job_id, athlete_id, video_asset_id, state, stage, progress, correlation_id
    )
    select id, athlete_id, video_asset_id, state, stage, progress, correlation_id
    from private.video_analysis_jobs where id = v_job_id;

    select pgmq.send('video_analysis', jsonb_build_object('job_id', v_job_id))
      into v_message_id;
    update private.video_analysis_jobs
      set queue_message_id = v_message_id, updated_at = now()
      where id = v_job_id;
  end if;

  update public.video_assets
    set processing_status = 'processing', sanitized_failure = null, updated_at = now()
    where id = p_video_asset_id and athlete_id = v_athlete_id;
  return v_job_id;
end;
$$;

create function public.claim_video_analysis_job(
  p_worker_id text,
  p_visibility_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message record;
  v_job private.video_analysis_jobs;
  v_object_path text;
begin
  if char_length(coalesce(p_worker_id, '')) = 0
    or p_visibility_seconds not between 30 and 86400 then
    raise exception 'invalid claim arguments' using errcode = '22023';
  end if;

  select * into v_message
  from pgmq.read('video_analysis', p_visibility_seconds, 1)
  limit 1;
  if not found then return null; end if;

  update private.video_analysis_jobs
  set state = 'processing', stage = 'claimed', progress = greatest(progress, 1),
      worker_id = p_worker_id, queue_message_id = v_message.msg_id,
      attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = (v_message.message->>'job_id')::uuid
    and state in ('queued', 'processing')
    and attempt_count < max_attempts
  returning * into v_job;

  if v_job.id is null then
    perform pgmq.archive('video_analysis', v_message.msg_id);
    return null;
  end if;

  update public.video_analysis_status
  set state = v_job.state, stage = v_job.stage, progress = v_job.progress, updated_at = now()
  where job_id = v_job.id;

  select object_path into v_object_path
  from public.video_assets
  where id = v_job.video_asset_id and athlete_id = v_job.athlete_id;

  return jsonb_build_object(
    'job_id', v_job.id, 'video_asset_id', v_job.video_asset_id,
    'attempt_count', v_job.attempt_count, 'correlation_id', v_job.correlation_id,
    'bucket', 'climbing-videos', 'object_path', v_object_path,
    'checkpoint', v_job.checkpoints
  );
end;
$$;

create function public.checkpoint_video_analysis_job(
  p_job_id uuid,
  p_stage text,
  p_progress integer,
  p_checkpoint jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(p_stage, '')) = 0
    or p_progress not between 1 and 99
    or jsonb_typeof(p_checkpoint) <> 'object' then
    raise exception 'invalid checkpoint' using errcode = '22023';
  end if;

  update private.video_analysis_jobs
  set stage = p_stage, progress = greatest(progress, p_progress),
      checkpoints = checkpoints || p_checkpoint, updated_at = now()
  where id = p_job_id and state = 'processing';
  if not found then
    raise exception 'active video analysis job not found' using errcode = 'P0002';
  end if;

  update public.video_analysis_status
  set state = 'processing', stage = p_stage, progress = greatest(progress, p_progress),
      updated_at = now()
  where job_id = p_job_id;
end;
$$;

create function public.finalize_video_analysis_job(
  p_job_id uuid,
  p_result jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.video_analysis_jobs;
  v_analysis_id uuid;
  v_version integer;
  v_payload jsonb;
  v_sequence jsonb;
  v_item jsonb;
begin
  if jsonb_typeof(p_result) <> 'object' then
    raise exception 'invalid analysis result' using errcode = '22023';
  end if;

  select * into v_job from private.video_analysis_jobs
  where id = p_job_id for update;
  if v_job.id is null or v_job.state <> 'processing' then
    raise exception 'active video analysis job not found' using errcode = 'P0002';
  end if;

  v_payload := coalesce(p_result->'result', p_result);
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'invalid analysis payload' using errcode = '22023';
  end if;

  select coalesce(max(analysis_version), 0) + 1 into v_version
  from public.video_analyses where video_asset_id = v_job.video_asset_id;
  insert into public.video_analyses (
    athlete_id, video_asset_id, analysis_version, status, metrics, advice
  ) values (
    v_job.athlete_id, v_job.video_asset_id, v_version, 'completed',
    coalesce(v_payload->'metrics', jsonb_build_object('provenance', coalesce(v_payload->'provenance', '{}'::jsonb))),
    coalesce(v_payload->'advice', jsonb_build_object('recommendations', coalesce(v_payload->'recommendations', '[]'::jsonb)))
  ) returning id into v_analysis_id;

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'evidence', '[]'::jsonb)) loop
    insert into public.video_evidence (
      athlete_id, analysis_id, video_asset_id, frame_timestamp_ms,
      frame_path, kind, confidence, payload
    ) values (
      v_job.athlete_id, v_analysis_id, v_job.video_asset_id,
      coalesce((v_item->>'frame_timestamp_ms')::integer, (v_item->>'timestamp_ms')::integer, 0),
      v_item->>'frame_path', coalesce(v_item->>'kind', 'frame'),
      (v_item->>'confidence')::real, coalesce(v_item->'payload', v_item)
    );
  end loop;

  for v_sequence in select value from jsonb_array_elements(coalesce(p_result->'evidence_sequences', '[]'::jsonb)) loop
    for v_item in select value from jsonb_array_elements(coalesce(v_sequence->'frames', '[]'::jsonb)) loop
      insert into public.video_evidence (
        athlete_id, analysis_id, video_asset_id, frame_timestamp_ms,
        frame_path, kind, confidence, payload
      ) values (
        v_job.athlete_id, v_analysis_id, v_job.video_asset_id,
        coalesce((v_item->>'timestamp_ms')::integer, 0), v_item->>'path',
        'evidence_frame', null,
        v_item || jsonb_build_object('sequence_id', v_sequence->>'id')
      );
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'observations', '[]'::jsonb)) loop
    insert into public.video_observations (
      athlete_id, analysis_id, video_asset_id, category, summary, confidence,
      start_ms, end_ms, evidence_ids, payload
    ) values (
      v_job.athlete_id, v_analysis_id, v_job.video_asset_id,
      coalesce(v_item->>'category', v_item->>'label', 'technique'),
      coalesce(v_item->>'summary', v_item->>'detail'),
      (v_item->>'confidence')::real, (v_item->>'start_ms')::integer,
      (v_item->>'end_ms')::integer, '{}',
      coalesce(v_item->'payload', v_item)
    );
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'recommendations', '[]'::jsonb)) loop
    insert into public.video_recommendations (
      athlete_id, analysis_id, video_asset_id, priority, title, body, drill, evidence_ids
    ) values (
      v_job.athlete_id, v_analysis_id, v_job.video_asset_id,
      coalesce((v_item->>'priority')::integer, 1), v_item->>'title',
      coalesce(v_item->>'body', v_item->>'guidance'),
      coalesce(v_item->'drill', jsonb_build_object('citations', coalesce(v_item->'citations', '[]'::jsonb), 'evidence_refs', coalesce(v_item->'evidence_refs', '[]'::jsonb))),
      '{}'
    );
  end loop;

  if v_payload ? 'themes' then
    insert into public.video_theme_snapshots (athlete_id, analysis_id, themes, coaching_summary)
    values (
      v_job.athlete_id, v_analysis_id, v_payload->'themes',
      coalesce(v_payload->>'coaching_summary', '')
    );
  end if;

  update private.video_analysis_jobs
  set state = 'completed', stage = 'completed', progress = 100,
      model_version = coalesce(v_payload->>'model_version', v_payload->'provenance'->>'model'),
      completed_at = now(), updated_at = now()
  where id = p_job_id;
  update public.video_analysis_status
  set state = 'completed', stage = 'completed', progress = 100,
      analysis_id = v_analysis_id, safe_error = null, updated_at = now()
  where job_id = p_job_id;
  update public.video_assets
  set processing_status = 'completed', sanitized_failure = null, updated_at = now()
  where id = v_job.video_asset_id and athlete_id = v_job.athlete_id;
  if v_job.queue_message_id is not null then
    perform pgmq.archive('video_analysis', v_job.queue_message_id);
  end if;
  return v_analysis_id;
end;
$$;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on function public.request_video_analysis(uuid, text) from public, anon;
grant execute on function public.request_video_analysis(uuid, text) to authenticated;
revoke all on function public.get_reviewed_climbing_knowledge() from public, anon, authenticated;
revoke all on function public.claim_video_analysis_job(text, integer) from public, anon, authenticated;
revoke all on function public.checkpoint_video_analysis_job(uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_video_analysis_job(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_video_analysis_job(text, integer) to service_role;
grant execute on function public.get_reviewed_climbing_knowledge() to service_role;
grant execute on function public.checkpoint_video_analysis_job(uuid, text, integer, jsonb) to service_role;
grant execute on function public.finalize_video_analysis_job(uuid, jsonb) to service_role;
