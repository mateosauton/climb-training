# Open-Source Video Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current Supabase media system with an asynchronous, evidence-backed climbing-video pipeline served by Qwen3-VL on DigitalOcean.

**Architecture:** The Vite client keeps the existing authenticated `video_assets` upload lifecycle. Narrow Supabase RPCs create private jobs and enqueue identifiers; a DigitalOcean Python worker claims jobs, extracts timestamped evidence with FFmpeg/OpenCV, calls a private vLLM/Qwen service, validates structured perception/coaching results, and persists immutable history. OpenAI remains an optional adapter.

**Tech Stack:** React/Vite/TypeScript, Supabase Postgres/Storage/Queues/Realtime/pgvector, Python 3.12, FastAPI, FFmpeg/OpenCV, Pydantic, httpx, pytest, Docker Compose, vLLM 0.14.1, Qwen3-VL-8B-Instruct, DigitalOcean L40S.

---

### Task 1: Restore and verify the Supabase branch baseline

**Files:**
- Modify: `src/App.tsx`

- [ ] Add the missing `readAuthConfig`, `createCloudClient`, and `createCloudVideoService` imports required by the merged Supabase branch.
- [ ] Run `npm test -- --run` and confirm the integration suites collect and pass.
- [ ] Run `npm run typecheck` and `npm run build`.
- [ ] Commit with `fix cloud video imports`.

### Task 2: Add the private job and evidence schema

**Files:**
- Create: `supabase/migrations/20260716120000_video_intelligence_jobs.sql`
- Create: `supabase/tests/video_intelligence.sql`

- [ ] Write SQL tests that prove an athlete can request analysis only for an owned uploaded asset; repeated idempotency keys reuse one job; another athlete cannot read evidence/history; browser roles cannot access private jobs/queue; and worker finalization appends one immutable analysis version.
- [ ] Run the SQL tests against local Supabase and observe the missing objects/RPC failures.
- [ ] Add `private.video_analysis_jobs`, `private.video_pipeline_events`, public evidence/observation/recommendation/feedback/theme tables, ownership constraints, indexes, RLS, grants, and the private durable `video-analysis` queue.
- [ ] Add narrow athlete RPCs `request_video_analysis`, `retry_video_analysis`, `set_video_recommendation_state`, and a trusted worker claim/checkpoint/finalize contract. All security-definer functions set `search_path = ''` and recheck ownership.
- [ ] Run database tests, migration reset, and advisors; confirm no cross-athlete access or exposed private tables.
- [ ] Commit with `add video intelligence schema`.

### Task 3: Define worker contracts test-first

**Files:**
- Create: `services/video-worker/pyproject.toml`
- Create: `services/video-worker/src/climb_video/contracts.py`
- Create: `services/video-worker/tests/test_contracts.py`

- [ ] Write failing Pydantic tests for queue identifiers, monotonic job states, evidence sequences, observation visibility/confidence, maximum five recommendations, evidence references, provider provenance, and forbidden medical labels.
- [ ] Run `pytest services/video-worker/tests/test_contracts.py -q` and confirm failures are caused by missing contracts.
- [ ] Implement strict frozen request/result models and validators.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit with `add video worker contracts`.

### Task 4: Build deterministic extraction test-first

**Files:**
- Create: `services/video-worker/src/climb_video/media.py`
- Create: `services/video-worker/src/climb_video/selector.py`
- Create: `services/video-worker/tests/test_media.py`
- Create: `services/video-worker/tests/test_selector.py`

- [ ] Write failing tests for ffprobe validation, timestamp preservation, corrupt/oversized rejection, 1 fps evidence sampling, blur/exposure/motion scoring, deduplication, ordered 3–8 frame sequences, and the 12-sequence/60-frame caps.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement subprocess-safe FFmpeg/ffprobe calls without shell interpolation, OpenCV features, deterministic hashing, and the capped selector.
- [ ] Run focused tests and Ruff; confirm green.
- [ ] Commit with `add climbing frame extraction`.

### Task 5: Add replaceable perception and coach providers test-first

**Files:**
- Create: `services/video-worker/src/climb_video/providers/base.py`
- Create: `services/video-worker/src/climb_video/providers/qwen.py`
- Create: `services/video-worker/src/climb_video/providers/openai.py`
- Create: `services/video-worker/src/climb_video/coaching.py`
- Create: `services/video-worker/tests/test_providers.py`

- [ ] Write failing tests for the provider interface, labeled timestamp/frame inputs, local vLLM URL enforcement, strict JSON parsing, timeout/refusal/malformed output, evidence-reference validation, citation requirements, and deterministic pain/load overrides.
- [ ] Run the tests and confirm expected failures.
- [ ] Implement `QwenVllmProvider` against an OpenAI-compatible `/v1/chat/completions` endpoint and a disabled-by-default OpenAI adapter with the same schemas.
- [ ] Implement coaching synthesis that accepts only validated observations and reviewed knowledge chunks.
- [ ] Run focused tests and confirm green.
- [ ] Commit with `add open video model providers`.

