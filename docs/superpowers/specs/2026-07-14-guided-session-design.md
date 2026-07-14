# Guided climbing session — product and technical design

**Date:** 2026-07-14  
**Status:** Ready for implementation  
**Scope:** Mobile-first, local-first guided execution of the existing four-week plan. ElevenLabs voice is an explicitly deferred integration.

## 1. Outcome

From **Plan**, the athlete can choose a day, review a concise session summary, press **Iniciar sesión**, and execute the workout one block at a time. Each block explains what to do, why it matters, the important cues, what to avoid, and any curated demonstration video. Progress survives reloads and leaving the guided view. On completion, the athlete sees a summary and can continue to the existing session log.

The experience remains useful with audio muted, microphone permission denied, or no network connection. The deterministic on-screen plan—not a future voice model—is always the source of truth.

## 2. Repository context

The existing application is a Spanish-language React/Vite single-page tracker using Tailwind 4 and copied shadcn/ui components. It has no router, server, authentication, or remote database.

- `src/App.tsx` is a 2,700-line monolithic application with tab state, plan selection, logging, video analysis, profile editing, and `localStorage` persistence.
- `src/lib/training.ts` defines 28 `TrainingSession` objects, an `exerciseLibrary`, and `sessionExerciseMap`.
- A session currently has high-level `drills`; an exercise has `dose`, `rationale`, `cues`, `avoid`, and reference links/images.
- The Plan page already selects a day and displays both its drill list and detailed exercises. On narrow screens it scrolls to the chosen detail.
- Tracker state is stored under `climb4w.state.v1`; uploaded analysis clips use IndexedDB. Existing session completion is inferred from a `SessionLog`.
- `public/data/training-plan.md` contains richer session instructions than some `TrainingSession.drills`, including warmups and safety rules.
- Existing references include YouTube links, articles, and internal hash links, but do not declare which are playable videos.

The feature should extract focused modules rather than add another large stateful section directly inside `App.tsx`.

## 3. Goals and non-goals

### Goals

1. Start the selected plan session with one obvious action.
2. Preview duration, intensity, objective, blocks, equipment, and key safety guidance before starting.
3. Guide the athlete through an explicitly authored, ordered block list.
4. Make the current block readable and operable with one hand on a phone.
5. Show a demonstration video when a curated embeddable video exists, with an external-link fallback.
6. Support previous/next, complete, skip, pause, leave, resume, restart, and discard.
7. Persist active and completed guided runs locally without corrupting existing logs.
8. Hand off to the existing log after completion.
9. Establish content/state boundaries that a future ElevenLabs voice agent can consume safely.

### Non-goals for v1

- ElevenLabs audio, speech recognition, microphone access, or conversational coaching.
- Authentication, cloud sync, multi-device resume, coach accounts, or server persistence.
- AI-generated training advice or automatic changes to load, repetitions, or safety rules.
- Automatic exercise recognition, video analysis, background notifications, or live wearable data.
- Downloading/caching third-party videos or guaranteeing that external videos work offline.
- Per-repetition tracking, automatic timers, or automatic creation of performance metrics.

## 4. Approaches considered

### A. Add guided state and conditional JSX directly to `App.tsx`

Fastest initial patch and fewest new files. However, it further couples plan content, persistence, navigation, and rendering to an already oversized component. Testing resume and transition edge cases would be unnecessarily difficult.

### B. Modular local-first guided-session engine — recommended

Add explicit guided content beside the training model, a pure reducer/state machine, a versioned persistence adapter, and focused summary/runner/completion components. `App.tsx` only launches the flow and reacts to exit/completion. This matches the current no-backend architecture while creating stable boundaries for tests and future voice.

### C. Backend-owned workout runs and voice-ready API now

Best for accounts, multi-device sync, analytics, and protected ElevenLabs credentials, but introduces identity, APIs, deployment state, migrations, and failure modes unrelated to the requested v1. It is premature for a single-user local-first tracker.

**Decision:** Use approach B. Add a small serverless token endpoint only when voice enters scope.

## 5. User experience

All new user-facing copy is Spanish and follows the app's existing informal register.

### 5.1 Entry from Plan

