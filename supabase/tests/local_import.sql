begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000501', 'authenticated', 'authenticated', 'import@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

select lives_ok($$
  select public.import_local_metadata('00000000-0000-0000-0000-000000000501', 'local-schema-3', repeat('a',64),
  '{"activeUserId":"local","users":{"local":{"facts":[{"id":"f1","key":"heightCm","value":180,"unit":"cm","recordedAt":"2026-01-01T00:00:00Z","supersedes":null},{"id":"f2","key":"heightCm","value":181,"unit":"cm","recordedAt":"2026-01-02T00:00:00Z","supersedes":"f1"}],"sessionLogs":[{"id":"l1","notes":"ok","rpe":7,"pump":4,"pain":0,"energy":8,"attempts":2,"moves":3,"bestLink":2,"footCuts":0,"pullWeight":0,"sleep":8,"sessionId":"w1d1","createdAt":"2026-01-02T00:00:00Z"}],"videoAnalyses":[],"guidedSessions":{"activeRun":null,"history":[{"id":"g1","sessionId":"w1d1","status":"completed"}]}}}}'::jsonb)$$,
  'atomic importer writes a valid metadata receipt');

select is((select count(*) from public.athlete_facts where athlete_id = '00000000-0000-0000-0000-000000000501'), 2::bigint, 'facts are imported once');
select ok((select supersedes_id is not null from public.athlete_facts where source->>'local_id' = 'f2'), 'fact supersession resolves to deterministic imported ID');
select is((select count(*) from public.imported_guided_runs where athlete_id = '00000000-0000-0000-0000-000000000501'), 1::bigint, 'guided runs use the explicit legacy mapping table');
select lives_ok($$
  select public.import_local_metadata('00000000-0000-0000-0000-000000000501', 'local-schema-3', repeat('a',64),
  '{"activeUserId":"local","users":{"local":{"facts":[],"sessionLogs":[],"videoAnalyses":[],"guidedSessions":{"activeRun":null,"history":[]}}}}'::jsonb)$$,
  'a retry reuses the locked receipt rather than reinserting metadata');
select is((select count(*) from public.session_logs where athlete_id = '00000000-0000-0000-0000-000000000501'), 1::bigint, 'retry did not duplicate session logs');

select lives_ok($$
  select public.import_local_metadata('00000000-0000-0000-0000-000000000501', 'local-schema-3', repeat('b',64),
  '{"activeUserId":"local","users":{"local":{"facts":[{"id":"f1","key":"heightCm","value":180,"unit":"cm","recordedAt":"2026-01-01T00:00:00Z","supersedes":null},{"id":"f2","key":"heightCm","value":181,"unit":"cm","recordedAt":"2026-01-02T00:00:00Z","supersedes":"f1"},{"id":"f3","key":"weightKg","value":70,"unit":"kg","recordedAt":"2026-01-03T00:00:00Z","supersedes":null}],"sessionLogs":[{"id":"l1","notes":"ok","rpe":7,"pump":4,"pain":0,"energy":8,"attempts":2,"moves":3,"bestLink":2,"footCuts":0,"pullWeight":0,"sleep":8,"sessionId":"w1d1","createdAt":"2026-01-02T00:00:00Z"},{"id":"l2","notes":"new","rpe":6,"pump":3,"pain":0,"energy":7,"attempts":1,"moves":2,"bestLink":1,"footCuts":0,"pullWeight":0,"sleep":7,"sessionId":"w1d2","createdAt":"2026-01-03T00:00:00Z"}],"videoAnalyses":[],"guidedSessions":{"activeRun":null,"history":[{"id":"g1","sessionId":"w1d1","status":"completed"},{"id":"g2","sessionId":"w1d2","status":"completed"}]}}}}'::jsonb)$$,
  'a changed envelope imports successfully');
select is((select count(*) from public.athlete_facts where athlete_id = '00000000-0000-0000-0000-000000000501'), 3::bigint, 'changed envelope does not duplicate prior facts and imports a new fact');
select is((select count(*) from public.session_logs where athlete_id = '00000000-0000-0000-0000-000000000501'), 2::bigint, 'changed envelope does not duplicate prior logs and imports a new log');
select is((select count(*) from public.imported_guided_runs where athlete_id = '00000000-0000-0000-0000-000000000501'), 2::bigint, 'changed envelope does not duplicate prior guided runs and imports a new run');

select * from finish();
rollback;
