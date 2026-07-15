create function public.append_video_analysis(
  p_video_asset_id uuid,
  p_status text,
  p_metrics jsonb,
  p_advice jsonb
)
returns public.video_analyses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_athlete_id uuid := auth.uid();
  v_analysis public.video_analyses;
begin
  if v_athlete_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_status not in ('completed', 'failed')
    or jsonb_typeof(p_metrics) <> 'object'
    or jsonb_typeof(p_advice) <> 'object' then
    raise exception 'invalid video analysis' using errcode = '22023';
  end if;

  perform 1
  from public.video_assets
  where id = p_video_asset_id and athlete_id = v_athlete_id
  for update;
  if not found then
    raise exception 'video asset not found' using errcode = 'P0002';
  end if;

  insert into public.video_analyses (athlete_id, video_asset_id, analysis_version, status, metrics, advice)
  values (
    v_athlete_id,
    p_video_asset_id,
    (select coalesce(max(analysis_version), 0) + 1 from public.video_analyses where video_asset_id = p_video_asset_id),
    p_status,
    p_metrics,
    p_advice
  )
  returning * into v_analysis;
  return v_analysis;
end;
$$;

revoke all on function public.append_video_analysis(uuid, text, jsonb, jsonb) from public;
grant execute on function public.append_video_analysis(uuid, text, jsonb, jsonb) to authenticated;
