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
