import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260716144508_video_intelligence_jobs.sql",
  import.meta.url
);

test("the final failed worker attempt becomes terminal and archives its queue message", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /if p_stage = 'failed' and v_job\.attempt_count >= v_job\.max_attempts/);
  assert.match(migration, /set state = 'failed', stage = 'failed', progress = 100/);
  assert.match(migration, /perform pgmq\.archive\('video_analysis', v_job\.queue_message_id\)/);
  assert.match(migration, /set processing_status = 'failed'/);
});