The existing selected-session detail gains a prominent **Iniciar sesión** button near the title/summary and again as a sticky mobile action at the bottom of the card. If the selected session has an unfinished run, the label is **Continuar sesión** and shows “Bloque X de Y”.

Starting a different session while one is unfinished opens a confirmation dialog:

- **Volver a la sesión activa**
- **Descartar y empezar esta** (destructive)
- **Cancelar**

Only one unfinished run exists at a time in v1.

### 5.2 Pre-session summary

Pressing the entry action opens a full-screen guided surface at the summary step. It shows:

- session title, date/time, phase, intensity, and estimated duration;
- the session objective;
- ordered block names and their approximate dose/duration;
- equipment derived from explicitly authored session content;
- safety callout: stop hard gripping for sharp pain or pain above 2/10, consistent with the plan;
- **Empezar sesión** and **Volver al plan**.

For a recovery/rest day, the same flow is used, but the language is “actividad” where appropriate and blocks contain the recovery/check instructions.

### 5.3 Guided block

After the user taps **Empezar sesión**, show one block at a time:

1. Compact header: close/pause control, session title, `Bloque X de Y`, and accessible progress.
2. Main card: block phase, title, dose/instructions, optional estimate, rationale, numbered steps, cues, and “Evitar”.
3. Media area: thumbnail and **Ver demostración**. Expanding it embeds a playable YouTube video when supported. Articles remain **Abrir referencia** links. Never autoplay.
4. Sticky footer: **Anterior** and primary **Completar y seguir**. A secondary overflow action is **Saltar bloque**.

When viewing an already completed block, the primary action is **Siguiente**. Returning and changing a completed block to incomplete is an explicit action, not a side effect of navigating backward.

On every block transition:

- persist before changing the screen;
- scroll the content container to the top;
- move programmatic focus to the block heading;
- announce “Bloque X de Y: [title]” through a polite live region.

### 5.4 Pause, leave, and resume

The header pause/close action opens a dialog with:

- **Seguir entrenando**
- **Pausar y salir**
- **Descartar sesión** (destructive)

“Pausar y salir” records `status: paused`, persists, closes the guided surface, and returns to Plan. Plan shows a resume banner and the selected session's action becomes **Continuar sesión**. Resume returns to the last viewed incomplete block.

Reloading or closing the browser does not discard a run. A running run restored after a reload becomes `paused`; elapsed time therefore never grows invisibly while the app is closed.

### 5.5 Completion

Completing the final block changes the run to `completed` and shows:

- session title and completion state;
- elapsed active time;
- completed and skipped block counts;
- the names of skipped blocks, if any;
- **Registrar resultados** (primary), **Volver al plan**, and **Repetir sesión**.

**Registrar resultados** closes the runner, selects the same session, loads the Log tab, and leaves the existing metric defaults editable. A completed guided run does not fabricate a `SessionLog` because that would pollute RPE, pain, attempt, and performance trends. Plan may treat either a completed guided run or an existing log as a visual completion mark; dashboard training metrics continue to use logs only.

## 6. Content model

Do not infer blocks at runtime from prose. Author them explicitly so ordering and safety wording are stable and testable.

```ts
type GuidedMedia = {
  id: string;
  kind: "youtube" | "external" | "internal";
  label: string;
  url: string;
  thumbnail?: string;
  youtubeId?: string;
  startSeconds?: number;
  endSeconds?: number;
};

type GuidedBlock = {
  id: string;                 // stable within the session, e.g. "warmup"
  phase: "prepare" | "work" | "rest" | "cooldown" | "review";
  title: string;
  instruction: string;
  steps: string[];
  dose?: string;
  estimatedMinutes?: number;
  rationale?: string;
  cues: string[];
  avoid?: string;
  equipment: string[];
  media: GuidedMedia[];
  narrationText: string;      // future voice script; also useful as transcript
};

type GuidedSessionDefinition = {
  sessionId: string;
  version: number;
  objective: string;
  safetyNote: string;
  blocks: GuidedBlock[];
};
```

