from __future__ import annotations

import re
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class JobState(StrEnum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    PERCEIVING = "perceiving"
    COACHING = "coaching"
    FINALIZING = "finalizing"
    COMPLETED = "completed"
    FAILED = "failed"


_STATE_ORDER = {
    JobState.QUEUED: 0,
    JobState.EXTRACTING: 1,
    JobState.PERCEIVING: 2,
    JobState.COACHING: 3,
    JobState.FINALIZING: 4,
    JobState.COMPLETED: 5,
}


def validate_state_transition(current: JobState, target: JobState) -> None:
    if target == JobState.FAILED:
        return
    if current not in _STATE_ORDER or _STATE_ORDER.get(target) != _STATE_ORDER[current] + 1:
        raise ValueError(f"invalid state transition: {current} -> {target}")


class QueueMessage(StrictModel):
    job_id: UUID
    asset_id: UUID
    correlation_id: str = Field(min_length=1, max_length=128)


class EvidenceFrame(StrictModel):
    id: str = Field(min_length=1)
    sequence_id: str = Field(min_length=1)
    frame_index: int = Field(ge=0)
    timestamp_ms: int = Field(ge=0)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    path: str | None = None
    blur_score: float = Field(default=0, ge=0)
    exposure_score: float = Field(default=0, ge=0, le=1)
    motion_score: float = Field(default=0, ge=0)


class EvidenceSequence(StrictModel):
    id: str = Field(min_length=1)
    frames: list[EvidenceFrame] = Field(min_length=3, max_length=8)

    @model_validator(mode="after")
    def validate_frames(self) -> EvidenceSequence:
        timestamps = [frame.timestamp_ms for frame in self.frames]
        if timestamps != sorted(timestamps) or len(timestamps) != len(set(timestamps)):
            raise ValueError("evidence timestamps must be strictly ordered")
        if any(frame.sequence_id != self.id for frame in self.frames):
            raise ValueError("frame sequence identifier mismatch")
        return self


_MEDICAL_PATTERN = re.compile(
    r"\b(diagnos(?:e|is)|torn|fracture|dislocation|tendonitis|sprain)\b", re.IGNORECASE
)


class Observation(StrictModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1, max_length=120)
    detail: str = Field(min_length=1, max_length=1000)
    confidence: float = Field(ge=0, le=1)
    visibility: Literal["visible", "partially_visible", "not_visible"]
    evidence_refs: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def reject_medical_labels(self) -> Observation:
        if _MEDICAL_PATTERN.search(f"{self.label} {self.detail}"):
            raise ValueError("medical labels are forbidden")
        if len(self.evidence_refs) != len(set(self.evidence_refs)):
            raise ValueError("evidence references must be unique")
        return self


class Recommendation(StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=160)
    guidance: str = Field(min_length=1, max_length=1200)
    evidence_refs: list[str] = Field(min_length=1)
    citations: list[str] = Field(min_length=1)


class ProviderProvenance(StrictModel):
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    prompt_version: str = Field(min_length=1)


class AnalysisResult(StrictModel):
    observations: list[Observation]
    recommendations: list[Recommendation] = Field(max_length=5)
    provenance: ProviderProvenance

