import json
from pathlib import Path

import numpy as np
import pytest

from climb_video.media import MediaError, extract_frames, probe_video, score_frame


def test_probe_uses_safe_argument_list_and_validates_metadata(monkeypatch, tmp_path: Path) -> None:
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"video")
    observed: list[str] = []

    def fake_run(args, **kwargs):  # type: ignore[no-untyped-def]
        observed.extend(args)
        return type("Result", (), {"stdout": json.dumps({"format": {"duration": "12.5"}, "streams": [{"width": 720, "height": 1280}]})})()

    monkeypatch.setattr("climb_video.media.subprocess.run", fake_run)
    metadata = probe_video(video, max_bytes=10)
    assert metadata.duration_ms == 12_500
    assert observed[-1] == str(video)
    assert "shell" not in observed


def test_probe_rejects_oversized_and_corrupt_media(monkeypatch, tmp_path: Path) -> None:
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"too-big")
    with pytest.raises(MediaError, match="maximum size"):
        probe_video(video, max_bytes=2)

    monkeypatch.setattr(
        "climb_video.media.subprocess.run",
        lambda *args, **kwargs: type("Result", (), {"stdout": "not-json"})(),
    )
    with pytest.raises(MediaError, match="invalid video"):
        probe_video(video, max_bytes=100)


def test_extract_frames_keeps_one_fps_timestamps(monkeypatch, tmp_path: Path) -> None:
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"video")
    output = tmp_path / "frames"
    calls: list[list[str]] = []

    def fake_run(args, **kwargs):  # type: ignore[no-untyped-def]
        calls.append(args)
        output.mkdir(exist_ok=True)
        for index in range(3):
            (output / f"frame-{index + 1:06d}.jpg").write_bytes(str(index).encode())
        return type("Result", (), {})()

    monkeypatch.setattr("climb_video.media.subprocess.run", fake_run)
    frames = extract_frames(video, output, fps=1, max_frames=60)
    assert [item.timestamp_ms for item in frames] == [0, 1000, 2000]
    assert "fps=1" in calls[0]
    assert "-frames:v" in calls[0]


def test_score_frame_measures_blur_exposure_and_motion() -> None:
    sharp = np.zeros((32, 32, 3), dtype=np.uint8)
    sharp[::2, ::2] = 255
    previous = np.full((32, 32, 3), 127, dtype=np.uint8)
    score = score_frame(sharp, previous)
    assert score.blur > 0
    assert 0 <= score.exposure <= 1
    assert score.motion > 0
