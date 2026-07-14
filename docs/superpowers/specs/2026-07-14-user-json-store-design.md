# Versioned user JSON store — design

**Date:** 2026-07-14  
**Status:** Approved for implementation planning  
**Scope:** One active local user with a future-ready multi-user JSON envelope and immutable fact history.

## Outcome

All user-owned information is stored beneath a stable user ID in one versioned JSON envelope. Declarative information such as goals, profile answers, equipment, health context, and preferences is represented as timestamped facts with provenance and supersession history. Session logs, guided runs, and video analyses remain timestamped events owned by the same user.

The app continues to support one active user. The schema can support additional users later without another persistence migration.

## Current context

The app currently stores one anonymous `TrackerState` under `climb4w.state.v1`, theme data under `climb4w.theme`, guided runs under `climb4w.guided.v1`, and video binaries in IndexedDB. The JSON export combines goals, profile, logs, video metadata, and the shared plan without a user identifier, fact history, or provenance.

The new store must preserve existing UI behavior while making ownership and history explicit.

## Goals

1. Store every user-owned record beneath `users[userId]`.
2. Preserve profile and goal changes as immutable fact history.
3. Record when and where each fact was supplied.
4. Keep session logs, guided runs, and video analyses as user-owned event collections.
5. Migrate current local data without loss or duplication.
6. Export a complete, deterministic, versioned JSON document.
7. Keep the current single-user UI and local-first architecture.
8. Isolate malformed data without destroying the last valid state.

## Non-goals

- User accounts, login, passwords, cloud sync, or server persistence.
- A user switcher or multi-user management UI.
- Writing runtime data into a repository file.
- Embedding uploaded video binaries in JSON.
- Encrypting local browser storage.
- Inferring new health or training facts from user activity.
- Duplicating event metrics as profile facts.

## Approaches considered

### Versioned localStorage envelope — selected

Use one JSON-compatible envelope under `climb4w.users.v2`, with one active user and explicit collections. It matches the existing architecture, is easy to validate and export, and is sufficient for the expected data volume.

### IndexedDB as the canonical record store

This handles larger datasets and transactions but adds query, upgrade, and testing complexity that profile facts and session metadata do not require. IndexedDB remains appropriate only for uploaded video binaries.

### Checked-in JSON file or remote JSON document

A deployed browser cannot safely update a repository file. A remote document would require authentication, authorization, conflict handling, and a backend, all outside this feature.

## Canonical schema

```ts
type UserDataEnvelope = {
  schemaVersion: 2;
  activeUserId: string;
  users: Record<string, UserRecord>;
  migration: {
    migratedFrom: "climb4w.state.v1" | null;
    migratedAt: string | null;
  };
};

type UserRecord = {
  identity: {
    id: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
  };
  facts: UserFact[];
  sessionLogs: SessionLog[];
  videoAnalyses: VideoAnalysis[];
  guidedSessions: GuidedSessionState;
};

type UserFactCategory =
  | "identity"
  | "goal"
  | "climbing"
  | "capacity"
  | "health"
  | "recovery"
  | "availability"
  | "equipment"
  | "preference"
  | "coaching";

type UserFactValue = string | number | boolean | string[] | null;

type UserFact = {
  id: string;
  userId: string;
  category: UserFactCategory;
  key: string;
  value: UserFactValue;
  unit: string | null;
  recordedAt: string;
  source: {
    type: "migration" | "profile-form" | "questionnaire" | "import";
    field: string;
    version: number;
  };
  supersedes: string | null;
};
```

The shared training plan remains application content and is not copied into each user record. Exports may include plan version metadata, but the plan itself is not user information.

## Fact semantics

- A fact is immutable after creation.
- `category + key` identifies a fact stream within one user.
- A changed value appends a fact whose `supersedes` points to the previous current fact.
- Re-submitting an unchanged value does not create a duplicate fact.
- An explicit empty value can be recorded as `null` when the user clears a previously supplied answer.
- `recordedAt` is an injected ISO timestamp so migration and tests are deterministic.
- `source.field` uses the existing profile/goal field name.
- `source.version` is the questionnaire version for questionnaire answers and `1` for other current sources.
- Units are assigned from an explicit field registry; unknown or unitless fields use `null`.

Current profile and goals are projections of the newest valid fact in each stream. History remains available in the canonical envelope and export.

## Field registry

Create an explicit registry mapping every existing goal and profile field to:

- fact category;
- unit, when relevant;
- projection destination (`profile` or `goals`);
- stable field key.

No runtime heuristic classifies fields. Tests must prove every field in the existing `defaultState.profile` and `defaultState.goals` is registered exactly once.

Questionnaire completion metadata remains represented as facts so its history and questionnaire version are retained.

## Events and binary data

Session logs, video analyses, and guided session state already contain timestamps and domain structure. They remain event collections rather than being decomposed into facts.

- `sessionLogs` contains the existing `SessionLog` records.
- `videoAnalyses` contains metadata and analysis values only.
- Uploaded video blobs remain in the existing IndexedDB store and are referenced by analysis ID.
- `guidedSessions` contains active/history run state previously stored under `climb4w.guided.v1`.

Every event is owned by its containing `UserRecord`. A future multi-user UI can move to explicit `userId` fields on each event if cross-user queries require them; v2 does not duplicate that ownership.

## Persistence boundary

Add a focused user-data module responsible for:

