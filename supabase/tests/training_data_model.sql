begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select has_column('public', 'session_logs', 'plan_session_id', 'session logs reference a plan session');
select has_column('public', 'video_assets', 'plan_session_id', 'video assets reference a plan session');
select has_column('public', 'video_analyses', 'plan_session_id', 'video analyses reference a plan session');
select has_column('public', 'session_runs', 'session_binding', 'session runs record plan, legacy, or standalone binding');
select has_column('public', 'imported_guided_runs', 'plan_session_id', 'imported guided runs can map onto a plan session');

select is(
  (select string_agg(column_name::text, ',' order by column_name::text)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'session_logs'
      and column_name in ('attempts', 'best_link', 'foot_cuts', 'moves', 'plan_session_id', 'pull_weight', 'sleep')),
  'attempts,best_link,foot_cuts,moves,plan_session_id,pull_weight,sleep',
  'fixture training-data-model-ac02-v1 exposes plan_session_id and standard metric names'
);

select ok(
  (select col_description('public.session_logs'::regclass, attnum)
    from pg_attribute
    where attrelid = 'public.session_logs'::regclass and attname = 'plan_session_id' and not attisdropped
  ) like '%training-data-model-ac02-v1%',
  'plan_session_id comment cites fixture training-data-model-ac02-v1'
);

select ok(
  (select reloptions from pg_class where oid = 'public.current_athlete_profile'::regclass) @> array['security_invoker=true']
  and (select reloptions from pg_class where oid = 'public.training_plan_read_model'::regclass) @> array['security_invoker=true'],
  'profile and plan read models use the caller privileges'
);

