from __future__ import annotations

import asyncio
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from uuid import UUID

from pydantic import TypeAdapter, ValidationError

from climb_video.coaching import synthesize_coaching
from climb_video.contracts import AnalysisResult, EvidenceSequence
from climb_video.media import extract_frames, probe_video
from climb_video.providers.base import PerceptionProvider
from climb_video.selector import select_evidence


@dataclass(frozen=True)
class ClaimedJob:
    job_id: UUID
    asset_id: UUID
    correlation_id: str
    bucket: str
    object_path: str
    attempt: int
    checkpoint: dict[str, Any]

    def __post_init__(self) -> None:
        if not self.bucket or not self.object_path or not self.correlation_id or self.attempt < 1:
            raise ValueError("invalid authoritative claim")


class VideoRepository(Protocol):
    def claim(self, worker_id: str, visibility_seconds: int) -> ClaimedJob | None: ...
    def download_asset(self, claim: ClaimedJob, destination: Path) -> None: ...
    def checkpoint(self, job_id: UUID, stage: str, progress: int, payload: dict[str, Any]) -> None: ...
    def finalize(self, job_id: UUID, envelope: dict[str, Any]) -> str: ...
    def get_reviewed_knowledge(self) -> dict[str, str]: ...


class VideoPipeline:
    def __init__(
        self,
        *,
        repository: VideoRepository,
        provider: PerceptionProvider,
        worker_id: str,
        visibility_seconds: int = 900,
        max_attempts: int = 3,
        max_bytes: int = 500 * 1024 * 1024,
    ) -> None:
        self.repository = repository
        self.provider = provider
        self.worker_id = worker_id
        self.visibility_seconds = visibility_seconds
        self.max_attempts = max_attempts
        self.max_bytes = max_bytes

    async def run_once(self) -> bool:
        claim = await asyncio.to_thread(
            self.repository.claim, self.worker_id, self.visibility_seconds
        )
        if claim is None:
            return False
        try:
            await self._process(claim)
        except Exception:
            await asyncio.to_thread(
                self.repository.checkpoint,
                claim.job_id,
                "failed",
                99,
                {
                    "code": "processing_failed",
                    "retryable": claim.attempt < self.max_attempts,
                },
            )
        return True

    async def _process(self, claim: ClaimedJob) -> None:
        knowledge = await asyncio.to_thread(self.repository.get_reviewed_knowledge)
        checkpoint = claim.checkpoint
        persisted_result = checkpoint.get("provider_result")
        persisted_sequences = checkpoint.get("evidence_sequences")
        if persisted_result is not None and persisted_sequences is not None:
            try:
                result = AnalysisResult.model_validate(persisted_result)
                sequences = TypeAdapter(list[EvidenceSequence]).validate_python(persisted_sequences)
            except ValidationError as error:
                raise ValueError("invalid persisted checkpoint") from error
        else:
            await asyncio.to_thread(
                self.repository.checkpoint, claim.job_id, "extracting", 10, {}
            )
            with tempfile.TemporaryDirectory(prefix=f"climb-{claim.job_id}-") as directory:
                root = Path(directory)
                video = root / "source.mp4"
                await asyncio.to_thread(self.repository.download_asset, claim, video)
                await asyncio.to_thread(probe_video, video, max_bytes=self.max_bytes)
                frames = await asyncio.to_thread(
                    extract_frames, video, root / "frames", fps=1, max_frames=60
                )
                sequences = select_evidence(frames)
                result = await self.provider.analyze(sequences, knowledge)
            checkpoint_payload = {
                "provider_result": result.model_dump(mode="json"),
                "evidence_sequences": [sequence.model_dump(mode="json") for sequence in sequences],
            }
            await asyncio.to_thread(
                self.repository.checkpoint,
                claim.job_id,
                "perceiving",
                75,
                checkpoint_payload,
            )

        evidence_ids = {
            frame.id for sequence in sequences for frame in sequence.frames
        }
        result = synthesize_coaching(
            result.model_dump(mode="json"),
            evidence_ids=evidence_ids,
            reviewed_knowledge=set(knowledge),
            athlete_context="",
        )

        envelope = {
            "job_id": str(claim.job_id),
            "correlation_id": claim.correlation_id,
            "result": result.model_dump(mode="json"),
            "evidence_sequences": [sequence.model_dump(mode="json") for sequence in sequences],
        }
        await asyncio.to_thread(self.repository.finalize, claim.job_id, envelope)

    async def run_forever(self, poll_seconds: float = 2) -> None:
        while True:
            processed = await self.run_once()
            if not processed:
                await asyncio.sleep(poll_seconds)