Create `guidedSessionDefinitions: Record<string, GuidedSessionDefinition>` for all 28 plan sessions. Author from `public/data/training-plan.md`, reusing `exerciseLibrary` fields and references where they match. A block is a meaningful execution unit, not necessarily one exercise: for example, “Calentamiento”, “Board 45”, “Dominadas lastradas”, “Anillas”, and “Prehab”. Compound circuits remain one block when they are executed together.

Content rules:

- Every plan session has one definition and at least one block.
- Every block has a stable ID, clear completion boundary, instruction, and cue.
- Every demanding block states its rest/dose and stop condition.
- Every executable technique/strength block has either a curated demonstration video or an explicit reason that text guidance is sufficient; the UI never invents a video.
- Keep medical language to the existing conservative safety rules; do not diagnose.
- YouTube URLs are parsed at authoring time into `youtubeId`, not parsed ad hoc by UI components.

## 7. Run state and persistence

```ts
type GuidedRunStatus = "summary" | "active" | "paused" | "completed";

type GuidedRun = {
  id: string;
  schemaVersion: 1;
  definitionVersion: number;
  sessionId: string;
  status: GuidedRunStatus;
  currentBlockIndex: number;
  completedBlockIds: string[];
  skippedBlockIds: string[];
  startedAt: string | null;
  completedAt: string | null;
  activeSegmentStartedAt: string | null;
  accumulatedActiveSeconds: number;
  updatedAt: string;
};

type GuidedSessionState = {
  schemaVersion: 1;
  activeRun: GuidedRun | null;
  history: GuidedRun[];
};
```

Persist under a separate `climb4w.guided.v1` key. This avoids changing the existing `TrackerState` schema and keeps an invalid run from blocking profile/log loading.

Use a pure reducer with validated events:

- `CREATE_RUN(sessionId)`
- `START`
- `COMPLETE_BLOCK(blockId)`
- `SKIP_BLOCK(blockId)`
- `GO_TO_BLOCK(index)`
- `PAUSE`
- `RESUME`
- `COMPLETE_RUN`
- `DISCARD`
- `RESTART(sessionId)`
- `RESTORE`

Invariants:

- indices are clamped to available blocks;
- completed and skipped IDs are disjoint and belong to the current definition;
- `COMPLETE_RUN` is valid only when every block is completed or skipped;
- state is persisted synchronously after every reducer transition;
- elapsed active time is computed from accumulated segments, not a ticking counter persisted every second;
- malformed JSON falls back to no active run without affecting tracker data;
- restoring an unfinished run marks it paused and reconciles removed block IDs;
- a definition-version mismatch preserves matching IDs and returns to the first unresolved block.

## 8. Component and file boundaries

Suggested structure:

```text
src/features/guided-session/
  GuidedSessionFlow.tsx       orchestration and screen switching
  SessionStartSummary.tsx     pre-session preview
  GuidedBlockView.tsx         one block and references
  SessionCompletion.tsx       completion/handoff
  GuidedSessionExitDialog.tsx pause/discard confirmation
  GuidedMedia.tsx             YouTube/external/internal rendering
  guided-session-reducer.ts   pure state machine and elapsed-time helpers
  guided-session-storage.ts   parse, validate, load, save
  guided-session-types.ts
  guided-session-data.ts      28 authored definitions
```

`App.tsx` owns only the integration callbacks: launch with `selectedSessionId`, close to Plan, and close to Log with the same session selected. Do not add a routing dependency solely for this feature; a full-screen conditional surface fits the existing tab architecture. The feature components receive the selected `TrainingSession` and definition via props rather than importing global app state.

## 9. Video behavior

Use a responsive 16:9 YouTube iframe with `playsinline=1`, a descriptive `title`, native controls, and no autoplay. Render it only after the athlete taps **Ver demostración** to reduce mobile data usage. Provide **Abrir en YouTube** beside it.

The official IFrame API can later support playback events, but v1 does not need to load that script: a normal embed is sufficient. YouTube documents a minimum 200×200 viewport and recommends 16:9 at 480×270 when space permits; the mobile container should be full width and never smaller than the minimum. The official API also exposes autoplay-blocked and error states, reinforcing the decision not to rely on autoplay ([YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)).

