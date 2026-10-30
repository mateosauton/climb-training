-- Canonical training data model (fixture training-data-model-ac02-v1).
--
-- Every log, run, and video records an explicit session binding:
--   plan        plan_session_id references public.plan_sessions
--   legacy      the source session key could not be mapped
--   standalone  the record is intentionally not tied to a session
-- Known metrics move to typed columns. jsonb metrics keeps only extensible
-- leftovers, and metric_conflicts keeps any alias that disagreed.

alter table public.session_logs
  add column plan_session_id uuid references public.plan_sessions(id) on delete restrict,
  add column legacy_session_key text,
  add column alternate_session_key text,
  add column session_binding text not null default 'standalone',
  add column attempts integer,
  add column moves integer,
  add column best_link integer,
  add column foot_cuts integer,
  add column pull_weight numeric,
  add column sleep numeric,
  add column metric_conflicts jsonb,
  add column imported_source_id text;

alter table public.session_runs
  add column legacy_session_key text,
  add column session_binding text not null default 'plan';

alter table public.session_runs
  alter column plan_id drop not null,
  alter column plan_session_id drop not null;

alter table public.video_assets
  add column plan_session_id uuid references public.plan_sessions(id) on delete restrict,
  add column legacy_session_key text,
  add column session_binding text not null default 'standalone';

alter table public.video_analyses
  add column plan_session_id uuid references public.plan_sessions(id) on delete restrict,
  add column legacy_session_key text,
  add column alternate_session_key text,
  add column session_binding text not null default 'standalone',
  add column foot_cuts integer,
  add column swing integer,
  add column hips integer,
  add column shoulder integer,
  add column breath integer,
  add column reading integer,
  add column notes text,
  add column metric_conflicts jsonb;

alter table public.imported_guided_runs
  add column plan_session_id uuid references public.plan_sessions(id) on delete restrict,
  add column session_binding text not null default 'legacy';

comment on column public.session_logs.plan_session_id is
  'Canonical plan session for this log. Fixture training-data-model-ac02-v1.';
comment on column public.session_logs.best_link is
  'Standard metric best_link. Aliases bestLink are folded here. Fixture training-data-model-ac02-v1.';
comment on column public.session_logs.session_binding is
  'plan, legacy, or standalone. Fixture training-data-model-ac02-v1.';

