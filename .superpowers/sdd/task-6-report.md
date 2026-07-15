# Task 6 report

Status: review fixes implemented for the private upload, analysis, and playback lifecycle.

- Added deterministic, extension-validated private paths, SHA-256 metadata, pending upload records, same-ID retries, and signed playback URLs in `cloud-video.ts`.
- Updated the App video seam so IndexedDB is recovery-only until an upload verifies; failed uploads remain visible and retryable with the same ID/path.
- Tests: `npm test -- --run src/features/cloud/cloud-video.test.ts` (6 passing); `npm run typecheck`.

Review remediation:

- Added a JWT-bound `append_video_analysis` security-definer RPC. It derives the athlete from `auth.uid()`, locks the owned asset, and atomically appends an incremented immutable version; the browser invokes the RPC with no service key.
- Cloud uploads now create or confirm matching pending metadata before upload, bind retry content to the original checksum/path, and verify both row metadata and the private Storage object before recovery data is deleted.
- Local video records persist cloud ID, object path, and status. Reload restores a pending recovery blob and exposes a retry action; selecting a different file abandons that recovery record and starts a new UUID lifecycle.
- Playback resolves the caller-owned `video_assets` row and uses its stored path with a fixed 60-second signed URL.
- Added focused unit coverage for metadata, upload, integrity, retry-file, playback, and analysis-RPC failure boundaries, plus pgTAP coverage for version append and ownership.
