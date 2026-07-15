create table public.session_runs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  plan_session_id uuid not null references public.plan_sessions(id) on delete restrict,
  status text not null check (status in ('planned', 'in_progress', 'completed', 'abandoned')),
  started_at timestamptz,
  last_progress_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  rpe integer check (rpe is null or rpe between 1 and 10),
  pump integer check (pump is null or pump between 0 and 10),
  pain integer check (pain is null or pain between 0 and 10),
  energy integer check (energy is null or energy between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, athlete_id),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table public.session_block_progress (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.session_runs(id) on delete cascade,
  block_id uuid not null references public.plan_blocks(id) on delete restrict,
  status text not null check (status in ('not_started', 'in_progress', 'completed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  rpe integer check (rpe is null or rpe between 1 and 10),
  pump integer check (pump is null or pump between 0 and 10),
  pain integer check (pain is null or pain between 0 and 10),
  energy integer check (energy is null or energy between 0 and 10),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, athlete_id)
);

create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.session_runs(id) on delete cascade,
  body text check (body is null or char_length(body) > 0),
  metrics jsonb not null default '{}'::jsonb,
  rpe integer check (rpe is null or rpe between 1 and 10),
  pump integer check (pump is null or pump between 0 and 10),
  pain integer check (pain is null or pain between 0 and 10),
  energy integer check (energy is null or energy between 0 and 10),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metrics) = 'object')
);

create table public.video_assets (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique check (char_length(object_path) > 0),
  checksum text not null check (checksum ~ '^[[:xdigit:]]{64}$'),
  mime_type text not null check (mime_type like 'video/%'),
  byte_size bigint not null check (byte_size >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  upload_status text not null check (upload_status in ('pending', 'uploaded', 'failed')),
  processing_status text not null check (processing_status in ('pending', 'processing', 'completed', 'failed')),
  run_id uuid,
  sanitized_failure jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, athlete_id),
  foreign key (run_id, athlete_id)
    references public.session_runs (id, athlete_id) on delete set null (run_id),
  check (split_part(object_path, '/', 1) = athlete_id::text),
  check (sanitized_failure is null or jsonb_typeof(sanitized_failure) = 'object')
);

create table public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  video_asset_id uuid not null,
  analysis_version integer not null check (analysis_version > 0),
  status text not null check (status in ('completed', 'failed')),
  metrics jsonb not null default '{}'::jsonb,
  advice jsonb not null default '{}'::jsonb,
  sanitized_failure jsonb,
  created_at timestamptz not null default now(),
  unique (video_asset_id, analysis_version),
  foreign key (video_asset_id, athlete_id)
    references public.video_assets (id, athlete_id) on delete cascade,
  check (jsonb_typeof(metrics) = 'object'),
  check (jsonb_typeof(advice) = 'object'),
  check (sanitized_failure is null or jsonb_typeof(sanitized_failure) = 'object')
);

create table public.import_receipts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  source_schema text not null check (char_length(source_schema) > 0),
  payload_hash text not null check (payload_hash ~ '^[[:xdigit:]]{64}$'),
  receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (athlete_id, source_schema, payload_hash),
  check (jsonb_typeof(receipt) = 'object')
);

create index session_runs_athlete_created_at_idx
  on public.session_runs (athlete_id, created_at desc);

create index session_block_progress_run_id_idx
  on public.session_block_progress (run_id);

create index session_logs_athlete_created_at_idx
  on public.session_logs (athlete_id, created_at desc);

create index video_assets_athlete_created_at_idx
  on public.video_assets (athlete_id, created_at desc);

create index video_analyses_video_asset_created_at_idx
  on public.video_analyses (video_asset_id, created_at desc);

create function private.validate_session_run_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.plan_sessions s
    where s.id = new.plan_session_id
      and s.athlete_id = new.athlete_id
  ) then
    raise exception 'plan_session_id must belong to the same athlete'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_session_run_ownership
  before insert or update on public.session_runs
  for each row execute function private.validate_session_run_ownership();

create function private.validate_session_block_progress_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.session_runs r
    join public.plan_blocks b on b.id = new.block_id
    where r.id = new.run_id
      and r.athlete_id = new.athlete_id
      and b.session_id = r.plan_session_id
  ) then
    raise exception 'block_id must belong to the run session for the same athlete'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_session_block_progress_ownership
  before insert or update on public.session_block_progress
  for each row execute function private.validate_session_block_progress_ownership();

create function private.validate_session_log_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.run_id is not null and not exists (
    select 1
    from public.session_runs r
    where r.id = new.run_id
      and r.athlete_id = new.athlete_id
  ) then
    raise exception 'run_id must belong to the same athlete'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_session_log_ownership
  before insert or update on public.session_logs
  for each row execute function private.validate_session_log_ownership();

insert into storage.buckets (id, name, public)
values ('climbing-videos', 'climbing-videos', false)
on conflict (id) do update set public = excluded.public;

alter table public.session_runs enable row level security;
alter table public.session_block_progress enable row level security;
alter table public.session_logs enable row level security;
alter table public.video_assets enable row level security;
alter table public.video_analyses enable row level security;
alter table public.import_receipts enable row level security;

grant select, insert, update on public.session_runs to authenticated;
grant select, insert, update on public.session_block_progress to authenticated;
grant select, insert on public.session_logs to authenticated;
grant select, insert, update on public.video_assets to authenticated;
grant select on public.video_analyses to authenticated;
grant select, insert on public.import_receipts to authenticated;

revoke delete on public.session_runs, public.session_block_progress, public.session_logs,
  public.video_assets, public.video_analyses, public.import_receipts from authenticated;
revoke update on public.session_logs, public.video_analyses, public.import_receipts from authenticated;
revoke insert on public.video_analyses from authenticated;
revoke all on public.session_runs, public.session_block_progress, public.session_logs,
  public.video_assets, public.video_analyses, public.import_receipts from anon;

create policy "athletes read own session runs"
  on public.session_runs for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes insert own session runs"
  on public.session_runs for insert to authenticated
  with check ((select auth.uid()) = athlete_id);

create policy "athletes update own session runs"
  on public.session_runs for update to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

create policy "athletes read own block progress"
  on public.session_block_progress for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes insert own block progress"
  on public.session_block_progress for insert to authenticated
  with check ((select auth.uid()) = athlete_id);

create policy "athletes update own block progress"
  on public.session_block_progress for update to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

create policy "athletes read own session logs"
  on public.session_logs for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes insert own session logs"
  on public.session_logs for insert to authenticated
  with check ((select auth.uid()) = athlete_id);

create policy "athletes read own video assets"
  on public.video_assets for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes insert own video assets"
  on public.video_assets for insert to authenticated
  with check ((select auth.uid()) = athlete_id);

create policy "athletes update own video assets"
  on public.video_assets for update to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

create policy "athletes read own video analyses"
  on public.video_analyses for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes read own import receipts"
  on public.import_receipts for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes insert own import receipts"
  on public.import_receipts for insert to authenticated
  with check ((select auth.uid()) = athlete_id);

create policy "athletes read own climbing videos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'climbing-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "athletes insert own climbing videos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'climbing-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "athletes update own climbing videos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'climbing-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'climbing-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "athletes delete own climbing videos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'climbing-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