create function private.metric_number(value jsonb, minimum numeric, maximum numeric, integral boolean)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed numeric;
begin
  if value is null or jsonb_typeof(value) is distinct from 'number' then
    return null;
  end if;
  parsed := (value #>> '{}')::numeric;
  if integral and (parsed <> trunc(parsed) or parsed > 2147483647 or parsed < -2147483648) then
    return null;
  end if;
  if parsed < minimum or parsed > maximum then
    return null;
  end if;
  return parsed;
end;
$$;

create function private.fold_standard_metric(
  state jsonb,
  canonical text,
  alias text,
  minimum numeric,
  maximum numeric,
  integral boolean
) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  payload jsonb := state->'payload';
  conflicts jsonb := coalesce(state->'conflicts', '{}'::jsonb);
  existing numeric;
  snake jsonb := payload->canonical;
  camel jsonb;
  snake_ok numeric;
  camel_ok numeric;
  chosen numeric;
  has_snake boolean := payload ? canonical;
  has_camel boolean := alias is not null and payload ? alias;
begin
  if jsonb_typeof(state->'value') = 'number' then
    existing := (state->>'value')::numeric;
  end if;
  if alias is not null then
    camel := payload->alias;
  end if;

  if not has_snake and not has_camel then
    return state;
  end if;

  if has_snake then
    snake_ok := private.metric_number(snake, minimum, maximum, integral);
  end if;
  if has_camel then
    camel_ok := private.metric_number(camel, minimum, maximum, integral);
  end if;

  if snake_ok is not null then
    chosen := snake_ok;
  elsif camel_ok is not null then
    chosen := camel_ok;
  end if;

  if has_snake and snake_ok is null and jsonb_typeof(snake) is distinct from 'null' then
    conflicts := conflicts || jsonb_build_object(canonical, snake);
  end if;
  if has_camel and camel_ok is null and jsonb_typeof(camel) is distinct from 'null' then
    conflicts := conflicts || jsonb_build_object(alias, camel);
  elsif has_camel and snake_ok is not null and camel_ok is not null and snake_ok is distinct from camel_ok then
    conflicts := conflicts || jsonb_build_object(alias, camel);
  end if;

  if chosen is not null and existing is not null and chosen is distinct from existing then
    if has_snake and snake_ok is not null then
      conflicts := conflicts || jsonb_build_object(canonical, snake);
    end if;
    if has_camel and camel_ok is not null then
      conflicts := conflicts || jsonb_build_object(alias, camel);
    end if;
    chosen := existing;
  elsif chosen is null then
    chosen := existing;
  end if;

  payload := payload - canonical;
  if alias is not null then
    payload := payload - alias;
  end if;

  return jsonb_build_object(
    'payload', payload,
    'conflicts', conflicts,
    'value', case when chosen is null then 'null'::jsonb else to_jsonb(chosen) end
  );
end;
$$;

create function private.owned_plan_session_id(p_athlete_id uuid, p_candidate text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select s.id
  from public.plan_sessions s
  where p_candidate is not null
    and p_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and s.id = p_candidate::uuid
    and s.athlete_id = p_athlete_id
$$;

create function private.append_distinct_key(keys text[], candidate text, excluded text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when candidate is null or candidate = '' or candidate is not distinct from excluded or keys @> array[candidate]
      then keys
    else keys || candidate
  end
$$;

create function private.resolve_session_binding(
  p_athlete_id uuid,
  p_plan_session_id uuid,
  p_legacy_session_key text,
  p_alternate_session_key text,
  p_session_snake text,
  p_session_camel text,
  p_inherited_plan_session_id uuid,
  p_preserved_keys text[]
) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  chosen_plan uuid;
  chosen_legacy text;
  extras text[] := array[]::text[];
  preserved text;
  excluded text;
begin
  if p_plan_session_id is not null then
    if private.owned_plan_session_id(p_athlete_id, p_plan_session_id::text) is null then
      return jsonb_build_object('invalid', true);
    end if;
    chosen_plan := p_plan_session_id;
  else
    chosen_plan := coalesce(
      private.owned_plan_session_id(p_athlete_id, p_session_snake),
      private.owned_plan_session_id(p_athlete_id, p_session_camel),
      private.owned_plan_session_id(p_athlete_id, p_legacy_session_key)
    );
    if chosen_plan is null
      and p_inherited_plan_session_id is not null
      and private.owned_plan_session_id(p_athlete_id, p_inherited_plan_session_id::text) is not null then
      chosen_plan := p_inherited_plan_session_id;
    end if;
  end if;

  if chosen_plan is not null then
    excluded := chosen_plan::text;
    extras := private.append_distinct_key(extras, p_legacy_session_key, excluded);
    extras := private.append_distinct_key(extras, p_session_snake, excluded);
    extras := private.append_distinct_key(extras, p_session_camel, excluded);
    extras := private.append_distinct_key(extras, p_alternate_session_key, excluded);
    if p_preserved_keys is not null then
      foreach preserved in array p_preserved_keys loop
        extras := private.append_distinct_key(extras, preserved, excluded);
      end loop;
    end if;
    return jsonb_build_object(
      'invalid', false,
      'session_binding', 'plan',
      'plan_session_id', chosen_plan,
      'legacy_session_key', null,
      'alternate_session_key', case when cardinality(extras) >= 1 then extras[1] else null end,
      'session_keys', case when cardinality(extras) >= 2 then to_jsonb(extras) else null end
    );
  end if;

  chosen_legacy := coalesce(
    nullif(p_legacy_session_key, ''),
    nullif(p_session_snake, ''),
    nullif(p_session_camel, ''),
    nullif(p_alternate_session_key, '')
  );
  if p_preserved_keys is not null and chosen_legacy is null then
    foreach preserved in array p_preserved_keys loop
      if chosen_legacy is null and preserved is not null and preserved <> '' then
        chosen_legacy := preserved;
      end if;
    end loop;
  end if;

  if chosen_legacy is null then
    return jsonb_build_object(
      'invalid', false,
      'session_binding', 'standalone',
      'plan_session_id', null,
      'legacy_session_key', null,
      'alternate_session_key', null,
      'session_keys', null
    );
  end if;

  extras := private.append_distinct_key(extras, p_legacy_session_key, chosen_legacy);
  extras := private.append_distinct_key(extras, p_session_snake, chosen_legacy);
  extras := private.append_distinct_key(extras, p_session_camel, chosen_legacy);
  extras := private.append_distinct_key(extras, p_alternate_session_key, chosen_legacy);
  if p_preserved_keys is not null then
    foreach preserved in array p_preserved_keys loop
      extras := private.append_distinct_key(extras, preserved, chosen_legacy);
    end loop;
  end if;

  return jsonb_build_object(
    'invalid', false,
    'session_binding', 'legacy',
    'plan_session_id', null,
    'legacy_session_key', chosen_legacy,
    'alternate_session_key', case when cardinality(extras) >= 1 then extras[1] else null end,
    'session_keys', case when cardinality(extras) >= 2 then to_jsonb(extras) else null end
  );
end;
$$;

create function private.preserved_session_keys(conflicts jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(value), array[]::text[])
  from jsonb_array_elements_text(
    case
      when conflicts is not null and jsonb_typeof(conflicts->'session_keys') = 'array' then conflicts->'session_keys'
      else '[]'::jsonb
    end
  )
$$;

create function private.apply_resolved_binding(
  resolved jsonb,
  conflicts jsonb
) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  next_conflicts jsonb := coalesce(conflicts, '{}'::jsonb);
begin
  if resolved->'session_keys' is null or jsonb_typeof(resolved->'session_keys') = 'null' then
    next_conflicts := next_conflicts - 'session_keys';
  else
    next_conflicts := next_conflicts || jsonb_build_object('session_keys', resolved->'session_keys');
  end if;
  return jsonb_build_object(
    'session_binding', resolved->>'session_binding',
    'plan_session_id', resolved->'plan_session_id',
    'legacy_session_key', resolved->'legacy_session_key',
    'alternate_session_key', resolved->'alternate_session_key',
    'conflicts', next_conflicts
  );
end;
$$;

create function private.normalize_session_log()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  state jsonb;
  payload jsonb;
  conflicts jsonb;
  snake text;
  camel text;
  inherited uuid;
  resolved jsonb;
  applied jsonb;
begin
  if new.metrics is null or jsonb_typeof(new.metrics) <> 'object' then
    raise exception 'metrics must be an object' using errcode = '22023';
  end if;

  state := jsonb_build_object(
    'payload', new.metrics,
    'conflicts', coalesce(new.metric_conflicts, '{}'::jsonb),
    'value', 'null'::jsonb
  );

  state := jsonb_set(state, '{value}', case when new.attempts is null then 'null'::jsonb else to_jsonb(new.attempts) end);
  state := private.fold_standard_metric(state, 'attempts', null, 0, 200, true);
  new.attempts := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.moves is null then 'null'::jsonb else to_jsonb(new.moves) end);
  state := private.fold_standard_metric(state, 'moves', null, 0, 500, true);
  new.moves := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.best_link is null then 'null'::jsonb else to_jsonb(new.best_link) end);
  state := private.fold_standard_metric(state, 'best_link', 'bestLink', 0, 500, true);
  new.best_link := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.foot_cuts is null then 'null'::jsonb else to_jsonb(new.foot_cuts) end);
  state := private.fold_standard_metric(state, 'foot_cuts', 'footCuts', 0, 200, true);
  new.foot_cuts := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.pull_weight is null then 'null'::jsonb else to_jsonb(new.pull_weight) end);
  state := private.fold_standard_metric(state, 'pull_weight', 'pullWeight', -100, 200, false);
  new.pull_weight := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric else null end;

  state := jsonb_set(state, '{value}', case when new.sleep is null then 'null'::jsonb else to_jsonb(new.sleep) end);
  state := private.fold_standard_metric(state, 'sleep', null, 0, 10, false);
  new.sleep := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric else null end;

  state := jsonb_set(state, '{value}', case when new.rpe is null then 'null'::jsonb else to_jsonb(new.rpe) end);
  state := private.fold_standard_metric(state, 'rpe', null, 1, 10, true);
  new.rpe := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.pump is null then 'null'::jsonb else to_jsonb(new.pump) end);
  state := private.fold_standard_metric(state, 'pump', null, 0, 10, true);
  new.pump := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.pain is null then 'null'::jsonb else to_jsonb(new.pain) end);
  state := private.fold_standard_metric(state, 'pain', null, 0, 10, true);
  new.pain := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.energy is null then 'null'::jsonb else to_jsonb(new.energy) end);
  state := private.fold_standard_metric(state, 'energy', null, 0, 10, true);
  new.energy := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  payload := state->'payload';
  conflicts := coalesce(state->'conflicts', '{}'::jsonb);

  if payload ? 'notes' then
    if new.body is null or new.body is not distinct from payload->>'notes' then
      new.body := nullif(payload->>'notes', '');
    elsif payload->>'notes' is not null then
      conflicts := conflicts || jsonb_build_object('notes', payload->'notes');
    end if;
    payload := payload - 'notes';
  end if;

  if payload ? 'imported_source_id' then
    if new.imported_source_id is null then
      new.imported_source_id := nullif(payload->>'imported_source_id', '');
    elsif nullif(payload->>'imported_source_id', '') is distinct from new.imported_source_id then
      conflicts := conflicts || jsonb_build_object('imported_source_id', payload->'imported_source_id');
    end if;
    payload := payload - 'imported_source_id';
  end if;

  snake := case when payload ? 'session_id' then nullif(payload->>'session_id', '') else null end;
  camel := case when payload ? 'sessionId' then nullif(payload->>'sessionId', '') else null end;
  payload := payload - 'session_id' - 'sessionId';

  if new.run_id is not null then
    select r.plan_session_id into inherited
    from public.session_runs r
    where r.id = new.run_id and r.athlete_id = new.athlete_id;
  end if;

  resolved := private.resolve_session_binding(
    new.athlete_id,
    new.plan_session_id,
    new.legacy_session_key,
    new.alternate_session_key,
    snake,
    camel,
    inherited,
    private.preserved_session_keys(conflicts)
  );
  if coalesce((resolved->>'invalid')::boolean, false) then
    raise exception 'plan_session_id must belong to the same athlete'
      using errcode = '23514';
  end if;

  applied := private.apply_resolved_binding(resolved, conflicts);
  new.session_binding := applied->>'session_binding';
  new.plan_session_id := (applied->>'plan_session_id')::uuid;
  new.legacy_session_key := nullif(applied->>'legacy_session_key', '');
  new.alternate_session_key := nullif(applied->>'alternate_session_key', '');
  new.metrics := payload;
  new.metric_conflicts := nullif(applied->'conflicts', '{}'::jsonb);
  return new;
