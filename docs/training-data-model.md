# Canonical training data model

Fixture id: `training-data-model-ac02-v1`.

This is the cloud contract for athlete activity. Issue #34. A log, run, or video is either tied to a plan session, kept on an explicit legacy key, or marked standalone.

## Session binding

`session_binding` is `plan`, `legacy`, or `standalone`.

| Binding | Meaning |
| --- | --- |
| `plan` | `plan_session_id` references `public.plan_sessions` for the same athlete. `legacy_session_key` is empty. |
| `legacy` | The source session key could not be mapped. `legacy_session_key` keeps that key. `plan_session_id` is empty. |
| `standalone` | The record is intentionally not tied to a session. Both keys are empty. |

Tables: `session_logs`, `session_runs`, `video_assets`, `video_analyses`. `imported_guided_runs` uses the same plan-or-legacy choice and keeps its original `session_key`.

A second source key that disagrees with the chosen one is stored in `alternate_session_key`. If more than one extra key exists, `metric_conflicts.session_keys` keeps the full list.

Resolution order for a log or analysis:

1. An explicit `plan_session_id` that belongs to the athlete.
2. `session_id`, then `sessionId`, then `legacy_session_key`, when that text is the athlete's plan session UUID.
3. The parent run or video asset plan session.
4. Otherwise the first unmapped key, as `legacy`.
5. Otherwise `standalone`.

`session_runs` do not infer a plan from a free-text key. A legacy run is inserted with `session_binding = 'legacy'`, `legacy_session_key`, and no plan ids. A plan run still requires both `plan_id` and `plan_session_id`.

## Metric names

Known measurements are columns. `metrics jsonb` remains only for keys this model does not standardize. When snake_case and camelCase both exist and differ, the snake_case value is the column and the camelCase value stays in `metric_conflicts`. Equal aliases collapse to the column. Values outside the column range, or non-numeric values, stay in `metric_conflicts` and are not truncated.

| Column | Aliases | Domain |
| --- | --- | --- |
| `attempts` | `attempts` | integer 0–200 |
| `moves` | `moves` | integer 0–500 |
| `best_link` | `bestLink` | integer 0–500 |
| `foot_cuts` | `footCuts` | integer 0–200 on logs, 0–1000 on analyses |
| `pull_weight` | `pullWeight` | numeric −100–200 |
| `sleep` | `sleep` | numeric 0–10 |
| `rpe`, `pump`, `pain`, `energy` | same names | existing log ranges |
| `swing`, `hips`, `shoulder`, `breath`, `reading` | same names | integer 0–1000 on analyses |

`imported_source_id` is a column, not a metric. `notes` is `session_logs.body` or `video_analyses.notes`.

Before-insert and before-update triggers normalize writes, including the local importer. Re-running `private.backfill_training_data_model()` is safe.

## Current athlete profile

`public.current_athlete_profile` is the newest fact per athlete and `fact_key` that has not been superseded. It is `security_invoker`, so row level security on `athlete_facts` applies. Lookup index: `athlete_facts_current_lookup_idx` on `(athlete_id, fact_key, created_at desc, id desc)`.

`hydrate_athlete_state()` includes this projection as `currentProfile` and still returns `profile.avatarPath`.

## Plan read model

`public.training_plan_read_model` is read model version 1. One row per plan the caller can already read, with `sessions`, nested `blocks`, and nested `exercises`. `hydrate_athlete_state().activePlan` is that row for the caller's active plan, without `athlete_id`. `listActivePlan()` reads the same view.

The view is `security_invoker`. `anon` has no select. Authenticated athletes select only their own published plans through existing policies.

## Ownership and RLS

`athlete_id` remains the owner. New columns do not add policies. A `plan_session_id` must belong to that athlete; the trigger rejects a cross-athlete id with `23514`. Views do not bypass row level security.

`private` helpers are not exposed to `anon`. Authenticated and `service_role` can execute the normalizers because inserts run as those roles. `private.backfill_training_data_model()` is not granted to them.

## Retention

This migration does not delete activity, facts, or plans. Facts and published plans stay immutable. Standardized values live on the row for as long as the row does, including disagreed aliases in `metric_conflicts`. There is no new time-to-live.

## Migration, backfill, and rollback

Apply the forward migration `20261030172000_canonical_training_data_model.sql`. It adds columns, normalizes existing rows, then adds checks and indexes.

Verify:

```bash
npx supabase@latest db reset --local
npx supabase@latest test db
```

Or, against a database that already has the earlier migrations, run `supabase/tests/training_data_model.sql`. Read `supabase/fixtures/training-data-model-ac02-v1.json` and confirm `plan_session_id` plus the canonical metric names.

Rollback is `supabase/rollbacks/20261030172000_canonical_training_data_model.sql`. It copies log and analysis values back into `metrics`, restores the previous hydration, import, and run-ownership functions, then drops the new objects. It stops if a session run is legacy or standalone, or if a video asset still has `legacy_session_key`, because those keys have no older column to return to. Map or remove those rows first. Log and analysis keys are copied back before their columns are dropped.

The local importer treats a JSON `null` active guided run as absent, so a null `activeRun` does not insert an empty legacy row.
