from __future__ import annotations

from climb_video.contracts import EvidenceFrame, EvidenceSequence
from climb_video.media import ExtractedFrame


def select_evidence(
    frames: list[ExtractedFrame],
    *,
    sequence_size: int = 5,
    max_sequences: int = 12,
    max_frames: int = 60,
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

    limit = min(max_frames, max_sequences * sequence_size)
    selected = unique[:limit]
    sequences: list[EvidenceSequence] = []
    for start in range(0, len(selected), sequence_size):
        group = selected[start : start + sequence_size]
        if len(group) < 3 or len(sequences) >= max_sequences:
            break
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