end;
$$;

create trigger normalize_session_log_metrics
  before insert or update on public.session_logs
  for each row execute function private.normalize_session_log();

create or replace function private.validate_session_run_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.plan_session_id is not null
    and private.owned_plan_session_id(new.athlete_id, new.plan_session_id::text) is null then
    raise exception 'plan_session_id must belong to the same athlete'
      using errcode = '23514';
  end if;

  if new.session_binding = 'plan' then
    if new.plan_id is null or new.plan_session_id is null or new.legacy_session_key is not null then
      raise exception 'plan session runs require plan_id and plan_session_id'
        using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.plan_sessions s
      where s.id = new.plan_session_id
        and s.plan_id = new.plan_id
        and s.athlete_id = new.athlete_id
    ) then
      raise exception 'plan_session_id must belong to the specified plan and athlete'
        using errcode = '23514';
    end if;
  elsif new.session_binding = 'legacy' then
    if new.plan_id is not null
      or new.plan_session_id is not null
      or new.legacy_session_key is null
      or char_length(new.legacy_session_key) = 0 then
      raise exception 'legacy session runs keep an unmapped session key and no plan session'
        using errcode = '23514';
    end if;
  elsif new.session_binding = 'standalone' then
    if new.plan_id is not null or new.plan_session_id is not null or new.legacy_session_key is not null then
      raise exception 'standalone session runs have no plan session'
        using errcode = '23514';
    end if;
  else
    raise exception 'invalid session_binding'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.normalize_video_asset_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  inherited uuid;
  resolved jsonb;
  applied jsonb;
