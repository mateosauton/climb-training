begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000401', 'authenticated', 'authenticated', 'cloud-athlete-a@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000402', 'authenticated', 'authenticated', 'cloud-athlete-b@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

delete from public.athlete_profiles;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000401';

select lives_ok(
  $$select public.ensure_athlete_profile()$$,
  'authenticated athlete can bootstrap their own profile'
);

select is(
  (select count(*) from public.athlete_profiles where athlete_id = '00000000-0000-0000-0000-000000000401'),
  1::bigint,
  'profile RPC derives the authenticated athlete ID'
);

select is(
  (select count(*) from public.athlete_profiles where athlete_id = '00000000-0000-0000-0000-000000000402'),
  0::bigint,
  'profile RPC cannot bootstrap another athlete'
);

select lives_ok(
  $$insert into public.questionnaire_submissions (athlete_id, answers, idempotency_key, source)
    values ('00000000-0000-0000-0000-000000000401', '{"goal":"boulder"}'::jsonb, 'questionnaire-1', '{"version":2}'::jsonb)$$,
  'athlete records a questionnaire with an idempotency key'
);

select throws_ok(
  $$insert into public.questionnaire_submissions (athlete_id, answers, idempotency_key, source)
    values ('00000000-0000-0000-0000-000000000401', '{"goal":"boulder"}'::jsonb, 'questionnaire-1', '{"version":2}'::jsonb)$$,
  '23505',
  null,
  'duplicate questionnaire idempotency key conflicts'
);

select is(
  (select count(*) from public.questionnaire_submissions where athlete_id = '00000000-0000-0000-0000-000000000401' and idempotency_key = 'questionnaire-1'),
  1::bigint,
  'questionnaire idempotency key leaves one durable submission'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '';

select throws_ok(
  $$select public.ensure_athlete_profile()$$,
  '28000',
  'authentication required',
  'profile RPC rejects unauthenticated callers'
);

reset role;

select ok(
  has_function_privilege('authenticated', 'public.ensure_athlete_profile()', 'EXECUTE')
  and not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated callers can execute only the public profile RPC'
);

select ok(
  has_function_privilege('service_role', 'public.import_local_metadata(uuid,text,text,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.complete_local_import_videos(uuid,uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.import_local_metadata(uuid,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.import_local_metadata(uuid,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.complete_local_import_videos(uuid,uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.complete_local_import_videos(uuid,uuid,jsonb)', 'EXECUTE'),
  'only service role can execute import RPCs'
);

select * from finish();

rollback;