If embedding fails, a link remains available. If offline, show “El video necesita conexión” without blocking the written workout. External articles open in a new tab with `rel="noreferrer"`. Internal references use the app callback rather than raw hash navigation while the full-screen surface is active.

## 10. Mobile and responsive design

- Runner occupies the viewport (`fixed inset-0`) above the existing sidebar/tabs.
- Header and footer respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- Primary controls are at least 44×44 CSS pixels; the main next action is full-width on narrow screens.
- Body is the only scroll container. Header and action footer stay visible without covering content.
- At 320px width, there is no horizontal scrolling and action labels do not overlap.
- At `sm` and above, previous/next can share a row; on very small screens the primary action remains visually dominant.
- At desktop widths, the block card is centered with a readable maximum width; optional outline/media may sit beside it.
- Do not require hover, drag, swipe, long-press, landscape, or precision pointing.
- Never autoplay video or future audio. Audible media generally requires prior user interaction and should degrade gracefully when browsers block it ([MDN autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)).

## 11. Accessibility

- Use one visible `h1` per runner screen and semantic `section`, `ol`, and `button` elements.
- Progress uses an accessible progressbar with current and total values; do not encode state by color alone.
- Block change announcements use `aria-live="polite"`; validation/storage failures use `role="alert"`.
- Focus moves to the new block heading without trapping keyboard users. The exit dialog does trap focus via the existing accessible AlertDialog.
- All buttons have visible focus states and meaningful names. Icon-only controls include labels.
- Video iframes have titles; thumbnails have useful alt text or are decorative when adjacent text duplicates them.
- Respect `prefers-reduced-motion`; smooth scrolling is disabled for those users.
- Text and controls must meet WCAG AA contrast in both existing themes.
- Future voice always has an equivalent visible transcript and controls for mute, repeat, and end; microphone permission is requested only after an explanation and user action.

## 12. Error and empty states

| Condition | Behavior |
|---|---|
| Session definition missing | Disable start, show “Esta sesión todavía no tiene guía” and retain the existing detail. |
| Definition has zero blocks | Same as missing; do not create a run. |
| Corrupt guided storage | Ignore only the guided payload, show a non-blocking recovery notice, allow a fresh start. |
| `localStorage` write fails | Keep current in-memory run, show persistent warning that resume after closing is unavailable. |
| Video offline/unavailable/private | Show written content and external link; never block completion. |
| User starts another session | Require explicit resume/discard choice. |
| Restored definition changed | Reconcile stable block IDs and explain that the guide was updated. |
| All blocks skipped | Permit completion, clearly report every skipped block, then offer log/restart. |
| Unexpected render error | Close safely to Plan without deleting the stored active run. |

## 13. Future ElevenLabs integration

### Recommended future shape

Use ElevenAgents rather than raw one-way TTS because the stated goal is a voice agent. The current official React SDK provides `ConversationProvider`, start/end controls, status/mute hooks, and WebRTC voice sessions ([ElevenLabs React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)). Keep the reducer as the authority and add an adapter that:

1. sends session title, objective, current block, cues, safety note, and language through approved dynamic variables;
2. registers narrowly scoped client tools such as `repeat_current_block`, `request_next_block`, `pause_session`, and `show_video`;
3. validates every tool call against reducer invariants;
4. keeps navigation buttons and text usable if voice disconnects;
5. never lets the agent invent exercises, load, reps, or safety advice outside the authored definition.