begin
  if new.run_id is not null then
    select r.plan_session_id into inherited
    from public.session_runs r
    where r.id = new.run_id and r.athlete_id = new.athlete_id;
  end if;

  resolved := private.resolve_session_binding(
    new.athlete_id,
    new.plan_session_id,
    new.legacy_session_key,
    null,
    null,
    null,
    inherited,
    array[]::text[]
  );
  if coalesce((resolved->>'invalid')::boolean, false) then
    raise exception 'plan_session_id must belong to the same athlete'
      using errcode = '23514';
  end if;
  applied := private.apply_resolved_binding(resolved, '{}'::jsonb);
  new.session_binding := applied->>'session_binding';
  new.plan_session_id := (applied->>'plan_session_id')::uuid;
  new.legacy_session_key := nullif(applied->>'legacy_session_key', '');
  return new;
end;
$$;

create trigger normalize_video_asset_session
  before insert or update on public.video_assets
  for each row execute function private.normalize_video_asset_session();

create function private.normalize_video_analysis()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  state jsonb;
  payload jsonb;
  conflicts jsonb;
  snake text;
  camel text;
  inherited uuid;
  inherited_legacy text;
  resolved jsonb;
  applied jsonb;
begin
  if new.metrics is null or jsonb_typeof(new.metrics) <> 'object' then
    raise exception 'metrics must be an object' using errcode = '22023';
  end if;

  state := jsonb_build_object(
    'payload', new.metrics,
    'conflicts', coalesce(new.metric_conflicts, '{}'::jsonb),
    'value', 'null'::jsonb
  );

  state := jsonb_set(state, '{value}', case when new.foot_cuts is null then 'null'::jsonb else to_jsonb(new.foot_cuts) end);
  state := private.fold_standard_metric(state, 'foot_cuts', 'footCuts', 0, 1000, true);
  new.foot_cuts := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.swing is null then 'null'::jsonb else to_jsonb(new.swing) end);
  state := private.fold_standard_metric(state, 'swing', null, 0, 1000, true);
  new.swing := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.hips is null then 'null'::jsonb else to_jsonb(new.hips) end);
  state := private.fold_standard_metric(state, 'hips', null, 0, 1000, true);
  new.hips := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.shoulder is null then 'null'::jsonb else to_jsonb(new.shoulder) end);
  state := private.fold_standard_metric(state, 'shoulder', null, 0, 1000, true);
  new.shoulder := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.breath is null then 'null'::jsonb else to_jsonb(new.breath) end);
  state := private.fold_standard_metric(state, 'breath', null, 0, 1000, true);
  new.breath := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  state := jsonb_set(state, '{value}', case when new.reading is null then 'null'::jsonb else to_jsonb(new.reading) end);
  state := private.fold_standard_metric(state, 'reading', null, 0, 1000, true);
  new.reading := case when jsonb_typeof(state->'value') = 'number' then (state->>'value')::numeric::integer else null end;

  payload := state->'payload';
  conflicts := coalesce(state->'conflicts', '{}'::jsonb);

  if payload ? 'notes' then
    if new.notes is null or new.notes is not distinct from payload->>'notes' then
      new.notes := nullif(payload->>'notes', '');
    elsif payload->>'notes' is not null then
      conflicts := conflicts || jsonb_build_object('notes', payload->'notes');
    end if;
    payload := payload - 'notes';
  end if;

  snake := case when payload ? 'session_id' then nullif(payload->>'session_id', '') else null end;
  camel := case when payload ? 'sessionId' then nullif(payload->>'sessionId', '') else null end;
  payload := payload - 'session_id' - 'sessionId';

  select a.plan_session_id, a.legacy_session_key
    into inherited, inherited_legacy
  from public.video_assets a
  where a.id = new.video_asset_id and a.athlete_id = new.athlete_id;

  if new.legacy_session_key is null and snake is null and camel is null then
    new.legacy_session_key := inherited_legacy;
  end if;

  resolved := private.resolve_session_binding(
    new.athlete_id,
    new.plan_session_id,
    new.legacy_session_key,
    new.alternate_session_key,
    snake,
    camel,
    inherited,
    private.preserved_session_keys(conflicts)
  );
  if coalesce((resolved->>'invalid')::boolean, false) then
    raise exception 'plan_session_id must belong to the same athlete'
      using errcode = '23514';
  end if;

  applied := private.apply_resolved_binding(resolved, conflicts);
  new.session_binding := applied->>'session_binding';
  new.plan_session_id := (applied->>'plan_session_id')::uuid;
  new.legacy_session_key := nullif(applied->>'legacy_session_key', '');
  new.alternate_session_key := nullif(applied->>'alternate_session_key', '');
  new.metrics := payload;
  new.metric_conflicts := nullif(applied->'conflicts', '{}'::jsonb);
  return new;
