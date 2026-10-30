begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select ok(
  (select i.indpred is null
    from pg_index i
    join pg_class c on c.oid = i.indexrelid
    where c.relname = 'session_logs_athlete_idempotency_key_idx'),
  'session log idempotency index matches ON CONFLICT (athlete_id, idempotency_key)'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c101', 'authenticated', 'authenticated', 'log-athlete-a@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c102', 'authenticated', 'authenticated', 'log-athlete-b@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.training_plans (id, athlete_id, version_number, status, rationale, safety_result) values
  ('00000000-0000-4000-8000-00000000c111', '00000000-0000-4000-8000-00000000c101', 1, 'draft', 'Plan A.', '{}'::jsonb),
  ('00000000-0000-4000-8000-00000000c112', '00000000-0000-4000-8000-00000000c102', 1, 'draft', 'Plan B.', '{}'::jsonb);

insert into public.plan_sessions (
  id, plan_id, athlete_id, position, scheduled_offset_days, phase, objective,
  intensity, expected_duration_minutes, recovery_guidance
) values
  ('00000000-0000-4000-8000-00000000c121', '00000000-0000-4000-8000-00000000c111', '00000000-0000-4000-8000-00000000c101', 1, 0, 'base', 'Train.', 'moderate', 45, 'Rest.'),
  ('00000000-0000-4000-8000-00000000c122', '00000000-0000-4000-8000-00000000c112', '00000000-0000-4000-8000-00000000c102', 1, 0, 'base', 'Train.', 'moderate', 45, 'Rest.');

insert into public.plan_blocks (id, session_id, position, phase, title, instructions, duration_minutes) values
  ('00000000-0000-4000-8000-00000000c131', '00000000-0000-4000-8000-00000000c121', 1, 'main', 'Move', 'Move carefully.', 20);

update public.training_plans
set status = 'active', published_at = now()
where id in ('00000000-0000-4000-8000-00000000c111', '00000000-0000-4000-8000-00000000c112');

insert into public.session_runs (id, athlete_id, plan_id, plan_session_id, status, started_at, last_progress_at) values
  ('00000000-0000-4000-8000-00000000c141', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c111', '00000000-0000-4000-8000-00000000c121', 'in_progress', now(), now());

insert into public.session_logs (id, athlete_id, session_binding, legacy_session_key, body) values
  ('00000000-0000-4000-8000-00000000c156', '00000000-0000-4000-8000-00000000c102', 'legacy', 'w2d4', 'other athlete');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000c101';

select lives_ok(
  $$insert into public.session_logs (
      id, athlete_id, run_id, plan_session_id, session_binding, idempotency_key, attempts, body
    ) values (
      '00000000-0000-4000-8000-00000000c151',
      '00000000-0000-4000-8000-00000000c101',
      '00000000-0000-4000-8000-00000000c141',
      '00000000-0000-4000-8000-00000000c121',
      'plan',
      '00000000-0000-4000-8000-00000000c161',
      4,
      'linked'
    )$$,
  'athlete inserts a log linked to their plan session and run'
);

select is(
  (select session_binding || ':' || plan_session_id::text || ':' || run_id::text
    from public.session_logs where id = '00000000-0000-4000-8000-00000000c151'),
  'plan:00000000-0000-4000-8000-00000000c121:00000000-0000-4000-8000-00000000c141',
  'plan log keeps the plan session and run'
);

select is(
  (select legacy_session_key is null and metrics = '{}'::jsonb
    from public.session_logs where id = '00000000-0000-4000-8000-00000000c151'),
  true,
  'plan log does not hide the session key inside metrics'
);

select lives_ok(
  $$insert into public.session_logs (
      id, athlete_id, session_binding, legacy_session_key, idempotency_key, attempts, body
    ) values (
      '00000000-0000-4000-8000-00000000c152',
      '00000000-0000-4000-8000-00000000c101',
      'legacy',
      'w2d4',
      '00000000-0000-4000-8000-00000000c162',
      3,
      'template'
    )$$,
  'athlete inserts an explicit legacy log'
);

select is(
  (select session_binding || ':' || legacy_session_key || ':' || coalesce(plan_session_id::text, '')
    from public.session_logs where id = '00000000-0000-4000-8000-00000000c152'),
  'legacy:w2d4:',
  'legacy log keeps the unmapped key and no plan session'
);

select lives_ok(
  $$insert into public.session_logs (id, athlete_id, session_binding, idempotency_key, body)
    values (
      '00000000-0000-4000-8000-00000000c153',
      '00000000-0000-4000-8000-00000000c101',
      'standalone',
      '00000000-0000-4000-8000-00000000c163',
      'free'
    )$$,
  'athlete inserts an explicit standalone log'
);

select is(
  (select session_binding = 'standalone' and plan_session_id is null and legacy_session_key is null
    from public.session_logs where id = '00000000-0000-4000-8000-00000000c153'),
  true,
  'standalone log has no session key'
);

select lives_ok(
  $$insert into public.session_logs (
      athlete_id, session_binding, legacy_session_key, idempotency_key, attempts, body
    ) values (
      '00000000-0000-4000-8000-00000000c101',
      'legacy',
      'w2d4',
      '00000000-0000-4000-8000-00000000c162',
      9,
      'duplicate'
    ) on conflict (athlete_id, idempotency_key) do nothing$$,
  'duplicate session log idempotency key is ignored'
);

select is(
  (select count(*) from public.session_logs
    where athlete_id = '00000000-0000-4000-8000-00000000c101'
      and idempotency_key = '00000000-0000-4000-8000-00000000c162'),
  1::bigint,
  'idempotent double submit leaves one session log'
);

select is(
  (select body from public.session_logs where idempotency_key = '00000000-0000-4000-8000-00000000c162'),
  'template',
  'ignored duplicate does not rewrite the saved log'
);

select lives_ok(
  $$insert into public.session_logs (id, athlete_id, session_binding, legacy_session_key, body) values
    ('00000000-0000-4000-8000-00000000c154', '00000000-0000-4000-8000-00000000c101', 'legacy', 'w1d1', 'first'),
    ('00000000-0000-4000-8000-00000000c155', '00000000-0000-4000-8000-00000000c101', 'legacy', 'w1d2', 'second')$$,
  'logs without an idempotency key can both be stored'
);

select throws_ok(
  $$insert into public.session_logs (athlete_id, plan_session_id, session_binding, body)
    values (
      '00000000-0000-4000-8000-00000000c101',
      '00000000-0000-4000-8000-00000000c122',
      'plan',
      'wrong session'
    )$$,
  '23514',
  'plan_session_id must belong to the same athlete',
  'plan session from another athlete is rejected'
);

select throws_ok(
  $$insert into public.session_logs (athlete_id, session_binding, legacy_session_key, body)
    values ('00000000-0000-4000-8000-00000000c102', 'legacy', 'w2d4', 'stolen')$$,
  '42501',
  null,
  'athlete cannot insert a session log for someone else'
);

select is(
  (select count(*) from public.session_logs where athlete_id = '00000000-0000-4000-8000-00000000c102'),
  0::bigint,
  'row level security hides another athlete session logs'
);

select throws_ok(
  $$update public.session_logs set body = 'changed' where id = '00000000-0000-4000-8000-00000000c152'$$,
  '42501',
  null,
  'athletes cannot update session logs'
);

select is(
  (select hydrate_athlete_state() #>> '{openSessionRun,id}'),
  '00000000-0000-4000-8000-00000000c141',
  'hydration exposes the in-progress run for the authenticated athlete'
);

select is(
  (select hydrate_athlete_state() #>> '{openSessionRun,plan_session_id}'),
  '00000000-0000-4000-8000-00000000c121',
  'hydration exposes the open run plan session'
);

reset role;
set local role anon;

select throws_ok(
  $$insert into public.session_logs (athlete_id, session_binding, legacy_session_key, body)
    values ('00000000-0000-4000-8000-00000000c101', 'legacy', 'w2d4', 'anon')$$,
  '42501',
  null,
  'anonymous role cannot insert session logs'
);

select * from finish();

rollback;
