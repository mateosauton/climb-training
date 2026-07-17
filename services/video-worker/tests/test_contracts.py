from uuid import uuid4

import pytest
from pydantic import ValidationError

from climb_video.contracts import (
    AnalysisResult,
    EvidenceFrame,
    EvidenceSequence,
    JobState,
    Observation,
    ProviderProvenance,
    QueueMessage,
    Recommendation,
    validate_state_transition,
)


def frame(index: int, timestamp_ms: int) -> EvidenceFrame:
    return EvidenceFrame(
        id=f"frame-{index}",
        sequence_id="sequence-1",
        frame_index=index,
        timestamp_ms=timestamp_ms,
        sha256="a" * 64,
    )


def test_queue_message_accepts_identifiers_only() -> None:
    message = QueueMessage(job_id=uuid4(), asset_id=uuid4(), correlation_id="corr-1")
    assert message.correlation_id == "corr-1"
    with pytest.raises(ValidationError):
        QueueMessage(job_id=uuid4(), asset_id=uuid4(), correlation_id="corr-1", athlete_id=uuid4())


def test_job_state_transitions_are_monotonic() -> None:
    validate_state_transition(JobState.QUEUED, JobState.EXTRACTING)
    validate_state_transition(JobState.EXTRACTING, JobState.PERCEIVING)
    with pytest.raises(ValueError, match="invalid state transition"):
        validate_state_transition(JobState.PERCEIVING, JobState.EXTRACTING)


def test_evidence_sequence_is_ordered_and_bounded() -> None:
    sequence = EvidenceSequence(id="sequence-1", frames=[frame(i, i * 1000) for i in range(3)])
    assert len(sequence.frames) == 3
    with pytest.raises(ValidationError):
        EvidenceSequence(id="sequence-1", frames=[frame(0, 1000), frame(1, 500), frame(2, 2000)])
    with pytest.raises(ValidationError):
        EvidenceSequence(id="sequence-1", frames=[frame(0, 0), frame(1, 1000)])


def test_result_requires_visible_evidenced_observations() -> None:
    provenance = ProviderProvenance(provider="qwen-vllm", model="qwen", prompt_version="v1")
    observation = Observation(
        id="obs-1",
        label="Hip position",
        detail="Hips move away from the wall",
        confidence=0.8,
        visibility="visible",
        evidence_refs=["frame-1"],
    )
    recommendation = Recommendation(
        id="rec-1",
        title="Keep hips close",
        guidance="Practice quiet hip rotations",
        evidence_refs=["frame-1"],
        citations=["knowledge:movement-1"],
    )
    result = AnalysisResult(
        observations=[observation], recommendations=[recommendation], provenance=provenance
    )
    assert result.provenance.provider == "qwen-vllm"
    with pytest.raises(ValidationError):
        Observation(
            id="obs-2",
            label="Injury diagnosis",
            detail="This is a torn tendon",
            confidence=0.9,
            visibility="visible",
            evidence_refs=["frame-1"],
        )


def test_result_allows_at_most_five_recommendations() -> None:
    recommendations = [
        Recommendation(
            id=f"rec-{index}",
            title=f"Cue {index}",
            guidance="Practice deliberately",
            evidence_refs=["frame-1"],
            citations=["knowledge:one"],
        )
        for index in range(6)
    ]
    with pytest.raises(ValidationError):
        AnalysisResult(
            observations=[],
            recommendations=recommendations,
            provenance=ProviderProvenance(provider="qwen-vllm", model="qwen", prompt_version="v1"),
        )


def test_recommendations_require_evidence_and_citations() -> None:
    with pytest.raises(ValidationError):
        Recommendation(
            id="rec-1", title="Cue", guidance="Practice", evidence_refs=[], citations=[]
        )