For a private production agent, add a Vercel serverless endpoint that authenticates the app request and returns a short-lived signed URL/conversation token. The API key must remain server-side; ElevenLabs explicitly warns against exposing it in browser code, and recommends signed URLs for client-side private agents ([API authentication](https://elevenlabs.io/docs/api-reference/authentication), [agent authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication)). Request microphone permission only after the user chooses voice and sees why it is required.

If future requirements only need narration rather than conversation, HTTP streaming TTS is simpler because the whole authored `narrationText` is known up front. ElevenLabs distinguishes that from the more complex bidirectional WebSocket path used for incremental low-latency pipelines ([audio streaming concepts](https://elevenlabs.io/docs/eleven-api/concepts/audio-streaming)).

### Prepared in v1, but not exposed

- stable block/session IDs;
- deterministic reducer events;
- concise `narrationText` on each block;
- a visible content structure that doubles as transcript;
- media actions isolated behind a component callback.

Do not add ElevenLabs packages, credentials, voice buttons, or disabled “coming soon” controls in v1.

## 14. Testing strategy

Add Vitest, React Testing Library, and jsdom for units/components; add Playwright for full flow and mobile layout. Keep the existing questionnaire test.

### Unit tests

- reducer supports create → summary → active → block completion → completed;
- previous/next navigation does not implicitly change completion;
- skip and complete sets remain disjoint;
- final completion is rejected until all blocks are resolved;
- pause/resume accumulates time correctly with injected timestamps;
- restore converts active to paused and does not count closed time;
- malformed storage is isolated;
- version reconciliation retains matching block IDs and finds the first unresolved block;
- every plan session has exactly one non-empty guided definition;
- block and media IDs are unique within their scopes;
- YouTube items have a valid `youtubeId`; all blocks satisfy content rules.

### Component tests

- selected session summary renders objective, metadata, equipment, safety note, and ordered blocks;
- start and resume use correct labels;
- block view renders dose, steps, cues, avoidance, and optional media;
- expanding video creates a titled iframe only after a click;
- exit dialog persists pause and requires confirmation to discard;
- completion sends the correct session ID to the Log callback;
- keyboard focus and live-region text update on transition;
- storage failure warning does not block in-memory navigation.

### Playwright end-to-end

Run the critical flow at desktop and at least these mobile viewports:

- 390×844 (modern iPhone-sized viewport)
- 360×800 (common narrow Android viewport)
- 320×568 (minimum layout stress case)

Scenarios:

1. Plan → choose W1D1 → summary → start → complete/skip blocks → completion → Log, retaining W1D1.
2. Pause midway → return to Plan → reload → resume at the same block with prior progress.
3. Attempt a different session while one is active → cancel, resume, then discard/start.
4. Expand a YouTube demonstration and verify responsive bounds, no autoplay parameter, title, and fallback link.
5. Simulate offline mode after app load: written guidance remains navigable and video failure is non-blocking.
6. Complete a rest day.
7. Tab through the full runner, operate the exit dialog, and verify focus after block changes.
8. Assert no horizontal overflow, hidden buttons, or footer-covered content at all target viewports and in both themes.

## 15. Acceptance criteria

The feature is complete when:

- every one of the 28 sessions can launch a non-empty authored guide from Plan;
- the summary accurately reflects the selected session and does not mutate progress;
- the athlete can finish the entire flow using only visible mobile controls or only a keyboard;
- every transition saves progress, and reload resumes the correct run as paused;
- leaving, pausing, discarding, switching, skipping, repeating, and completing have explicit behavior;
- completion never fabricates training metrics and can open the existing Log with the correct session selected;
- relevant curated videos are shown on demand with written/offline fallbacks and never autoplay;
- the runner works without microphone permission, ElevenLabs, or a backend;
- no ElevenLabs credential or placeholder voice UI ships;
- automated unit, component, desktop E2E, and specified mobile E2E tests pass;
- `npm run typecheck`, existing tests, production build, and the new test commands pass.

## 16. Implementation sequence

1. Add types and authored definitions; validate coverage/content in tests.
2. Add reducer, elapsed-time helpers, and isolated versioned storage with unit tests.
3. Build summary, block/media, exit, and completion components with accessibility tests.
4. Integrate launch/resume/completion callbacks into Plan and Log.
5. Add responsive/safe-area styling and Playwright scenarios.
6. Run typecheck, existing tests, new tests, build, and manual mobile verification.

## 17. Scope review and decisions

- The feature is one implementation cycle: deterministic local guided execution. Voice is a later phase with a defined seam.
- Runtime derivation from `drills` was rejected because prose parsing would create ambiguous blocks.
- Guided completion and performance logging remain separate to protect existing analytics.
- One active run is intentional for v1 and avoids conflict semantics without accounts.
- Text-first operation is intentional: videos, network, and future audio enhance rather than gate the workout.