select ok(
  not has_table_privilege('anon', 'public.current_athlete_profile', 'SELECT')
  and not has_table_privilege('anon', 'public.training_plan_read_model', 'SELECT')
  and has_table_privilege('authenticated', 'public.current_athlete_profile', 'SELECT')
  and has_table_privilege('authenticated', 'public.training_plan_read_model', 'SELECT'),
  'only authenticated athletes can read the new projections'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000a01', 'authenticated', 'authenticated', 'model-a@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000b01', 'authenticated', 'authenticated', 'model-b@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.exercise_catalog (
  id, content_version, title, instructions, safety_guidance, published_at
) values (
  '00000000-0000-4000-8000-000000000e01', 1, 'Hang', 'Hang.', 'Stop for pain.', now()
);

insert into public.training_plans (id, athlete_id, version_number, status, rationale, safety_result) values
  ('00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-000000000a01', 1, 'draft', 'Athlete A plan.', '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-000000000b01', 1, 'draft', 'Athlete B plan.', '{}'::jsonb);

select set_config('private.allow_plan_publication_build', 'on', true);

insert into public.plan_sessions (
  id, plan_id, athlete_id, position, scheduled_offset_days, phase, objective,
  intensity, expected_duration_minutes, recovery_guidance
) values
  ('00000000-0000-4000-8000-000000000a21', '00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-000000000a01', 1, 0, 'base', 'Train.', 'moderate', 45, 'Rest.'),
  ('00000000-0000-4000-8000-000000000b21', '00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-000000000b01', 1, 0, 'base', 'Train.', 'moderate', 45, 'Rest.');

insert into public.plan_blocks (id, session_id, position, phase, title, instructions, duration_minutes) values
  ('00000000-0000-4000-8000-000000000a31', '00000000-0000-4000-8000-000000000a21', 1, 'main', 'Hang', 'Hang easily.', 10);

insert into public.plan_block_exercises (
  id, block_id, position, exercise_id, exercise_content_version, sets, reps, duration_seconds
) values (
  '00000000-0000-4000-8000-000000000a41', '00000000-0000-4000-8000-000000000a31', 1,
  '00000000-0000-4000-8000-000000000e01', 1, 3, 1, 10
);

select set_config('private.allow_plan_publication_build', 'off', true);

update public.training_plans
set status = 'active', published_at = now()
where id in ('00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-000000000b11');

insert into public.athlete_facts (id, athlete_id, fact_key, value, source, created_at) values
  ('00000000-0000-4000-8000-000000000af1', '00000000-0000-4000-8000-000000000a01', 'heightCm', '180'::jsonb, '{}'::jsonb, '2026-01-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000af2', '00000000-0000-4000-8000-000000000a01', 'heightCm', '181'::jsonb, '{}'::jsonb, '2026-01-02T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000bf1', '00000000-0000-4000-8000-000000000b01', 'weightKg', '70'::jsonb, '{}'::jsonb, '2026-01-03T00:00:00Z');

update public.athlete_facts
set supersedes_id = '00000000-0000-4000-8000-000000000af1'
where id = '00000000-0000-4000-8000-000000000af2';

insert into public.session_logs (id, athlete_id, metrics) values (
  '00000000-0000-4000-8000-00000000ac02',
  '00000000-0000-4000-8000-000000000a01',
  '{"session_id":"w1d1","sessionId":"w1d2","best_link":2,"bestLink":9,"attempts":4,"notes":"kept"}'::jsonb
);

insert into public.session_logs (id, athlete_id, metrics) values (
  '00000000-0000-4000-8000-000000000a52',
  '00000000-0000-4000-8000-000000000a01',
  jsonb_build_object('session_id', '00000000-0000-4000-8000-000000000a21', 'sessionId', 'w1d1', 'best_link', 2, 'bestLink', 2)
);

insert into public.session_logs (id, athlete_id, metrics) values (
  '00000000-0000-4000-8000-000000000a53',
  '00000000-0000-4000-8000-000000000a01',
  '{"attempts":999,"pullWeight":12.5}'::jsonb
);

insert into public.session_logs (id, athlete_id, body, metrics) values (
  '00000000-0000-4000-8000-000000000a54',
  '00000000-0000-4000-8000-000000000a01',
  'imported',
  '{"imported_source_id":"l1","session_id":"w1d1","attempts":2,"moves":3,"best_link":2,"foot_cuts":0,"pull_weight":0,"sleep":8}'::jsonb
);

insert into public.session_logs (id, athlete_id, metrics) values (
  '00000000-0000-4000-8000-000000000b51',
  '00000000-0000-4000-8000-000000000b01',
  '{}'::jsonb
);

insert into public.session_runs (id, athlete_id, plan_id, plan_session_id, status) values
  ('00000000-0000-4000-8000-000000000a61', '00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-000000000a21', 'completed');

insert into public.video_assets (
  id, athlete_id, object_path, checksum, mime_type, byte_size, upload_status, processing_status, run_id
) values (
  '00000000-0000-4000-8000-000000000a71',
  '00000000-0000-4000-8000-000000000a01',
  '00000000-0000-4000-8000-000000000a01/00000000-0000-4000-8000-000000000a71/original.mp4',
  repeat('ab', 32), 'video/mp4', 10, 'uploaded', 'pending',
  '00000000-0000-4000-8000-000000000a61'
);

insert into public.video_analyses (
  athlete_id, video_asset_id, analysis_version, status, metrics, advice
) values (
  '00000000-0000-4000-8000-000000000a01',
  '00000000-0000-4000-8000-000000000a71',
  1, 'completed',
  '{"footCuts":2,"swing":3,"sessionId":"w1d9","notes":"clip"}'::jsonb,
  '{}'::jsonb
);

insert into public.imported_guided_runs (id, athlete_id, local_run_id, session_key, state) values
  ('00000000-0000-4000-8000-000000000a81', '00000000-0000-4000-8000-000000000a01', 'g1', 'w1d1', '{"id":"g1"}'::jsonb);

select results_eq(
  $$select session_binding, legacy_session_key, alternate_session_key, plan_session_id::text, attempts::text, best_link::text, body, metrics::text, metric_conflicts::text
    from public.session_logs where id = '00000000-0000-4000-8000-00000000ac02'$$,
  $$values ('legacy'::text, 'w1d1', 'w1d2', null, '4', '2', 'kept', '{}', '{"bestLink": 9}')$$,
  'fixture training-data-model-ac02-v1 keeps both session keys and the disagreed metric'
);

select results_eq(
  $$select session_binding, plan_session_id::text, legacy_session_key, alternate_session_key, best_link::text, metric_conflicts::text, metrics::text
    from public.session_logs where id = '00000000-0000-4000-8000-000000000a52'$$,
  $$values ('plan'::text, '00000000-0000-4000-8000-000000000a21', null, 'w1d1', '2', null, '{}')$$,
  'a mapped session id becomes plan_session_id and the unmapped alias is kept'
);

select results_eq(
  $$select attempts::text, pull_weight::text, session_binding, metric_conflicts::text
    from public.session_logs where id = '00000000-0000-4000-8000-000000000a53'$$,
  $$values (null, '12.5', 'standalone', '{"attempts": 999}')$$,
  'out-of-range metrics stay in conflicts and camelCase pull weight is standardized'
);

select results_eq(
  $$select imported_source_id, legacy_session_key, attempts::text, moves::text, best_link::text, foot_cuts::text, pull_weight::text, sleep::text, metrics::text
    from public.session_logs where id = '00000000-0000-4000-8000-000000000a54'$$,
  $$values ('l1'::text, 'w1d1', '2', '3', '2', '0', '0', '8', '{}')$$,
  'import-shaped snake_case metrics move to typed columns without dropping the source id'
);

select is(
  (select session_binding || ':' || coalesce(plan_session_id::text, '') from public.video_assets where id = '00000000-0000-4000-8000-000000000a71'),
  'plan:00000000-0000-4000-8000-000000000a21',
  'a video run inherits the run plan_session_id'
);

select results_eq(
  $$select session_binding, plan_session_id::text, alternate_session_key, foot_cuts::text, swing::text, notes, metrics::text
    from public.video_analyses where video_asset_id = '00000000-0000-4000-8000-000000000a71'$$,
  $$values ('plan'::text, '00000000-0000-4000-8000-000000000a21', 'w1d9', '2', '3', 'clip', '{}')$$,
  'video analysis metric aliases use standard names and keep the unmapped session key'
);

select is(
  (select session_binding || ':' || coalesce(plan_session_id::text, 'none') from public.imported_guided_runs where id = '00000000-0000-4000-8000-000000000a81'),
  'legacy:none',
  'unmapped guided runs stay on the explicit legacy path'
);

select is(
  (select value::text from public.current_athlete_profile where athlete_id = '00000000-0000-4000-8000-000000000a01' and fact_key = 'heightCm'),
  '181',
  'current profile keeps the newest non-superseded fact'
);

select is(
  (select training_plan_read_model.read_model_version::text
    || ':' || (sessions->0->>'id')
    || ':' || (sessions->0->'blocks'->0->'exercises'->0->>'exercise_id')
    from public.training_plan_read_model
    where id = '00000000-0000-4000-8000-000000000a11'),
  '1:00000000-0000-4000-8000-000000000a21:00000000-0000-4000-8000-000000000e01',
  'active plan read model version 1 includes sessions, blocks, and exercises'
);

create temporary table model_snapshot as
select to_jsonb(l) as row_data
from public.session_logs l
where l.id = '00000000-0000-4000-8000-00000000ac02';

update public.session_logs set metrics = metrics where id = '00000000-0000-4000-8000-00000000ac02';
select private.backfill_training_data_model();
select private.backfill_training_data_model();

select is(
  (select to_jsonb(l) from public.session_logs l where l.id = '00000000-0000-4000-8000-00000000ac02'),
  (select row_data from model_snapshot),
  'normalization and backfill are idempotent'
);

analyze public.session_logs;
analyze public.session_runs;
analyze public.video_assets;
analyze public.athlete_facts;
analyze public.training_plans;

create function pg_temp.explain_query(p_sql text)
returns text
language plpgsql
as $$
declare
  rec record;
  whole text := '';
begin
  for rec in execute 'explain ' || p_sql loop
    whole := whole || rec."QUERY PLAN" || E'\n';
  end loop;
  return whole;
end;
$$;

set local enable_seqscan = off;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000a01';

select is(
  (select count(*) from public.session_logs),
  4::bigint,
  'athlete A cannot read athlete B session logs'
);

select is(
  (select count(*) from public.current_athlete_profile),
  1::bigint,
  'current profile hides the other athlete'
);

select is(
  (select count(*) from public.training_plan_read_model),
  1::bigint,
  'plan read model hides the other athlete'
);

select is(
  (select public.hydrate_athlete_state()->'activePlan'->>'read_model_version')
    || ':' || (select public.hydrate_athlete_state()->'activePlan'->'sessions'->0->>'id')
    || ':' || (select public.hydrate_athlete_state()->'currentProfile'->0->>'fact_key'),
  '1:00000000-0000-4000-8000-000000000a21:heightCm',
  'hydration returns the versioned plan read model and current profile'
);

select throws_ok(
  $$insert into public.session_logs (athlete_id, plan_session_id, metrics)
    values ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000b21', '{}'::jsonb)$$,
  '23514',
  null,
  'a log cannot adopt another athlete plan_session_id'
);

select lives_ok(
  $$insert into public.session_runs (athlete_id, session_binding, legacy_session_key, status)
    values ('00000000-0000-4000-8000-000000000a01', 'legacy', 'w1d3', 'completed')$$,
  'legacy session runs are an explicit unmapped path'
);

select lives_ok(
  $$insert into public.session_logs (athlete_id, metrics)
    values ('00000000-0000-4000-8000-000000000a01', '{}'::jsonb)$$,
  'standalone session logs do not require a plan session'
);

select ok(
  pg_temp.explain_query($$select id from public.session_logs where athlete_id = '00000000-0000-4000-8000-000000000a01' and plan_session_id = '00000000-0000-4000-8000-000000000a21' order by created_at desc$$) ~* 'Index',
  'athlete and plan-session log lookup uses an index'
);

select ok(
  pg_temp.explain_query($$select id from public.session_logs where athlete_id = '00000000-0000-4000-8000-000000000a01' order by created_at desc$$) ~* 'Index',
  'athlete and time log lookup uses an index'
);

select ok(
  pg_temp.explain_query($$select fact_key from public.current_athlete_profile where athlete_id = '00000000-0000-4000-8000-000000000a01'$$) ~* 'Index',
  'current profile lookup uses an index'
);

select ok(
  pg_temp.explain_query($$select id from public.session_runs where athlete_id = '00000000-0000-4000-8000-000000000a01' order by created_at desc$$) ~* 'Index',
  'athlete and time run lookup uses an index'
);

select ok(
  pg_temp.explain_query($$select id from public.video_assets where athlete_id = '00000000-0000-4000-8000-000000000a01' and plan_session_id = '00000000-0000-4000-8000-000000000a21' order by created_at desc$$) ~* 'Index',
  'athlete and plan-session video lookup uses an index'
);

select * from finish();
rollback;
