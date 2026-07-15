begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'activity-athlete-a@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated', 'activity-athlete-b@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.training_plans (id, athlete_id, version_number, status, rationale, safety_result) values
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', 1, 'draft', 'Plan for athlete A.', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000302', 1, 'draft', 'Plan for athlete B.', '{}'::jsonb);

insert into public.plan_sessions (
  id, plan_id, athlete_id, position, scheduled_offset_days, phase, objective,
  intensity, expected_duration_minutes, recovery_guidance
) values
  ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', 1, 0, 'base', 'Train movement.', 'moderate', 45, 'Recover.'),
  ('00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000302', 1, 0, 'base', 'Train movement.', 'moderate', 45, 'Recover.');

insert into public.plan_blocks (id, session_id, position, phase, title, instructions, duration_minutes) values
  ('00000000-0000-0000-0000-000000000331', '00000000-0000-0000-0000-000000000321', 1, 'main', 'Movement', 'Move carefully.', 20),
  ('00000000-0000-0000-0000-000000000332', '00000000-0000-0000-0000-000000000322', 1, 'main', 'Movement', 'Move carefully.', 20);

update public.training_plans
set status = 'active', published_at = now()
where id in ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000312');

insert into storage.objects (bucket_id, name)
values ('climbing-videos', '00000000-0000-0000-0000-000000000302/private.mp4');

