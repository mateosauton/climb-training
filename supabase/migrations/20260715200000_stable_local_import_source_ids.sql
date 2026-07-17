-- A receipt identifies an import attempt, not a local record.  Hash changes
-- when the recovery envelope grows, so derived IDs must be tied to the athlete
-- and local record ID in order to make successive receipts merge safely.
create or replace function public.import_local_metadata(
  p_athlete_id uuid, p_source_schema text, p_payload_hash text, p_envelope jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.import_receipts%rowtype;
  v_user jsonb;
  v_fact jsonb;
  v_log jsonb;
  v_run jsonb;
  v_receipt_id uuid;
  v_status text;
  v_video_ids jsonb;
begin
  insert into public.import_receipts (athlete_id, source_schema, payload_hash, receipt)
  values (p_athlete_id, p_source_schema, p_payload_hash, '{"status":"received"}'::jsonb)
  on conflict (athlete_id, source_schema, payload_hash) do nothing;

  select * into v_receipt from public.import_receipts
  where athlete_id = p_athlete_id and source_schema = p_source_schema and payload_hash = p_payload_hash
  for update;
  v_receipt_id := v_receipt.id;
  v_status := v_receipt.receipt->>'status';
  if v_status = 'completed' then
    return jsonb_build_object('status', 'completed', 'receiptId', v_receipt_id, 'pendingVideoIds', '[]'::jsonb);
  end if;
  if v_status = 'metadata_imported' then
    return jsonb_build_object('status', 'metadata_imported', 'receiptId', v_receipt_id,
      'pendingVideoIds', coalesce(v_receipt.receipt->'video_ids', '[]'::jsonb));
  end if;

  v_user := p_envelope->'users'->(p_envelope->>'activeUserId');
  for v_fact in select value from jsonb_array_elements(v_user->'facts') loop
    insert into public.athlete_facts (id, athlete_id, fact_key, value, source, created_at)
    select
      private.local_import_uuid(p_athlete_id::text || ':fact:' || (v_fact->>'id')),
      p_athlete_id, v_fact->>'key', v_fact->'value',
      jsonb_build_object('type','import','field',v_fact->>'key','version',3,'local_id',v_fact->>'id','unit',v_fact->'unit'),
      (v_fact->>'recordedAt')::timestamptz
    where not exists (
      select 1 from public.athlete_facts
      where athlete_id = p_athlete_id and source->>'local_id' = v_fact->>'id'
    ) on conflict (id) do nothing;
  end loop;
  for v_fact in select value from jsonb_array_elements(v_user->'facts') loop
    if v_fact->>'supersedes' is not null then
      update public.athlete_facts as fact set supersedes_id = superseded.id
      from public.athlete_facts as superseded
      where fact.athlete_id = p_athlete_id
        and fact.source->>'local_id' = v_fact->>'id'
        and superseded.athlete_id = p_athlete_id
        and superseded.source->>'local_id' = v_fact->>'supersedes';
    end if;
  end loop;
  for v_log in select value from jsonb_array_elements(v_user->'sessionLogs') loop
    insert into public.session_logs (id, athlete_id, body, rpe, pump, pain, energy, metrics, created_at)
    select
      private.local_import_uuid(p_athlete_id::text || ':log:' || (v_log->>'id')), p_athlete_id,
      nullif(v_log->>'notes',''), (v_log->>'rpe')::integer, (v_log->>'pump')::integer,
      (v_log->>'pain')::integer, (v_log->>'energy')::integer,
      jsonb_build_object('imported_source_id',v_log->>'id','session_id',v_log->>'sessionId','attempts',v_log->'attempts','moves',v_log->'moves','best_link',v_log->'bestLink','foot_cuts',v_log->'footCuts','pull_weight',v_log->'pullWeight','sleep',v_log->'sleep'),
      (v_log->>'createdAt')::timestamptz
    where not exists (
      select 1 from public.session_logs
      where athlete_id = p_athlete_id and metrics->>'imported_source_id' = v_log->>'id'
    ) on conflict (id) do nothing;
  end loop;
  for v_run in select value from jsonb_array_elements(coalesce(v_user->'guidedSessions'->'history', '[]'::jsonb) ||
    case when v_user->'guidedSessions'->'activeRun' is null then '[]'::jsonb else jsonb_build_array(v_user->'guidedSessions'->'activeRun') end) loop
    insert into public.imported_guided_runs (id, athlete_id, local_run_id, session_key, state)
    values (private.local_import_uuid(p_athlete_id::text || ':guided:' || (v_run->>'id')), p_athlete_id, v_run->>'id', v_run->>'sessionId', v_run)
    on conflict (athlete_id, local_run_id) do nothing;
  end loop;
  select coalesce(jsonb_agg(value->>'id'), '[]'::jsonb) into v_video_ids from jsonb_array_elements(v_user->'videoAnalyses');
  update public.import_receipts set receipt = jsonb_build_object(
    'status','metadata_imported','video_ids',v_video_ids,
    'counts',jsonb_build_object('facts',jsonb_array_length(v_user->'facts'),'logs',jsonb_array_length(v_user->'sessionLogs'),'guided_runs',jsonb_array_length(coalesce(v_user->'guidedSessions'->'history','[]'::jsonb)) + case when v_user->'guidedSessions'->'activeRun' is null then 0 else 1 end,'videos',jsonb_array_length(v_user->'videoAnalyses'))
  ) where id = v_receipt_id;
  if jsonb_array_length(v_video_ids) = 0 then
    update public.import_receipts set receipt = jsonb_build_object('status','completed','video_ids','[]'::jsonb) where id = v_receipt_id;
    return jsonb_build_object('status','completed','receiptId',v_receipt_id,'pendingVideoIds','[]'::jsonb);
  end if;
  return jsonb_build_object('status','metadata_imported','receiptId',v_receipt_id,'pendingVideoIds',v_video_ids);
end;
$$;

create or replace function public.complete_local_import_videos(p_athlete_id uuid, p_receipt_id uuid, p_videos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_receipt public.import_receipts%rowtype; v_video jsonb; v_expected jsonb;
begin
  select * into v_receipt from public.import_receipts where id = p_receipt_id and athlete_id = p_athlete_id for update;
  if not found then raise exception 'receipt not found' using errcode = 'P0002'; end if;
  if v_receipt.receipt->>'status' = 'completed' then return jsonb_build_object('status','completed'); end if;
  v_expected := coalesce(v_receipt.receipt->'video_ids','[]'::jsonb);
  if jsonb_array_length(p_videos) <> jsonb_array_length(v_expected) then raise exception 'incomplete video set' using errcode = '22023'; end if;
  for v_video in select value from jsonb_array_elements(p_videos) loop
    if not (v_expected ? (v_video->>'id'))
      or split_part(v_video->>'path', '/', 1) <> p_athlete_id::text
      or split_part(v_video->>'path', '/', 2) <> v_video->>'id'
      or split_part(v_video->>'path', '/', 3) !~ '^original\.(mp4|mov|webm)$'
      or array_length(string_to_array(v_video->>'path', '/'), 1) <> 3
      or not exists (select 1 from storage.objects where bucket_id = 'climbing-videos' and name = v_video->>'path') then
      raise exception 'video object verification failed' using errcode = '22023';
    end if;
    insert into public.video_assets (id, athlete_id, object_path, checksum, mime_type, byte_size, duration_seconds, upload_status, processing_status)
    values (private.local_import_uuid(p_athlete_id::text || ':video:' || (v_video->>'id')), p_athlete_id, v_video->>'path', lower(v_video->>'checksum'), v_video->>'mime_type', (v_video->>'byte_size')::bigint, (v_video->>'duration_seconds')::integer, 'uploaded', 'pending')
    on conflict (object_path) do update set checksum = excluded.checksum, upload_status = 'uploaded', processing_status = 'pending';
  end loop;
  update public.import_receipts set receipt = jsonb_build_object('status','completed','video_ids',v_expected) where id = p_receipt_id;
  return jsonb_build_object('status','completed');
end;
$$;