end;
$$;

create trigger normalize_video_analysis_metrics
  before insert or update on public.video_analyses
  for each row execute function private.normalize_video_analysis();

create function private.normalize_imported_guided_run()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved jsonb;
begin
  resolved := private.resolve_session_binding(
    new.athlete_id,
    new.plan_session_id,
    new.session_key,
    null,
    null,
    null,
    null,
    array[]::text[]
  );
  if coalesce((resolved->>'invalid')::boolean, false) then
    raise exception 'plan_session_id must belong to the same athlete'
      using errcode = '23514';
  end if;
  new.session_binding := resolved->>'session_binding';
  new.plan_session_id := (resolved->>'plan_session_id')::uuid;
  if new.session_binding = 'standalone' then
    new.session_binding := 'legacy';
  end if;
  return new;
end;
$$;

create trigger normalize_imported_guided_run_session
  before insert or update on public.imported_guided_runs
  for each row execute function private.normalize_imported_guided_run();

create function private.backfill_training_data_model()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.session_logs set metrics = metrics;
  update public.session_runs set status = status;
  update public.video_assets set object_path = object_path;
  update public.video_analyses set metrics = metrics;
  update public.imported_guided_runs set session_key = session_key;
end;
$$;

select private.backfill_training_data_model();

alter table public.session_logs
  add constraint session_logs_session_binding_check check (
    (session_binding = 'plan' and plan_session_id is not null and legacy_session_key is null)
    or (session_binding = 'legacy' and plan_session_id is null and legacy_session_key is not null and char_length(legacy_session_key) > 0)
    or (session_binding = 'standalone' and plan_session_id is null and legacy_session_key is null)
  ),
  add constraint session_logs_attempts_check check (attempts is null or attempts between 0 and 200),
  add constraint session_logs_moves_check check (moves is null or moves between 0 and 500),
  add constraint session_logs_best_link_check check (best_link is null or best_link between 0 and 500),
  add constraint session_logs_foot_cuts_check check (foot_cuts is null or foot_cuts between 0 and 200),
  add constraint session_logs_pull_weight_check check (pull_weight is null or pull_weight between -100 and 200),
  add constraint session_logs_sleep_check check (sleep is null or sleep between 0 and 10),
  add constraint session_logs_metric_conflicts_check check (metric_conflicts is null or jsonb_typeof(metric_conflicts) = 'object'),
  add constraint session_logs_alternate_session_key_check check (alternate_session_key is null or char_length(alternate_session_key) > 0),
  add constraint session_logs_imported_source_id_check check (imported_source_id is null or char_length(imported_source_id) > 0);

