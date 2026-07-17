import json

import numpy as np

from climb_video.media import ExtractedFrame, FrameScore
from climb_video.selector import ContactTransitionPrior, load_prior, select_evidence


def candidate(index: int, digest: str | None = None) -> ExtractedFrame:
    return ExtractedFrame(
        path=f"frame-{index}.jpg",
        index=index,
        timestamp_ms=index * 1000,
        sha256=digest or f"{index:064x}",
        score=FrameScore(blur=100, exposure=0.8, motion=float(index % 4)),
    )


def test_selector_deduplicates_and_preserves_order() -> None:
    frames = [candidate(index) for index in range(10)]
    frames.insert(5, candidate(99, frames[4].sha256))
    sequences = select_evidence(frames, sequence_size=3)
    selected = [frame for sequence in sequences for frame in sequence.frames]
    assert len({frame.sha256 for frame in selected}) == len(selected)
    assert [frame.timestamp_ms for frame in selected] == sorted(
        frame.timestamp_ms for frame in selected
    )
    assert all(3 <= len(sequence.frames) <= 8 for sequence in sequences)


def test_selector_caps_sequences_and_total_frames() -> None:
    sequences = select_evidence([candidate(index) for index in range(100)], sequence_size=5)
    assert len(sequences) <= 12
    assert sum(len(sequence.frames) for sequence in sequences) <= 60


def test_selector_discards_incomplete_sequence() -> None:
    assert select_evidence([candidate(0), candidate(1)], sequence_size=3) == []


def test_trained_prior_ranks_late_transition_across_full_clip() -> None:
    frames = [candidate(index) for index in range(100)]
    frames[90] = ExtractedFrame(
        path="frame-90.jpg",
        index=90,
        timestamp_ms=90_000,
        sha256=f"{90:064x}",
        score=FrameScore(blur=100, exposure=0.8, motion=100),
    )
    prior = ContactTransitionPrior(
        means=np.array([0.0, 0.0, 0.0]),
        scales=np.array([1.0, 1.0, 1.0]),
        coefficients=np.array([0.0, 0.0, 4.0]),
        intercept=-8.0,
    )
    sequences = select_evidence(frames, sequence_size=5, max_sequences=1, prior=prior)
    assert any(frame.frame_index == 90 for frame in sequences[0].frames)


def test_loader_does_not_enable_rejected_artifact(tmp_path) -> None:  # type: ignore[no-untyped-def]
    artifact = {
        "schema_version": 1,
        "features": ["log1p_blur", "exposure", "log1p_motion"],
        "dataset": {"license": "CC-BY-4.0"},
        "preprocessing": {"means": [0, 0, 0], "scales": [1, 1, 1]},
        "model": {"coefficients": [0, 0, 1], "intercept": 0},
        "metrics": {"validation": {"roc_auc": 0.53, "balanced_accuracy": 0.51}},
    }
    path = tmp_path / "prior.json"
    path.write_text(json.dumps(artifact), encoding="utf-8")
    assert load_prior(path) is None
