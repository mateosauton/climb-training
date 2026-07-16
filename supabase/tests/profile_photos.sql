begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_column(
  'public',
  'athlete_profiles',
  'avatar_path',
  'athlete profiles persist an avatar object path'
);

select is(
  (select public from storage.buckets where id = 'profile-photos'),
  false,
  'profile photos bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'profile-photos'),
  5242880::bigint,
  'profile photos bucket limits files to 5 MB'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'profile-photos'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'profile photos bucket accepts only JPEG, PNG, and WebP'
);

select results_eq(
  $$select cmd
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like '%profile photos%'
      and roles @> array['authenticated'::name]
    order by cmd$$,
  $$values ('DELETE'::text), ('INSERT'::text), ('SELECT'::text), ('UPDATE'::text)$$,
  'authenticated has one profile photo policy for each CRUD operation'
);

select has_function(
  'public',
  'update_avatar_path',
  array['text'],
  'avatar path update RPC exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000701', 'authenticated', 'authenticated', 'avatar-athlete-a@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000702', 'authenticated', 'authenticated', 'avatar-athlete-b@example.com', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('profile-photos', '00000000-0000-0000-0000-000000000702/avatar.png')$$,
  'an existing object can be prepared for another athlete'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000701';

select lives_ok(
  $$update public.athlete_profiles
    set avatar_path = '00000000-0000-0000-0000-000000000701/avatar.webp'
    where athlete_id = '00000000-0000-0000-0000-000000000701'$$,
  'athlete can update their avatar path'
);

select is(
  (select avatar_path from public.athlete_profiles
    where athlete_id = '00000000-0000-0000-0000-000000000701'),
  '00000000-0000-0000-0000-000000000701/avatar.webp',
  'own avatar path update is persisted'
);

select lives_ok(
  $$select public.update_avatar_path('00000000-0000-0000-0000-000000000701/avatar.png')$$,
  'athlete can update their avatar path through the RPC'
);

select is(
  (select avatar_path from public.athlete_profiles
    where athlete_id = '00000000-0000-0000-0000-000000000701'),
  '00000000-0000-0000-0000-000000000701/avatar.png',
  'RPC persists the authenticated athlete avatar path'
);

select is(
  (public.hydrate_athlete_state()->'profile'->>'avatarPath'),
  '00000000-0000-0000-0000-000000000701/avatar.png',
  'hydration exposes the authenticated athlete avatar path'
);

select is(
  (with changed as (
    update public.athlete_profiles
    set avatar_path = 'forbidden.png'
    where athlete_id = '00000000-0000-0000-0000-000000000702'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'athlete cannot update another profile'
);

select throws_ok(
  $$update public.athlete_profiles set profile = '{"tampered":true}'::jsonb
    where athlete_id = '00000000-0000-0000-0000-000000000701'$$,
  '42501',
  null,
  'avatar grant does not allow other profile columns to be updated'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('profile-photos', '00000000-0000-0000-0000-000000000701/avatar.png')$$,
  'athlete inserts a profile photo in their UUID folder'
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'profile-photos'
      and name = '00000000-0000-0000-0000-000000000701/avatar.png'),
  1::bigint,
  'athlete selects a profile photo in their UUID folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('profile-photos', '00000000-0000-0000-0000-000000000702/forbidden.png')$$,
  '42501',
  null,
  'athlete cannot insert in another UUID folder'
);

select lives_ok(
  $$update storage.objects
    set metadata = '{"updated":true}'::jsonb
    where bucket_id = 'profile-photos'
      and name = '00000000-0000-0000-0000-000000000701/avatar.png'$$,
  'athlete updates their profile photo for Storage upsert support'
);

select is(
  (with changed as (
    update storage.objects
    set metadata = '{"forbidden":true}'::jsonb
    where bucket_id = 'profile-photos'
      and name = '00000000-0000-0000-0000-000000000702/avatar.png'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'athlete cannot update another athlete profile photo'
);

select throws_ok(
  $$update storage.objects
    set name = '00000000-0000-0000-0000-000000000702/stolen.png'
    where bucket_id = 'profile-photos'
      and name = '00000000-0000-0000-0000-000000000701/avatar.png'$$,
  '42501',
  null,
  'athlete cannot move their profile photo into another UUID folder'
);

select lives_ok(
  $$delete from storage.objects
    where bucket_id = 'profile-photos'
      and name = '00000000-0000-0000-0000-000000000701/avatar.png'$$,
  'athlete deletes their profile photo'
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'profile-photos'
      and name = '00000000-0000-0000-0000-000000000702/avatar.png'),
  0::bigint,
  'athlete cannot select another athlete profile photo'
);

select is(
  (with deleted as (
    delete from storage.objects
    where bucket_id = 'profile-photos'
      and name = '00000000-0000-0000-0000-000000000702/avatar.png'
    returning 1
  ) select count(*) from deleted),
  0::bigint,
  'athlete cannot delete another athlete profile photo'
);

select * from finish();

rollback;
