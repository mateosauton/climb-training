from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from climb_video.media import score_frame

FEATURES = ["log1p_blur", "exposure", "log1p_motion"]


@dataclass(frozen=True)
class TrainingSample:
    participant: str
    features: np.ndarray
    label: int


def participant_group(name: str) -> str:
    match = re.fullmatch(r"(p\d+)[a-z]*", name.lower())
    if not match:
        raise ValueError(f"invalid participant directory: {name}")
    return match.group(1)


def split_participants(participants: list[str], *, seed: int) -> dict[str, list[str]]:
    groups = sorted({participant_group(item) for item in participants})
    groups.sort(key=lambda item: hashlib.sha256(f"{seed}:{item}".encode()).hexdigest())
    train_end = max(1, int(len(groups) * 0.7))
    validation_end = max(train_end + 1, int(len(groups) * 0.85))
    return {
        "train": groups[:train_end],
        "validation": groups[train_end:validation_end],
        "test": groups[validation_end:],
    }


def _sigmoid(values: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-np.clip(values, -30, 30)))


def _metrics(labels: np.ndarray, probabilities: np.ndarray, threshold: float) -> dict[str, float]:
    order = np.argsort(probabilities)
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(1, len(labels) + 1)
    positives, negatives = labels.sum(), len(labels) - labels.sum()
    auc = (ranks[labels == 1].sum() - positives * (positives + 1) / 2) / max(
        positives * negatives, 1
    )
    descending = np.argsort(-probabilities)
    sorted_labels = labels[descending]
    precision = np.cumsum(sorted_labels) / np.arange(1, len(labels) + 1)
    ap = float((precision * sorted_labels).sum() / max(positives, 1))
    predicted = probabilities >= threshold
    tp = int(np.sum(predicted & (labels == 1)))
    fp = int(np.sum(predicted & (labels == 0)))
    fn = int(np.sum(~predicted & (labels == 1)))
    f1 = 2 * tp / max(2 * tp + fp + fn, 1)
    return {"roc_auc": round(float(auc), 4), "average_precision": round(ap, 4), "f1": round(f1, 4)}


def fit_contact_prior(
    samples: list[TrainingSample], *, seed: int = 42, trained_at: str | None = None
) -> dict[str, Any]:
    splits = split_participants([sample.participant for sample in samples], seed=seed)
    by_split = {
        name: [sample for sample in samples if participant_group(sample.participant) in groups]
        for name, groups in splits.items()
    }
    train = by_split["train"]
    x_train = np.stack([sample.features for sample in train])
    y_train = np.array([sample.label for sample in train], dtype=float)
    means = x_train.mean(axis=0)
    scales = x_train.std(axis=0)
    scales[scales < 1e-8] = 1
    x = (x_train - means) / scales
    weights = np.zeros(x.shape[1])
    intercept = 0.0
    positives = max(y_train.sum(), 1)
    negatives = max(len(y_train) - positives, 1)
    sample_weights = np.where(
        y_train == 1, len(y_train) / (2 * positives), len(y_train) / (2 * negatives)
    )
    for _ in range(1200):
        error = (_sigmoid(x @ weights + intercept) - y_train) * sample_weights
        weights -= 0.08 * ((x.T @ error) / len(x) + 0.001 * weights)
        intercept -= 0.08 * float(error.mean())

    def probabilities(items: list[TrainingSample]) -> tuple[np.ndarray, np.ndarray]:
        features = np.stack([item.features for item in items])
        labels = np.array([item.label for item in items])
        return labels, _sigmoid(((features - means) / scales) @ weights + intercept)

    val_labels, val_probabilities = probabilities(by_split["validation"])
    thresholds = np.linspace(0.1, 0.9, 81)
    threshold = max(
        thresholds, key=lambda value: _metrics(val_labels, val_probabilities, float(value))["f1"]
    )
    metrics = {}
    for name in ("validation", "test"):
        labels, probs = probabilities(by_split[name])
        metrics[name] = _metrics(labels, probs, float(threshold))
    return {
        "schema_version": 1,
        "model_id": "contact-transition-prior",
        "version": "1.0.0",
        "trained_at": trained_at or datetime.now(UTC).isoformat(),
        "dataset": {
            "id": "the-way-up-zenodo-15196867",
            "doi": "10.5281/zenodo.15196867",
            "license": "CC-BY-4.0",
            "checksum": "md5:a46cbca826a7f28ab591a4900ce5a1c9",
        },
        "features": FEATURES,
        "preprocessing": {"means": means.tolist(), "scales": scales.tolist()},
        "model": {
            "type": "logistic_regression",
            "coefficients": weights.tolist(),
            "intercept": intercept,
            "threshold": float(threshold),
        },
        "training": {
            "seed": seed,
            "fps": 1,
            "transition_tolerance_seconds": 0.75,
            "split": "participant-disjoint-70-15-15",
            "participant_counts": {name: len(groups) for name, groups in splits.items()},
            "sample_counts": {name: len(items) for name, items in by_split.items()},
        },
        "metrics": metrics,
    }