alter table public.session_runs
  add constraint session_runs_session_binding_check check (
    (session_binding = 'plan' and plan_id is not null and plan_session_id is not null and legacy_session_key is null)
    or (session_binding = 'legacy' and plan_id is null and plan_session_id is null and legacy_session_key is not null and char_length(legacy_session_key) > 0)
    or (session_binding = 'standalone' and plan_id is null and plan_session_id is null and legacy_session_key is null)
  );

alter table public.video_assets
  add constraint video_assets_session_binding_check check (
    (session_binding = 'plan' and plan_session_id is not null and legacy_session_key is null)
    or (session_binding = 'legacy' and plan_session_id is null and legacy_session_key is not null and char_length(legacy_session_key) > 0)
    or (session_binding = 'standalone' and plan_session_id is null and legacy_session_key is null)
  );

alter table public.video_analyses
  add constraint video_analyses_session_binding_check check (
    (session_binding = 'plan' and plan_session_id is not null and legacy_session_key is null)
    or (session_binding = 'legacy' and plan_session_id is null and legacy_session_key is not null and char_length(legacy_session_key) > 0)
    or (session_binding = 'standalone' and plan_session_id is null and legacy_session_key is null)
  ),
  add constraint video_analyses_foot_cuts_check check (foot_cuts is null or foot_cuts between 0 and 1000),
  add constraint video_analyses_swing_check check (swing is null or swing between 0 and 1000),
  add constraint video_analyses_hips_check check (hips is null or hips between 0 and 1000),
  add constraint video_analyses_shoulder_check check (shoulder is null or shoulder between 0 and 1000),
  add constraint video_analyses_breath_check check (breath is null or breath between 0 and 1000),
  add constraint video_analyses_reading_check check (reading is null or reading between 0 and 1000),
  add constraint video_analyses_metric_conflicts_check check (metric_conflicts is null or jsonb_typeof(metric_conflicts) = 'object'),
  add constraint video_analyses_alternate_session_key_check check (alternate_session_key is null or char_length(alternate_session_key) > 0);

alter table public.imported_guided_runs
  add constraint imported_guided_runs_session_binding_check check (
    (session_binding = 'plan' and plan_session_id is not null)
    or (session_binding = 'legacy' and plan_session_id is null)
  );

create index session_logs_athlete_plan_session_created_idx
  on public.session_logs (athlete_id, plan_session_id, created_at desc)
  where plan_session_id is not null;

create index session_logs_athlete_legacy_session_created_idx
  on public.session_logs (athlete_id, legacy_session_key, created_at desc)
  where session_binding = 'legacy';

create index session_runs_athlete_plan_session_created_idx
  on public.session_runs (athlete_id, plan_session_id, created_at desc)
  where plan_session_id is not null;

create index video_assets_athlete_plan_session_created_idx
  on public.video_assets (athlete_id, plan_session_id, created_at desc)
  where plan_session_id is not null;

create index video_analyses_athlete_plan_session_created_idx
  on public.video_analyses (athlete_id, plan_session_id, created_at desc)
  where plan_session_id is not null;

create index athlete_facts_current_lookup_idx
  on public.athlete_facts (athlete_id, fact_key, created_at desc, id desc);

create index imported_guided_runs_plan_session_idx
  on public.imported_guided_runs (plan_session_id)
  where plan_session_id is not null;

create view public.current_athlete_profile
with (security_invoker = true) as
select distinct on (f.athlete_id, f.fact_key)
  f.athlete_id,
  f.fact_key,
  f.id as fact_id,
  f.value,
  f.source,
  f.created_at as recorded_at
from public.athlete_facts f
where not exists (
  select 1
  from public.athlete_facts newer
  where newer.supersedes_id = f.id
    and newer.athlete_id = f.athlete_id
)
order by f.athlete_id, f.fact_key, f.created_at desc, f.id desc;

