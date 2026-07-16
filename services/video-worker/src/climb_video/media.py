from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


class MediaError(ValueError):
    pass


@dataclass(frozen=True)
class VideoMetadata:
    duration_ms: int
    width: int
    height: int
    size_bytes: int


@dataclass(frozen=True)
class FrameScore:
    blur: float
    exposure: float
    motion: float


@dataclass(frozen=True)
class ExtractedFrame:
    path: str
    index: int
    timestamp_ms: int
    sha256: str
    score: FrameScore = FrameScore(blur=0, exposure=0, motion=0)


def probe_video(path: Path, *, max_bytes: int) -> VideoMetadata:
    size = path.stat().st_size
    if size > max_bytes:
        raise MediaError("video exceeds maximum size")
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height:format=duration",
                "-of",
                "json",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        payload = json.loads(completed.stdout)
        stream = payload["streams"][0]
        duration_ms = round(float(payload["format"]["duration"]) * 1000)
        width, height = int(stream["width"]), int(stream["height"])
        if duration_ms <= 0 or width <= 0 or height <= 0:
            raise ValueError
    except (subprocess.SubprocessError, json.JSONDecodeError, KeyError, IndexError, ValueError) as error:
        raise MediaError("invalid video") from error
    return VideoMetadata(duration_ms=duration_ms, width=width, height=height, size_bytes=size)


def score_frame(image: np.ndarray, previous: np.ndarray | None = None) -> FrameScore:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    exposure = float(np.mean((gray > 5) & (gray < 250)))
    motion = 0.0
    if previous is not None:
        previous_gray = cv2.cvtColor(previous, cv2.COLOR_BGR2GRAY)
        motion = float(cv2.absdiff(gray, previous_gray).mean())
    return FrameScore(blur=blur, exposure=exposure, motion=motion)


def extract_frames(path: Path, output_dir: Path, *, fps: int = 1, max_frames: int = 60) -> list[ExtractedFrame]:
    if fps <= 0 or max_frames <= 0:
        raise ValueError("fps and max_frames must be positive")
    output_dir.mkdir(parents=True, exist_ok=True)
    pattern = output_dir / "frame-%06d.jpg"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(path),
                "-vf",
                f"fps={fps}",
                "-frames:v",
                str(max_frames),
                "-q:v",
                "2",
                str(pattern),
            ],
            check=True,
            capture_output=True,
            timeout=300,
        )
    except subprocess.SubprocessError as error:
        raise MediaError("frame extraction failed") from error

    result: list[ExtractedFrame] = []
    previous: np.ndarray | None = None
    for index, frame_path in enumerate(sorted(output_dir.glob("frame-*.jpg"))):
        content = frame_path.read_bytes()
        image = cv2.imread(str(frame_path))
        score = score_frame(image, previous) if image is not None else FrameScore(0, 0, 0)
        result.append(
            ExtractedFrame(
                path=str(frame_path),
                index=index,
                timestamp_ms=round(index * 1000 / fps),
                sha256=hashlib.sha256(content).hexdigest(),
                score=score,
            )
        )
        if image is not None:
            previous = image
    return result

