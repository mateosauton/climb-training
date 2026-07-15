begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

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

insert into public.training_plans (
  id,
  athlete_id,
  version_number,
  status,
  rationale,
  safety_result,
  published_at
) values (
  '00000000-0000-0000-0000-0000000000f6',
  '00000000-0000-0000-0000-0000000000c3',
  1,
  'active',
  'Build finger strength safely.',
  '{"status":"approved"}'::jsonb,
  now()
);

insert into public.plan_sessions (
  id,
  plan_id,
  athlete_id,
  position,
  scheduled_offset_days,
  phase,
  objective,
  intensity,
  expected_duration_minutes,
  recovery_guidance
) values (
  '00000000-0000-0000-0000-0000000000a7',
  '00000000-0000-0000-0000-0000000000f6',
  '00000000-0000-0000-0000-0000000000c3',
  1,
  0,
  'base',
  'Build finger strength.',
  'moderate',
  45,
  'Rest at least 48 hours before another finger session.'
);

insert into public.plan_blocks (
  id,
  session_id,
  position,
  phase,
  title,
  instructions,
  duration_minutes,
  completion_rules
) values (
  '00000000-0000-0000-0000-0000000000b8',
  '00000000-0000-0000-0000-0000000000a7',
  1,
  'main',
  'Finger strength',
  'Use controlled effort.',
  20,
  '{"stop_on_pain":true}'::jsonb
);

insert into public.plan_block_exercises (
  id,
  block_id,
  position,
  exercise_id,
  exercise_content_version,
  sets,
  reps,
  duration_seconds,
  load,
  rest_seconds,
  cues,
  substitutions,
  generator_context
) values (
  '00000000-0000-0000-0000-0000000000c9',
  '00000000-0000-0000-0000-0000000000b8',
  1,
  '00000000-0000-0000-0000-0000000000e5',
  1,
  3,
  1,
  10,
  '{"weight_kg":0}'::jsonb,
  120,
  array['Keep shoulders engaged.'],
  '[]'::jsonb,
  '{}'::jsonb
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000c3';

select is(
  (select count(*) from public.training_plans where id = '00000000-0000-0000-0000-0000000000f6'),
  1::bigint,
  'athlete A reads the published plan'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000d4';

select is(
  (select count(*) from public.training_plans where id = '00000000-0000-0000-0000-0000000000f6'),
  0::bigint,
  'athlete B cannot read athlete A plan'
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
  $$update public.training_plans set rationale = 'changed' where id = '00000000-0000-0000-0000-0000000000f6'$$,
  '55000',
  'published plan content is immutable',
  'published plans cannot be updated'
);

select throws_ok(
  $$delete from public.plan_sessions where id = '00000000-0000-0000-0000-0000000000a7'$$,
  '55000',
  'published plan content is immutable',
  'published sessions cannot be deleted'
);

select throws_ok(
  $$update public.plan_blocks set title = 'changed' where id = '00000000-0000-0000-0000-0000000000b8'$$,
  '55000',
  'published plan content is immutable',
  'published blocks cannot be updated'
);

select throws_ok(
  $$delete from public.plan_block_exercises where id = '00000000-0000-0000-0000-0000000000c9'$$,
  '55000',
  'published plan content is immutable',
  'published prescriptions cannot be deleted'
);

select is(
  (select count(*) from public.plan_block_exercises where block_id = '00000000-0000-0000-0000-0000000000b8' and position = 1),
  1::bigint,
  'valid ordered plan hierarchy is stored'
);

select * from finish();

rollback;