comment on view public.current_athlete_profile is
  'Newest non-superseded fact per athlete and fact_key. Fixture training-data-model-ac02-v1.';

create view public.training_plan_read_model
with (security_invoker = true) as
select
  p.athlete_id,
  p.id,
  p.version_number,
  p.status,
  p.rationale,
  p.safety_result,
  p.published_at,
  p.created_at,
  p.generator_version,
  p.ruleset_version,
  p.prompt_version,
  p.model_version,
  p.output_schema_version,
  p.source_questionnaire_id,
  1 as read_model_version,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'position', s.position,
        'scheduled_offset_days', s.scheduled_offset_days,
        'phase', s.phase,
        'objective', s.objective,
        'intensity', s.intensity,
        'expected_duration_minutes', s.expected_duration_minutes,
        'recovery_guidance', s.recovery_guidance,
        'blocks', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', b.id,
              'position', b.position,
              'phase', b.phase,
              'title', b.title,
              'instructions', b.instructions,
              'duration_minutes', b.duration_minutes,
              'completion_rules', b.completion_rules,
              'exercises', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', e.id,
                    'position', e.position,
                    'exercise_id', e.exercise_id,
                    'exercise_content_version', e.exercise_content_version,
                    'sets', e.sets,
                    'reps', e.reps,
                    'duration_seconds', e.duration_seconds,
                    'load', e.load,
                    'rest_seconds', e.rest_seconds,
                    'cues', e.cues,
                    'substitutions', e.substitutions,
                    'generator_context', e.generator_context
                  )
                  order by e.position
                )
                from public.plan_block_exercises e
                where e.block_id = b.id
              ), '[]'::jsonb)
            )
            order by b.position
          )
          from public.plan_blocks b
          where b.session_id = s.id
        ), '[]'::jsonb)
      )
      order by s.position
    )
    from public.plan_sessions s
    where s.plan_id = p.id
  ), '[]'::jsonb) as sessions
from public.training_plans p;

comment on view public.training_plan_read_model is
  'Versioned complete training plan read model. read_model_version 1. Fixture training-data-model-ac02-v1.';

revoke all on public.current_athlete_profile from public, anon;
revoke all on public.training_plan_read_model from public, anon;
grant select on public.current_athlete_profile to authenticated;
grant select on public.training_plan_read_model to authenticated;

create or replace function public.hydrate_athlete_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'facts', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at)
      from public.athlete_facts f where f.athlete_id = (select auth.uid())), '[]'::jsonb),
    'sessionLogs', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at)
      from public.session_logs l where l.athlete_id = (select auth.uid())), '[]'::jsonb),
    'guided', coalesce((select state from public.athlete_guided_states where athlete_id = (select auth.uid())),
      '{"schemaVersion":1,"activeRun":null,"history":[]}'::jsonb),
    'activePlan', (
      select to_jsonb(v) - 'athlete_id'
      from public.training_plan_read_model v
      where v.athlete_id = (select auth.uid()) and v.status = 'active'
    ),
    'currentProfile', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fact_key', c.fact_key,
        'fact_id', c.fact_id,
        'value', c.value,
        'source', c.source,
        'recorded_at', c.recorded_at
      ) order by c.fact_key)
      from public.current_athlete_profile c
      where c.athlete_id = (select auth.uid())
    ), '[]'::jsonb),
    'profile', jsonb_build_object(
      'avatarPath', (select avatar_path from public.athlete_profiles where athlete_id = (select auth.uid()))
    )
  );
$$;

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
  v_video_sessions jsonb;
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
      where athlete_id = p_athlete_id
        and (
          imported_source_id = v_log->>'id'
          or metrics->>'imported_source_id' = v_log->>'id'
        )
    ) on conflict (id) do nothing;
  end loop;
  for v_run in select value from jsonb_array_elements(coalesce(v_user->'guidedSessions'->'history', '[]'::jsonb) ||
    case
      when jsonb_typeof(v_user->'guidedSessions'->'activeRun') = 'object'
        then jsonb_build_array(v_user->'guidedSessions'->'activeRun')
      else '[]'::jsonb
    end) loop
    insert into public.imported_guided_runs (id, athlete_id, local_run_id, session_key, state)
    values (private.local_import_uuid(p_athlete_id::text || ':guided:' || (v_run->>'id')), p_athlete_id, v_run->>'id', v_run->>'sessionId', v_run)
    on conflict (athlete_id, local_run_id) do nothing;
  end loop;
  select coalesce(jsonb_agg(value->>'id'), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('id', value->>'id', 'sessionId', value->>'sessionId')), '[]'::jsonb)
    into v_video_ids, v_video_sessions
  from jsonb_array_elements(coalesce(v_user->'videoAnalyses', '[]'::jsonb));
  update public.import_receipts set receipt = jsonb_build_object(
    'status','metadata_imported','video_ids',v_video_ids,'video_sessions',v_video_sessions,
    'counts',jsonb_build_object('facts',jsonb_array_length(v_user->'facts'),'logs',jsonb_array_length(v_user->'sessionLogs'),'guided_runs',jsonb_array_length(coalesce(v_user->'guidedSessions'->'history','[]'::jsonb)) + case when v_user->'guidedSessions'->'activeRun' is null then 0 else 1 end,'videos',jsonb_array_length(coalesce(v_user->'videoAnalyses','[]'::jsonb)))
  ) where id = v_receipt_id;
  if jsonb_array_length(v_video_ids) = 0 then
    update public.import_receipts set receipt = jsonb_build_object('status','completed','video_ids','[]'::jsonb,'video_sessions','[]'::jsonb) where id = v_receipt_id;
    return jsonb_build_object('status','completed','receiptId',v_receipt_id,'pendingVideoIds','[]'::jsonb);
  end if;
  return jsonb_build_object('status','metadata_imported','receiptId',v_receipt_id,'pendingVideoIds',v_video_ids);
