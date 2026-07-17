create schema if not exists private;

revoke all on schema private from public;

create table public.athlete_profiles (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null unique references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null,
  source jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.athlete_facts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  fact_key text not null,
  value jsonb not null,
  source jsonb not null default '{}'::jsonb,
  supersedes_id uuid references public.athlete_facts(id),
  created_at timestamptz not null default now()
);

create index questionnaire_submissions_athlete_submitted_at_idx
  on public.questionnaire_submissions (athlete_id, submitted_at desc);

create index athlete_facts_athlete_created_at_idx
  on public.athlete_facts (athlete_id, created_at desc);

create index athlete_facts_supersedes_id_idx
  on public.athlete_facts (supersedes_id);

create function private.ensure_athlete_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.athlete_profiles (athlete_id)
  values (new.id)
  on conflict (athlete_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.ensure_athlete_profile();

create function private.validate_fact_supersedes_athlete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.supersedes_id is not null and not exists (
    select 1
    from public.athlete_facts
    where id = new.supersedes_id
      and athlete_id = new.athlete_id
  ) then
    raise exception 'supersedes_id must reference a fact for the same athlete'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_fact_supersedes_athlete
  before insert on public.athlete_facts
  for each row execute function private.validate_fact_supersedes_athlete();

alter table public.athlete_profiles enable row level security;
alter table public.questionnaire_submissions enable row level security;
alter table public.athlete_facts enable row level security;

grant select on public.athlete_profiles to authenticated;
grant select, insert on public.questionnaire_submissions to authenticated;
grant select, insert on public.athlete_facts to authenticated;

revoke update, delete on public.athlete_profiles from authenticated;
revoke update, delete on public.questionnaire_submissions from authenticated;
revoke update, delete on public.athlete_facts from authenticated;

create policy "athletes read own profiles"
  on public.athlete_profiles for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes insert own questionnaire submissions"
  on public.questionnaire_submissions for insert to authenticated
  with check ((select auth.uid()) = athlete_id);

create policy "athletes read own questionnaire submissions"
  on public.questionnaire_submissions for select to authenticated
  using ((select auth.uid()) = athlete_id);

create policy "athletes insert own facts"
  on public.athlete_facts for insert to authenticated
  with check ((select auth.uid()) = athlete_id);

create policy "athletes read own facts"
  on public.athlete_facts for select to authenticated
  using ((select auth.uid()) = athlete_id);
