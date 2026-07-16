begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000701', 'authenticated', 'authenticated', 'video-a@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000702', 'authenticated', 'authenticated', 'video-b@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.video_assets (
  id, athlete_id, object_path, checksum, mime_type, byte_size, upload_status, processing_status
) values
  ('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000701/00000000-0000-0000-0000-000000000711/original.mp4', repeat('a', 64), 'video/mp4', 100, 'uploaded', 'pending'),
  ('00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000702/00000000-0000-0000-0000-000000000712/original.mp4', repeat('b', 64), 'video/mp4', 100, 'uploaded', 'pending');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000701';

select lives_ok(
  $$select public.request_video_analysis('00000000-0000-0000-0000-000000000711', 'request-1')$$,
  'athlete can request analysis for an owned uploaded video'
);

select is(
  public.request_video_analysis('00000000-0000-0000-0000-000000000711', 'request-1'),
  public.request_video_analysis('00000000-0000-0000-0000-000000000711', 'request-1'),
  'idempotent request returns the same job'
);

select throws_ok(
  $$select public.request_video_analysis('00000000-0000-0000-0000-000000000712', 'cross-user')$$,
  'P0002', 'video asset not found',
  'athlete cannot request another athlete video'
);

select is(
  (select count(*) from public.video_analysis_status), 1::bigint,
  'RLS exposes only the athlete job status'
);

select is(
  (select count(*) from public.video_evidence), 0::bigint,
  'evidence starts empty and is owner-readable'
);

reset role;

select ok(
  has_function_privilege('authenticated', 'public.request_video_analysis(uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.request_video_analysis(uuid,text)', 'EXECUTE'),
  'only authenticated athletes can request analysis'
);

select ok(
  has_function_privilege('service_role', 'public.claim_video_analysis_job(text,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.claim_video_analysis_job(text,integer)', 'EXECUTE'),
  'only service role can claim jobs'
);

select ok(
  has_function_privilege('service_role', 'public.checkpoint_video_analysis_job(uuid,text,integer,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.checkpoint_video_analysis_job(uuid,text,integer,jsonb)', 'EXECUTE'),
  'only service role can checkpoint jobs'
);

select ok(
  has_function_privilege('service_role', 'public.finalize_video_analysis_job(uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finalize_video_analysis_job(uuid,jsonb)', 'EXECUTE'),
  'only service role can finalize jobs'
);

select ok(
  has_function_privilege('service_role', 'public.get_reviewed_climbing_knowledge()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.get_reviewed_climbing_knowledge()', 'EXECUTE'),
  'only service role can read reviewed climbing knowledge'
);

select is(
  jsonb_array_length(public.get_reviewed_climbing_knowledge()) >= 3,
  true,
  'reviewed coaching knowledge is seeded with attributable entries'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'browser role has no private schema access'
);

select ok(
  row_security_active('public.video_analysis_status'::regclass)
  and row_security_active('public.video_evidence'::regclass)
  and row_security_active('public.video_observations'::regclass)
  and row_security_active('public.video_recommendations'::regclass)
  and row_security_active('public.video_recommendation_feedback'::regclass)
  and row_security_active('public.video_theme_snapshots'::regclass),
  'all exposed video intelligence tables use RLS'
);

select ok(
  has_table_privilege('authenticated', 'public.video_analysis_status', 'SELECT')
  and not has_table_privilege('authenticated', 'public.video_analysis_status', 'INSERT')
  and not has_table_privilege('authenticated', 'public.video_analysis_status', 'UPDATE'),
  'athletes can only read job status'
);

select ok(
  has_table_privilege('authenticated', 'public.video_recommendation_feedback', 'SELECT')
  and has_table_privilege('authenticated', 'public.video_recommendation_feedback', 'INSERT')
  and not has_table_privilege('authenticated', 'public.video_recommendation_feedback', 'UPDATE'),
  'feedback is append-only for athletes'
);

select * from finish();
rollback;
