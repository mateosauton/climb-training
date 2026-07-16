begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

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
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated',
    'authenticated',
    'athlete-a@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000b2',
    'authenticated',
    'authenticated',
    'athlete-b@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select is(
  (select count(*) from public.athlete_profiles),
  2::bigint,
  'creating auth users bootstraps profiles'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';

select is(
  (select count(*) from public.athlete_profiles where athlete_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'athlete A reads own profile'
);

select lives_ok(
  $$insert into public.athlete_facts (id, athlete_id, fact_key, value, source)
    values (
      '00000000-0000-0000-0000-0000000000f1',
      '00000000-0000-0000-0000-0000000000a1',
      'preferred_grip',
      '"crimp"'::jsonb,
      '{"kind":"questionnaire"}'::jsonb
    )$$,
  'athlete A inserts own fact'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000b2';

select lives_ok(
  $$insert into public.athlete_facts (id, athlete_id, fact_key, value, source)
    values (
      '00000000-0000-0000-0000-0000000000f2',
      '00000000-0000-0000-0000-0000000000b2',
      'preferred_grip',
      '"open_hand"'::jsonb,
      '{"kind":"questionnaire"}'::jsonb
    )$$,
  'athlete B inserts own fact'
);

set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-0000000000a1';

select isnt(
  (select count(*) from public.athlete_profiles where athlete_id = '00000000-0000-0000-0000-0000000000b2'),
  1::bigint,
  'RLS hides another athlete profile'
);

select isnt(
  (select count(*) from public.athlete_facts where athlete_id = '00000000-0000-0000-0000-0000000000b2'),
  1::bigint,
  'RLS hides another athlete facts'
);

select throws_ok(
  $$update public.athlete_facts set value = '"changed"'::jsonb where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '42501',
  null,
  'facts are immutable'
);

select * from finish();

rollback;