1. creating an empty envelope and default user;
2. validating unknown stored JSON;
3. loading `climb4w.users.v2`;
4. migrating legacy tracker and guided data;
5. appending/superseding facts;
6. projecting facts to the compatibility `profile` and `goals` shapes;
7. saving a complete envelope synchronously;
8. producing deterministic export JSON.

`App.tsx` must not implement schema parsing or migration itself. It consumes a compatibility state and calls explicit update functions when profile, questionnaire, logs, videos, or guided runs change.

## Migration

On load:

1. Attempt to parse and validate `climb4w.users.v2`.
2. If valid, use it and do not inspect legacy state for migration.
3. If v2 is absent, load and normalize `climb4w.state.v1` using existing defaults.
4. Generate one stable user ID and identity timestamps.
5. Convert every legacy profile/goal field into a migration fact, excluding truly absent values while retaining meaningful `false`, `0`, and empty-array values.
6. Copy legacy logs and video metadata without changing IDs or timestamps.
7. Load and validate `climb4w.guided.v1`, then place it in the user record.
8. Write the v2 envelope and read it back for validation.
9. Only after successful verification mark migration complete. Legacy localStorage keys remain untouched as a recovery copy; deletion is deferred to a later feature.

The generated user ID must persist. Reloading after migration cannot create a second user or duplicate facts/events.

If v2 exists but is corrupt, do not silently remigrate and overwrite it. Return a recoverable error, retain the raw value, and offer use of the last valid in-memory/default state plus JSON recovery guidance.

## Application data flow

```text
profile/questionnaire form
        ↓
append changed facts
        ↓
UserDataEnvelope v2 ──→ localStorage
        ↓
project current facts
        ↓
existing profile/goals UI

logs/videos/guided runs
        ↓
replace or append user-owned event collection
        ↓
UserDataEnvelope v2
```

The UI remains single-user. The active user identity is displayed in the Profile backup area so exports are understandable, but no account or switching controls are added.

## Export

The Profile backup actions export the canonical v2 envelope, not a reconstructed partial object. Export requirements:

- stable two-space indentation;
- `schemaVersion`, `activeUserId`, `users`, and migration metadata;
- all fact history and event collections;
- video metadata but no binary blobs or object URLs;
- no duplicated shared training plan;
- optional `app` metadata containing app name, export timestamp, and plan version/date range;
- filename containing the active user ID and ISO date.

Copy, preview, and download must use the same generated string.

## Error behavior

| Condition | Behavior |
|---|---|
| v2 key absent | Run the one-time legacy migration. |
| No legacy key | Create one default user with default facts. |
| Invalid v2 JSON/schema | Do not overwrite it; show a persistent recovery warning. |
| v2 write fails | Keep in-memory changes and warn that reload persistence is unavailable. |
| Migration verification fails | Preserve legacy keys and do not mark migration complete. |
| Unknown fact key/category | Reject import/storage payload as invalid. |
| Duplicate fact IDs | Reject payload as invalid. |
| Broken supersedes link | Reject payload as invalid. |
| Video blob absent | Keep metadata; existing video UI handles missing binary content. |

## Privacy and safety

- The JSON contains health, injury, body, and performance information; export UI must state that it is sensitive local data.
- Do not log the envelope or facts to the console.
- Do not send the envelope to Vercel, GitHub, analytics, or any remote API.
- Do not place a real user JSON export in `public/` or commit it to Git.
- Use opaque generated IDs rather than email addresses or names as object keys.

## Testing

### Unit tests

- registry covers every existing profile and goal field exactly once;
- migration preserves all supplied legacy values and event IDs;
- migration is idempotent across reloads;
- unchanged form submission does not append duplicate facts;
- changed and cleared values create correct supersession chains;
- current projection selects the latest valid fact;
- facts from one user cannot affect another user in a fixture envelope;
- corrupt JSON, invalid schema, duplicate IDs, and broken links are isolated;
- guided state is migrated into the active user;
- deterministic export contains all history and excludes shared plan/binary data.

### Component/integration tests

- profile save writes source-attributed facts and preserves UI values;
- questionnaire save records its source version;
- log/video/guided changes update only the active user collections;
- Profile copy, preview, and download use identical v2 JSON;
- sensitive-data copy and active user identity are visible;
- storage failure warning does not discard in-memory changes.

### Browser tests

- seed legacy state, reload, and verify automatic migration plus unchanged UI;
- change a profile value twice and verify export contains the supersession chain;
- complete a guided session and add a log, then verify both collections in export;
- reload and verify the same active user ID and no duplicated records;
- verify mobile Profile export controls at 390×844 and 320×568;
- verify no horizontal overflow and no sensitive JSON is requested over the network.

## Acceptance criteria

- one active user is represented under `users[activeUserId]`;
- every profile and goal answer is a sourced, timestamped fact;
- changed answers preserve history through valid supersession links;
- current UI values are projections of the latest facts;
- logs, video analyses, and guided runs belong to the active user;
- existing local data migrates once without loss or duplication;
- reload preserves the same user ID and record history;
- export contains the complete canonical envelope and excludes binary/shared plan data;
- malformed data never overwrites the last stored payload;
- all existing feature, mobile, typecheck, questionnaire, build, and CI checks remain green;
- no user-data JSON file is committed or sent to a remote service.

## Delivery path

Implementation stays on `feature/user-json-store`, then opens a pull request into `dev`. After all protected CI checks pass and the feature is verified, a separate `dev` to `main` promotion remains the release step.
