from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from climb_video.contracts import EvidenceFrame, EvidenceSequence
from climb_video.media import ExtractedFrame
from climb_video.training import artifact_is_accepted, validate_artifact


@dataclass(frozen=True)
class ContactTransitionPrior:
    means: np.ndarray
    scales: np.ndarray
    coefficients: np.ndarray
    intercept: float

    def probability(self, frame: ExtractedFrame) -> float:
        features = np.array(
            [np.log1p(frame.score.blur), frame.score.exposure, np.log1p(frame.score.motion)]
        )
        value = float(((features - self.means) / self.scales) @ self.coefficients + self.intercept)
        return 1 / (1 + float(np.exp(-np.clip(value, -30, 30))))

    @classmethod
    def load(cls, path: Path) -> ContactTransitionPrior:
        artifact = json.loads(path.read_text(encoding="utf-8"))
        validate_artifact(artifact)
        return cls(
            means=np.array(artifact["preprocessing"]["means"]),
            scales=np.array(artifact["preprocessing"]["scales"]),
            coefficients=np.array(artifact["model"]["coefficients"]),
            intercept=float(artifact["model"]["intercept"]),
        )


def load_default_prior() -> ContactTransitionPrior | None:
    path = Path(__file__).parent / "models" / "contact-transition-v1.json"
    return load_prior(path) if path.exists() else None


def load_prior(path: Path) -> ContactTransitionPrior | None:
    artifact = json.loads(path.read_text(encoding="utf-8"))
    validate_artifact(artifact)
    return ContactTransitionPrior.load(path) if artifact_is_accepted(artifact) else None


def select_evidence(
    frames: list[ExtractedFrame],
    *,
    sequence_size: int = 5,
    max_sequences: int = 12,
    max_frames: int = 60,
    prior: ContactTransitionPrior | None = None,
) -> list[EvidenceSequence]:
    if not 3 <= sequence_size <= 8:
        raise ValueError("sequence size must be between 3 and 8")
    ordered = sorted(frames, key=lambda item: item.timestamp_ms)
    unique: list[ExtractedFrame] = []
    hashes: set[str] = set()
    for frame in ordered:
        if frame.sha256 not in hashes:
            hashes.add(frame.sha256)
            unique.append(frame)

    prior = prior or load_default_prior()
    candidates: list[tuple[float, list[ExtractedFrame]]] = []
    for start in range(0, max(0, len(unique) - sequence_size + 1), max(1, sequence_size // 2)):
        group = unique[start : start + sequence_size]
        score = max((prior.probability(frame) if prior else frame.score.motion) for frame in group)
        candidates.append((score, group))
    selected_groups: list[list[ExtractedFrame]] = []
    used: set[str] = set()
    frame_limit = min(max_frames, max_sequences * sequence_size)
    for _, group in sorted(candidates, key=lambda item: item[0], reverse=True):
        if any(frame.sha256 in used for frame in group):
            continue
        if sum(len(item) for item in selected_groups) + len(group) > frame_limit:
            continue
        selected_groups.append(group)
        used.update(frame.sha256 for frame in group)
        if len(selected_groups) >= max_sequences:
            break
    selected_groups.sort(key=lambda group: group[0].timestamp_ms)
    sequences: list[EvidenceSequence] = []
    for group in selected_groups:
        sequence_id = f"sequence-{len(sequences) + 1}"
        sequence_frames = [
            EvidenceFrame(
                id=f"{sequence_id}-frame-{position + 1}",
                sequence_id=sequence_id,
                frame_index=frame.index,
                timestamp_ms=frame.timestamp_ms,
                sha256=frame.sha256,
                path=frame.path,
                blur_score=frame.score.blur,
                exposure_score=frame.score.exposure,
                motion_score=frame.score.motion,
            )
            for position, frame in enumerate(group)
        ]
        sequences.append(EvidenceSequence(id=sequence_id, frames=sequence_frames))
    return sequences