end;
$$;

create or replace function public.complete_local_import_videos(p_athlete_id uuid, p_receipt_id uuid, p_videos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.import_receipts%rowtype;
  v_video jsonb;
  v_expected jsonb;
  v_session_id text;
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
    select elem->>'sessionId' into v_session_id
    from jsonb_array_elements(coalesce(v_receipt.receipt->'video_sessions', '[]'::jsonb)) elem
    where elem->>'id' = v_video->>'id'
    limit 1;
    insert into public.video_assets (
      id, athlete_id, object_path, checksum, mime_type, byte_size, duration_seconds,
      upload_status, processing_status, legacy_session_key
    )
    values (
      private.local_import_uuid(p_athlete_id::text || ':video:' || (v_video->>'id')),
      p_athlete_id, v_video->>'path', lower(v_video->>'checksum'), v_video->>'mime_type',
      (v_video->>'byte_size')::bigint, (v_video->>'duration_seconds')::integer, 'uploaded', 'pending',
      nullif(v_session_id, '')
    )
    on conflict (object_path) do update
      set checksum = excluded.checksum,
          upload_status = 'uploaded',
          processing_status = 'pending',
          legacy_session_key = coalesce(public.video_assets.legacy_session_key, excluded.legacy_session_key);
  end loop;
  update public.import_receipts set receipt = jsonb_build_object('status','completed','video_ids',v_expected,'video_sessions',coalesce(v_receipt.receipt->'video_sessions','[]'::jsonb)) where id = p_receipt_id;
  return jsonb_build_object('status','completed');
end;
$$;

revoke all on function private.backfill_training_data_model() from public, anon, authenticated;
revoke all on function private.metric_number(jsonb, numeric, numeric, boolean) from public;
revoke all on function private.fold_standard_metric(jsonb, text, text, numeric, numeric, boolean) from public;
revoke all on function private.owned_plan_session_id(uuid, text) from public;
revoke all on function private.append_distinct_key(text[], text, text) from public;
revoke all on function private.resolve_session_binding(uuid, uuid, text, text, text, text, uuid, text[]) from public;
revoke all on function private.preserved_session_keys(jsonb) from public;
revoke all on function private.apply_resolved_binding(jsonb, jsonb) from public;
revoke all on function private.normalize_session_log() from public;
revoke all on function private.normalize_video_asset_session() from public;
revoke all on function private.normalize_video_analysis() from public;
revoke all on function private.normalize_imported_guided_run() from public;

grant execute on function private.metric_number(jsonb, numeric, numeric, boolean) to authenticated, service_role;
grant execute on function private.fold_standard_metric(jsonb, text, text, numeric, numeric, boolean) to authenticated, service_role;
grant execute on function private.owned_plan_session_id(uuid, text) to authenticated, service_role;
grant execute on function private.append_distinct_key(text[], text, text) to authenticated, service_role;
grant execute on function private.resolve_session_binding(uuid, uuid, text, text, text, text, uuid, text[]) to authenticated, service_role;
grant execute on function private.preserved_session_keys(jsonb) to authenticated, service_role;
grant execute on function private.apply_resolved_binding(jsonb, jsonb) to authenticated, service_role;
grant execute on function private.normalize_session_log() to authenticated, service_role;
grant execute on function private.normalize_video_asset_session() to authenticated, service_role;
grant execute on function private.normalize_video_analysis() to authenticated, service_role;
grant execute on function private.normalize_imported_guided_run() to authenticated, service_role;
grant execute on function private.validate_session_run_ownership() to authenticated, service_role;
