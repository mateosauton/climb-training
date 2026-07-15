begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', 'plan-athlete-a@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d4', 'authenticated', 'authenticated', 'plan-athlete-b@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.exercise_catalog (
  id,
  content_version,
  title,
  instructions,
  cues,
  contraindications,
  safety_guidance,
  equipment_tags,
  movement_tags,
  published_at
) values (
  '00000000-0000-0000-0000-0000000000e5',
  1,
  'Controlled hang',
  'Hang with controlled shoulders.',
  array['Keep shoulders engaged.'],
  array['Avoid with acute finger pain.'],
  'Stop for pain.',
  array['hangboard'],
  array['finger_strength'],
  now()
);

insert into public.exercise_catalog (
  id,
  content_version,
  title,
  instructions,
  safety_guidance
) values (
  '00000000-0000-0000-0000-0000000000e5',
  2,
  'Controlled hang, revised',
  'Hang with controlled shoulders and a comfortable edge.',
  'Stop for pain.'
);

insert into public.questionnaire_submissions (id, athlete_id, answers, idempotency_key) values
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c3', '{"goal":"finger strength"}'::jsonb, 'plan-fixture-a'),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000d4', '{"goal":"endurance"}'::jsonb, 'plan-fixture-b');

insert into private.plan_generation_jobs (
  id, athlete_id, questionnaire_id, status, idempotency_key, input_schema_version, input_snapshot
) values (
  '00000000-0000-0000-0000-0000000000d7',
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000d5',
  'validated',
  'plan-a-v1',
  1,
  '{}'::jsonb
);