### Task 6: Build the idempotent Supabase worker test-first

**Files:**
- Create: `services/video-worker/src/climb_video/repository.py`
- Create: `services/video-worker/src/climb_video/pipeline.py`
- Create: `services/video-worker/src/climb_video/main.py`
- Create: `services/video-worker/tests/test_pipeline.py`
- Create: `services/video-worker/tests/test_health.py`

- [ ] Write failing tests for queue claim, authoritative ID verification, checkpoint resume, signed/private download, progress monotonicity, provider-result reuse after persistence failure, atomic finalization, redelivery, retry exhaustion, health, and readiness.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the Supabase repository, pipeline orchestration, bounded queue loop, safe errors, correlation IDs, `/healthz`, and `/readyz`.
- [ ] Run all worker tests, Ruff, and MyPy/Pyright if configured.
- [ ] Commit with `add video analysis worker`.

### Task 7: Register licensed climbing data

**Files:**
- Create: `data/video-training/datasets.json`
- Create: `scripts/fetch-video-dataset.mjs`
- Create: `scripts/verify-video-dataset.mjs`
- Create: `docs/video-training-data.md`
- Create: `scripts/video-dataset.test.mjs`

- [ ] Write a failing registry test requiring source URL, DOI, creator, retrieval date, exact license, commercial/derivative/training permissions, checksum, split policy, attribution, consent/privacy review, and takedown state.
- [ ] Add The Way Up Zenodo record as CC BY 4.0 and explicitly exclude AscendMotion, CIMI4D, standard-license YouTube, and unknown-license footage from commercial training.
- [ ] Implement resumable download and checksum verification without committing video binaries.
- [ ] Verify the registry and download metadata; keep athlete uploads excluded unless separately opted in.
- [ ] Commit with `register licensed climbing dataset`.

### Task 8: Connect the current client to jobs and history

**Files:**
- Create: `src/features/cloud/video-intelligence.ts`
- Create: `src/features/cloud/video-intelligence.test.ts`
- Modify: `src/features/cloud/cloud-video.ts`
- Modify: `src/App.tsx`

- [ ] Write failing tests for request/retry/status/report/history/filter/feedback/delete calls and safe provider errors.
- [ ] Implement the authenticated repository using current `video_assets` IDs and narrow RPCs; never accept caller-supplied athlete IDs.
- [ ] Replace the manual-only completion path with feature-flagged asynchronous progress, report, evidence modal, recommendation history, feedback, retry, and deletion while preserving the legacy fallback.
- [ ] Run unit, integration, type, build, and Playwright tests.
- [ ] Commit with `add video coach workspace`.

### Task 9: Containerize and deploy on DigitalOcean

**Files:**
- Create: `services/video-worker/Dockerfile`
- Create: `deploy/digitalocean/docker-compose.yml`
- Create: `deploy/digitalocean/cloud-init.yml`
- Create: `deploy/digitalocean/README.md`
- Create: `scripts/assert-video-deployment.sh`

- [ ] Build the worker image locally and run health tests in mocked-model mode.
- [ ] Provision `climb-video-worker-1` in `tor1` using `gpu-l40sx1-48gb`, image `gpu-h100x1-base`, monitoring, SSH key ID `56421640`, and a restrictive firewall.
- [ ] Deploy vLLM 0.14.1 with `Qwen/Qwen3-VL-8B-Instruct`, BF16, 32K context, 0.85 GPU utilization, and maximum two sequences; keep vLLM on the private Compose network.
- [ ] Deploy the outbound-only worker with Supabase server credentials and a rotating worker secret from a root-only environment file.
- [ ] Verify `nvidia-smi`, model readiness, worker health, queue connectivity, and one licensed fixture inference.
- [ ] Record Droplet ID, region, size, image, deployment timestamp, cost, rollback/destroy commands, and secret rotation steps without recording secret values.
- [ ] Commit with `deploy video worker`.

### Task 10: Final verification and rollout gate

**Files:**
- Modify: `README.md`
- Modify: `docs/supabase-operations.md`

- [ ] Run database tests and advisors on the linked Supabase project.
- [ ] Run `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- [ ] Run all worker tests/lint and the dataset registry verifier.
- [ ] Run a production-bundle scan proving no service-role, worker, DigitalOcean, or model credentials are present.
- [ ] Complete a licensed golden-video smoke flow from upload through report/history/deletion.
- [ ] Keep `VITE_VIDEO_AI_ENABLED=false` until the golden-video safety/quality gates pass.
- [ ] Commit with `document video operations`.