def validate_artifact(artifact: dict[str, Any]) -> None:
    if artifact.get("schema_version") != 1 or artifact.get("features") != FEATURES:
        raise ValueError("invalid contact-prior features")
    model = artifact.get("model", {})
    preprocessing = artifact.get("preprocessing", {})
    if (
        len(model.get("coefficients", [])) != 3
        or len(preprocessing.get("means", [])) != 3
        or len(preprocessing.get("scales", [])) != 3
    ):
        raise ValueError("invalid contact-prior dimensions")
    if artifact.get("dataset", {}).get("license") != "CC-BY-4.0":
        raise ValueError("invalid dataset license")


def _transitions(csv_path: Path) -> list[int]:
    result: list[int] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        for row in reader:
            if len(row) >= 3:
                result.extend([int(row[1]), int(row[2])])
    return result


def extract_training_samples(root: Path) -> list[TrainingSample]:
    result: list[TrainingSample] = []
    for video in sorted(root.glob("p*/*.mp4")):
        annotation = video.with_name(f"{video.stem}_holdUsage.csv")
        if not annotation.exists() or video.stem.endswith("_large"):
            continue
        transitions = _transitions(annotation)
        capture = cv2.VideoCapture(str(video))
        source_fps = capture.get(cv2.CAP_PROP_FPS) or 25
        participant = video.parent.name
        previous = None
        second = 0
        while True:
            capture.set(cv2.CAP_PROP_POS_MSEC, second * 1000)
            ok, image = capture.read()
            if not ok:
                break
            score = score_frame(image, previous)
            frame_number = round(second * source_fps)
            label = int(
                any(
                    abs(frame_number - transition) <= source_fps * 0.75
                    for transition in transitions
                )
            )
            features = np.array([np.log1p(score.blur), score.exposure, np.log1p(score.motion)])
            result.append(TrainingSample(participant, features, label))
            previous = image
            second += 1
        capture.release()
    if not result:
        raise ValueError("no annotated standard-resolution videos found")
    return result


def train(source: Path, output: Path) -> dict[str, Any]:
    if source.suffix.lower() == ".zip":
        with tempfile.TemporaryDirectory() as directory:
            with zipfile.ZipFile(source) as archive:
                safe = [
                    name
                    for name in archive.namelist()
                    if ".." not in Path(name).parts
                    and (name.endswith(".mp4") or name.endswith("_holdUsage.csv"))
                    and "_large.mp4" not in name
                ]
                archive.extractall(directory, safe)
            artifact = fit_contact_prior(extract_training_samples(Path(directory)))
    else:
        artifact = fit_contact_prior(extract_training_samples(source))
    validate_artifact(artifact)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    artifact = train(args.source, args.output)
    print(json.dumps(artifact["metrics"], indent=2))
