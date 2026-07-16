from climb_video.media import ExtractedFrame, FrameScore
from climb_video.selector import select_evidence


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
    assert [frame.timestamp_ms for frame in selected] == sorted(frame.timestamp_ms for frame in selected)
    assert all(3 <= len(sequence.frames) <= 8 for sequence in sequences)


def test_selector_caps_sequences_and_total_frames() -> None:
    sequences = select_evidence([candidate(index) for index in range(100)], sequence_size=5)
    assert len(sequences) <= 12
    assert sum(len(sequence.frames) for sequence in sequences) <= 60


def test_selector_discards_incomplete_sequence() -> None:
    assert select_evidence([candidate(0), candidate(1)], sequence_size=3) == []
