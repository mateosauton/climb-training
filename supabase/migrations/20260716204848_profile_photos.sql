alter table public.athlete_profiles
  add column avatar_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant update (avatar_path) on public.athlete_profiles to authenticated;

create policy "athletes update own profile photos"
  on public.athlete_profiles for update to authenticated
  using ((select auth.uid()) = athlete_id)
  with check ((select auth.uid()) = athlete_id);

create function public.update_avatar_path(p_avatar_path text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.athlete_profiles
  set avatar_path = p_avatar_path
  where athlete_id = auth.uid();
end;
$$;

revoke all on function public.update_avatar_path(text) from public;
grant execute on function public.update_avatar_path(text) to authenticated;

create or replace function public.hydrate_athlete_state()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'facts', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at)
      from public.athlete_facts f where f.athlete_id = auth.uid()), '[]'::jsonb),
    'sessionLogs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at)
      from public.session_logs l where l.athlete_id = auth.uid()), '[]'::jsonb),
    'guided', coalesce((select state from public.athlete_guided_states where athlete_id = auth.uid()),
      '{"schemaVersion":1,"activeRun":null,"history":[]}'::jsonb),
    'activePlan', (select to_jsonb(p) from public.training_plans p
      where p.athlete_id = auth.uid() and p.status = 'active'),
    'profile', jsonb_build_object(
      'avatarPath', (select avatar_path from public.athlete_profiles where athlete_id = auth.uid())
    )
  );
$$;

create policy "athletes read own profile photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "athletes insert own profile photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "athletes replace own profile photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "athletes delete own profile photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