select lives_ok(
  $$select private.publish_training_plan(
    '00000000-0000-0000-0000-0000000000c3',
    '00000000-0000-0000-0000-0000000000d5',
    '00000000-0000-0000-0000-0000000000d7',
    'Build finger strength safely.',
    '{"status":"approved"}'::jsonb,
    '{"sessions":[{"position":1,"scheduled_offset_days":0,"phase":"base","objective":"Build finger strength.","intensity":"moderate","expected_duration_minutes":45,"recovery_guidance":"Rest at least 48 hours before another finger session.","blocks":[{"position":1,"phase":"main","title":"Finger strength","instructions":"Use controlled effort.","duration_minutes":20,"completion_rules":{"stop_on_pain":true},"exercises":[{"position":1,"exercise_id":"00000000-0000-0000-0000-0000000000e5","exercise_content_version":1,"sets":3,"reps":1,"duration_seconds":10,"load":{"weight_kg":0},"rest_seconds":120,"cues":["Keep shoulders engaged."],"substitutions":[],"generator_context":{}}]}]}]}'::jsonb
  )$$,
  'publication accepts a complete hierarchy'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c3';

select is(
  (select count(*) from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 1),
  1::bigint,
  'athlete A reads the published plan'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d4';

select is(
  (select count(*) from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 1),
  0::bigint,
  'athlete B cannot read athlete A plan'
);

select is(
  (select count(*) from public.plan_sessions where plan_id = (select id from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 1)),
  0::bigint,
  'athlete B cannot read athlete A sessions'
);

select is(
  (select count(*) from public.plan_blocks b join public.plan_sessions s on s.id = b.session_id where s.plan_id = (select id from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 1)),
  0::bigint,
  'athlete B cannot read athlete A blocks'
);

select is(
  (select count(*) from public.plan_block_exercises e join public.plan_blocks b on b.id = e.block_id join public.plan_sessions s on s.id = b.session_id where s.plan_id = (select id from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 1)),
  0::bigint,
  'athlete B cannot read athlete A prescriptions'
);

reset role;

select throws_ok(
  $$insert into public.training_plans (athlete_id, version_number, status, rationale, safety_result, published_at)
    values ('00000000-0000-0000-0000-0000000000c3', 2, 'active', 'A second active plan.', '{"status":"approved"}'::jsonb, now())$$,
  '23505',
  null,
  'only one active plan is allowed per athlete'
);

select throws_ok(
  $$insert into public.plan_sessions (plan_id, athlete_id, position, scheduled_offset_days, phase, objective, intensity, expected_duration_minutes, recovery_guidance)
    values ((select id from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 1), '00000000-0000-0000-0000-0000000000c3', 2, 7, 'base', 'Later addition', 'moderate', 30, 'Rest.')$$,
  '55000',
  'published plan content is immutable',
  'sessions cannot be appended to a published plan'
);

select throws_ok(
  $$insert into public.plan_blocks (session_id, position, phase, title, instructions, duration_minutes)
    values ((select s.id from public.plan_sessions s join public.training_plans p on p.id = s.plan_id where p.athlete_id = '00000000-0000-0000-0000-0000000000c3' and p.version_number = 1), 2, 'main', 'Later block', 'Do not add this.', 10)$$,
  '55000',
  'published plan content is immutable',
  'blocks cannot be appended to a published plan'
);

select throws_ok(
  $$insert into public.plan_block_exercises (block_id, position, exercise_id, exercise_content_version, sets, load)
    values ((select b.id from public.plan_blocks b join public.plan_sessions s on s.id = b.session_id join public.training_plans p on p.id = s.plan_id where p.athlete_id = '00000000-0000-0000-0000-0000000000c3' and p.version_number = 1), 2, '00000000-0000-0000-0000-0000000000e5', 2, 3, '{}'::jsonb)$$,
  '55000',
  'published plan content is immutable',
  'prescriptions cannot be appended to a published plan'
);

select throws_ok(
  $$insert into private.plan_generation_jobs (athlete_id, questionnaire_id, status, idempotency_key, input_schema_version, input_snapshot)
    values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d6', 'queued', 'wrong-questionnaire-owner', 1, '{}'::jsonb)$$,
  '23514',
  'questionnaire_id must reference a questionnaire for the same athlete',
  'generation jobs require an owned questionnaire'
);

select throws_ok(
  $$insert into public.training_plans (athlete_id, version_number, source_questionnaire_id, source_generation_job_id, status, rationale, safety_result)
    values ('00000000-0000-0000-0000-0000000000c3', 2, '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000d7', 'draft', 'Wrong source owner.', '{}'::jsonb)$$,
  '23514',
  'source_questionnaire_id must reference a questionnaire for the same athlete',
  'plans require an owned source questionnaire'
);

select throws_ok(
  $$insert into public.training_plans (athlete_id, version_number, source_questionnaire_id, source_generation_job_id, status, rationale, safety_result)
    values ('00000000-0000-0000-0000-0000000000d4', 1, '00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000d7', 'draft', 'Wrong job owner.', '{}'::jsonb)$$,
  '23514',
  'source_generation_job_id must reference a generation job for the same athlete',
  'plans require an owned source generation job'
);

select throws_ok(
  $$select private.publish_training_plan(
    '00000000-0000-0000-0000-0000000000c3',
    '00000000-0000-0000-0000-0000000000d5',
    '00000000-0000-0000-0000-0000000000d7',
    'This must not publish.',
    '{"status":"approved"}'::jsonb,
    '{}'::jsonb
  )$$,
  '22023',
  'p_hierarchy must contain nonempty sessions, blocks, and exercises',
  'publication rejects an empty hierarchy'
);

select is(
  (select count(*) from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3'),
  1::bigint,
  'rejected publication leaves no partial plan header'
);

select is(
  (select status::text from private.publish_training_plan(
    '00000000-0000-0000-0000-0000000000c3',
    '00000000-0000-0000-0000-0000000000d5',
    '00000000-0000-0000-0000-0000000000d7',
    'Publish the next version.',
    '{"status":"approved"}'::jsonb,
    '{"sessions":[{"position":1,"scheduled_offset_days":7,"phase":"base","objective":"Build capacity.","intensity":"moderate","expected_duration_minutes":40,"recovery_guidance":"Rest.","blocks":[{"position":1,"phase":"main","title":"Capacity","instructions":"Use controlled effort.","duration_minutes":20,"exercises":[{"position":1,"exercise_id":"00000000-0000-0000-0000-0000000000e5","exercise_content_version":1,"sets":3}]}]}]}'::jsonb
  )),
  'active',
  'trusted publication function creates an active plan'
);

select is(
  (select status::text from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 1),
  'superseded',
  'publication function supersedes the prior active plan'
);

select ok(
  not has_schema_privilege('service_role', 'private', 'USAGE')
  and not has_table_privilege('service_role', 'private.plan_generation_jobs', 'SELECT, INSERT, UPDATE, DELETE')
  and not has_function_privilege('service_role', 'private.claim_plan_generation_job(uuid,uuid,text,integer,jsonb,text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'private.publish_and_finalize_training_plan(uuid,uuid,uuid,text,jsonb,jsonb,text,text,text,text,integer,jsonb)', 'EXECUTE')
  and not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'private generation internals are inaccessible to API roles'
);

select ok(
  has_function_privilege('service_role', 'public.claim_plan_generation_job(uuid,uuid,text,integer,jsonb,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_plan_generation_job(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.update_plan_generation_job(uuid,uuid,text,text,jsonb,jsonb,timestamptz,timestamptz)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.publish_and_finalize_training_plan(uuid,uuid,uuid,text,jsonb,jsonb,text,text,text,text,integer,jsonb)', 'EXECUTE'),
  'service role can reach the plan-generation RPC boundary'
);

select ok(
  not has_function_privilege('anon', 'public.claim_plan_generation_job(uuid,uuid,text,integer,jsonb,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.claim_plan_generation_job(uuid,uuid,text,integer,jsonb,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_plan_generation_job(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.get_plan_generation_job(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_plan_generation_job(uuid,uuid,text,text,jsonb,jsonb,timestamptz,timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.update_plan_generation_job(uuid,uuid,text,text,jsonb,jsonb,timestamptz,timestamptz)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.publish_and_finalize_training_plan(uuid,uuid,uuid,text,jsonb,jsonb,text,text,text,text,integer,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.publish_and_finalize_training_plan(uuid,uuid,uuid,text,jsonb,jsonb,text,text,text,text,integer,jsonb)', 'EXECUTE'),
  'browser roles cannot execute the plan-generation RPC boundary'
);

select lives_ok(
  $$select * from public.get_plan_generation_job(
    '00000000-0000-0000-0000-0000000000d4',
    (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key')
  )$$,
  'service-facing job lookup is reachable through public RPC'
);

select is(
  (select status from public.update_plan_generation_job(
    '00000000-0000-0000-0000-0000000000d4',
    (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key'),
    'validated', 'rules-2', '{"status":"approved"}'::jsonb, null, null, null
  )),
  'validated',
  'service-facing job update is reachable through public RPC'
);

select is(
  (select id from public.claim_plan_generation_job(
    '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d6',
    'same-key', 1, '{}'::jsonb, 'rules-2'
  )),
  (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key'),
  'service-facing job claim reuses the private job through public RPC'
);

select ok(
  has_table_privilege('authenticated', 'public.exercise_catalog', 'SELECT')
  and not has_table_privilege('authenticated', 'public.exercise_catalog', 'INSERT, UPDATE, DELETE')
  and has_table_privilege('authenticated', 'public.training_plans', 'SELECT')
  and not has_table_privilege('authenticated', 'public.training_plans', 'INSERT, UPDATE, DELETE'),
  'catalog is read-only and browser roles cannot create drafts'
);

select throws_ok(
  $$update public.training_plans set rationale = 'changed' where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 2$$,
  '55000',
  'published plan content is immutable',
  'published plans cannot be updated'
);

select throws_ok(
  $$delete from public.plan_sessions where plan_id = (select id from public.training_plans where athlete_id = '00000000-0000-0000-0000-0000000000c3' and version_number = 2)$$,
  '55000',
  'published plan content is immutable',
  'published sessions cannot be deleted'
);

select throws_ok(
  $$update public.plan_blocks set title = 'changed' where session_id = (select s.id from public.plan_sessions s join public.training_plans p on p.id = s.plan_id where p.athlete_id = '00000000-0000-0000-0000-0000000000c3' and p.version_number = 2)$$,
  '55000',
  'published plan content is immutable',
  'published blocks cannot be updated'
);

select throws_ok(
  $$delete from public.plan_block_exercises where block_id = (select b.id from public.plan_blocks b join public.plan_sessions s on s.id = b.session_id join public.training_plans p on p.id = s.plan_id where p.athlete_id = '00000000-0000-0000-0000-0000000000c3' and p.version_number = 2)$$,
  '55000',
  'published plan content is immutable',
  'published prescriptions cannot be deleted'
);

select is(
  (select count(*) from public.plan_block_exercises e join public.plan_blocks b on b.id = e.block_id join public.plan_sessions s on s.id = b.session_id join public.training_plans p on p.id = s.plan_id where p.athlete_id = '00000000-0000-0000-0000-0000000000c3' and p.version_number = 2 and e.position = 1),
  1::bigint,
  'a nonempty hierarchy is published atomically'
);

select is(
  (select (private.claim_plan_generation_job(
    '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d6',
    'same-key', 1, '{}'::jsonb, 'rules-1'
  )).id),
  (select (private.claim_plan_generation_job(
    '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d6',
    'same-key', 1, '{}'::jsonb, 'rules-1'
  )).id),
  'same idempotency key atomically reuses its generation job'
);

select is(
  (select count(*) from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key'),
  1::bigint,
  'same idempotency key leaves one generation job'
);

create function private.test_reject_generation_job_finalization()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' then
    raise exception 'test finalization failure';
  end if;
  return new;
end;
$$;

create trigger test_reject_generation_job_finalization
  before update on private.plan_generation_jobs
  for each row execute function private.test_reject_generation_job_finalization();

select throws_ok(
  $$select private.publish_and_finalize_training_plan(
    '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d6',
    (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key'),
    'Build endurance safely.', '{"status":"approved"}'::jsonb,
    '{"sessions":[{"position":1,"scheduled_offset_days":0,"phase":"base","objective":"Build endurance.","intensity":"moderate","expected_duration_minutes":40,"recovery_guidance":"Rest.","blocks":[{"position":1,"phase":"main","title":"Capacity","instructions":"Use controlled effort.","duration_minutes":20,"exercises":[{"position":1,"exercise_id":"00000000-0000-0000-0000-0000000000e5","exercise_content_version":1,"sets":3}]}]}]}'::jsonb,
    'test-generator', 'rules-1', null, null, 1, '{}'::jsonb
  )$$,
  'P0001', 'test finalization failure',
  'a finalization failure rolls back publication'
);

select is(
  (select count(*) from public.training_plans where source_generation_job_id = (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key')),
  0::bigint,
  'failed finalization leaves no published plan to duplicate'
);

drop trigger test_reject_generation_job_finalization on private.plan_generation_jobs;
drop function private.test_reject_generation_job_finalization();

select lives_ok(
  $$select private.publish_and_finalize_training_plan(
    '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d6',
    (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key'),
    'Build endurance safely.', '{"status":"approved"}'::jsonb,
    '{"sessions":[{"position":1,"scheduled_offset_days":0,"phase":"base","objective":"Build endurance.","intensity":"moderate","expected_duration_minutes":40,"recovery_guidance":"Rest.","blocks":[{"position":1,"phase":"main","title":"Capacity","instructions":"Use controlled effort.","duration_minutes":20,"exercises":[{"position":1,"exercise_id":"00000000-0000-0000-0000-0000000000e5","exercise_content_version":1,"sets":3}]}]}]}'::jsonb,
    'test-generator', 'rules-1', null, null, 1, '{}'::jsonb
  )$$,
  'retry finalizes and publishes once'
);

select lives_ok(
  $$select private.publish_and_finalize_training_plan(
    '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d6',
    (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key'),
    'Build endurance safely.', '{"status":"approved"}'::jsonb,
    '{"sessions":[{"position":1,"scheduled_offset_days":0,"phase":"base","objective":"Build endurance.","intensity":"moderate","expected_duration_minutes":40,"recovery_guidance":"Rest.","blocks":[{"position":1,"phase":"main","title":"Capacity","instructions":"Use controlled effort.","duration_minutes":20,"exercises":[{"position":1,"exercise_id":"00000000-0000-0000-0000-0000000000e5","exercise_content_version":1,"sets":3}]}]}]}'::jsonb,
    'test-generator', 'rules-1', null, null, 1, '{}'::jsonb
  )$$,
  'finalization retry reuses the published plan'
);

select is(
  (select count(*) from public.training_plans where source_generation_job_id = (select id from private.plan_generation_jobs where athlete_id = '00000000-0000-0000-0000-0000000000d4' and idempotency_key = 'same-key')),
  1::bigint,
  'publication finalization retry cannot create a duplicate plan'
);

select * from finish();

rollback;