insert into public.session_runs (id, athlete_id, plan_id, plan_session_id, status)
values ('00000000-0000-0000-0000-000000000342', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000322', 'completed');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000301';

select lives_ok(
  $$insert into public.session_runs (id, athlete_id, plan_id, plan_session_id, status, rpe, pump, pain, energy, duration_seconds)
    values ('00000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000321', 'completed', 7, 6, 1, 8, 1800)$$,
  'athlete creates a run for their own scheduled session'
);

select throws_ok(
  $$insert into public.session_runs (athlete_id, plan_id, plan_session_id, status)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000322', 'completed')$$,
  '23514',
  'plan_session_id must belong to the specified plan and athlete',
  'athlete cannot create a run against another athlete plan and session'
);

select throws_ok(
  $$insert into public.session_runs (athlete_id, plan_id, plan_session_id, status, rpe)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000321', 'completed', 11)$$,
  '23514',
  null,
  'run rejects an RPE above the valid range'
);

select throws_ok(
  $$insert into public.session_runs (athlete_id, plan_id, plan_session_id, status, duration_seconds)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000321', 'completed', -1)$$,
  '23514',
  null,
  'run rejects a negative duration'
);

select throws_ok(
  $$insert into public.session_runs (athlete_id, plan_id, plan_session_id, status, pump)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000321', 'completed', 11)$$,
  '23514',
  null,
  'run rejects pump outside the valid range'
);

select throws_ok(
  $$insert into public.session_block_progress (athlete_id, run_id, block_id, status, attempts, duration_seconds)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-000000000332', 'completed', 1, 60)$$,
  '23514',
  'block_id must belong to the run session for the same athlete',
  'block progress cannot target a block from another session'
);

select throws_ok(
  $$insert into public.session_block_progress (athlete_id, run_id, block_id, status, attempts, duration_seconds)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-000000000331', 'completed', -1, 60)$$,
  '23514',
  null,
  'block progress rejects negative attempts'
);

select throws_ok(
  $$insert into public.session_block_progress (athlete_id, run_id, block_id, status, attempts, duration_seconds)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-000000000331', 'completed', 1, -1)$$,
  '23514',
  null,
  'block progress rejects a negative duration'
);

select throws_ok(
  $$insert into public.session_block_progress (athlete_id, run_id, block_id, status, attempts, pain)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-000000000331', 'completed', 1, 11)$$,
  '23514',
  null,
  'block progress rejects pain outside the valid range'
);

select throws_ok(
  $$insert into public.session_logs (athlete_id, run_id, body, energy)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000341', 'Felt good.', 11)$$,
  '23514',
  null,
  'session log rejects energy outside the valid range'
);

select throws_ok(
  $$insert into public.session_logs (athlete_id, run_id, body, pump)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000341', 'Felt good.', 11)$$,
  '23514',
  null,
  'session log rejects pump outside the valid range'
);

select throws_ok(
  $$insert into public.session_logs (athlete_id, run_id, body, pain)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000341', 'Felt good.', 11)$$,
  '23514',
  null,
  'session log rejects pain outside the valid range'
);

select lives_ok(
  $$insert into public.video_assets (id, athlete_id, object_path, checksum, mime_type, byte_size, duration_seconds, upload_status, processing_status, run_id)
    values ('00000000-0000-0000-0000-000000000351', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301/attempt.mp4', repeat('a', 64), 'video/mp4', 100, 12, 'uploaded', 'pending', '00000000-0000-0000-0000-000000000341')$$,
  'athlete creates video metadata for their own run'
);

select throws_ok(
  $$insert into public.video_assets (athlete_id, object_path, checksum, mime_type, byte_size, upload_status, processing_status, run_id)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301/other-run.mp4', repeat('b', 64), 'video/mp4', 100, 'uploaded', 'pending', '00000000-0000-0000-0000-000000000342')$$,
  '23503',
  null,
  'video metadata must reference a run owned by its athlete'
);

select throws_ok(
  $$insert into public.video_assets (athlete_id, object_path, checksum, mime_type, byte_size, duration_seconds, upload_status, processing_status, run_id)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301/negative-duration.mp4', repeat('d', 64), 'video/mp4', 100, -1, 'uploaded', 'pending', '00000000-0000-0000-0000-000000000341')$$,
  '23514',
  null,
  'video metadata rejects a negative duration'
);

select throws_ok(
  $$insert into public.video_assets (athlete_id, object_path, checksum, mime_type, byte_size, upload_status, processing_status, run_id)
    values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000302/wrong-prefix.mp4', repeat('e', 64), 'video/mp4', 100, 'uploaded', 'pending', '00000000-0000-0000-0000-000000000341')$$,
  '23514',
  null,
  'video metadata rejects an object path outside the athlete UUID prefix'
);

select lives_ok(
  $$insert into public.import_receipts (athlete_id, source_schema, payload_hash, receipt)
    values ('00000000-0000-0000-0000-000000000301', 'legacy-v1', repeat('c', 64), '{"source":"legacy"}'::jsonb)$$,
  'athlete records an import receipt'
);

select throws_ok(
  $$insert into public.import_receipts (athlete_id, source_schema, payload_hash, receipt)
    values ('00000000-0000-0000-0000-000000000301', 'legacy-v1', repeat('c', 64), '{"source":"legacy"}'::jsonb)$$,
  '23505',
  null,
  'duplicate import receipt conflicts safely'
);

select is(
  (select count(*) from public.import_receipts where athlete_id = '00000000-0000-0000-0000-000000000301' and source_schema = 'legacy-v1'),
  1::bigint,
  'duplicate receipt leaves one durable idempotency record'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('climbing-videos', '00000000-0000-0000-0000-000000000301/attempt.mp4')$$,
  'athlete inserts an object in their UUID prefix'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'climbing-videos' and name = '00000000-0000-0000-0000-000000000301/attempt.mp4'),
  1::bigint,
  'athlete selects an object in their UUID prefix'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('climbing-videos', '00000000-0000-0000-0000-000000000302/forbidden.mp4')$$,
  '42501',
  null,
  'athlete cannot insert an object outside their UUID prefix'
);

select lives_ok(
  $$update storage.objects
    set metadata = '{"updated":true}'::jsonb
    where bucket_id = 'climbing-videos' and name = '00000000-0000-0000-0000-000000000301/attempt.mp4'$$,
  'athlete updates an object in their UUID prefix for Storage upsert support'
);

select lives_ok(
  $$delete from storage.objects
    where bucket_id = 'climbing-videos' and name = '00000000-0000-0000-0000-000000000301/attempt.mp4'$$,
  'athlete deletes an object in their UUID prefix'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'climbing-videos' and name = '00000000-0000-0000-0000-000000000302/private.mp4'),
  0::bigint,
  'athlete A cannot select athlete B existing object'
);

select ok(
  (select public from storage.buckets where id = 'climbing-videos') = false,
  'climbing-videos bucket is private'
);

select * from finish();

rollback;
