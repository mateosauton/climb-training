import numpy as np
import pytest

from climb_video.training import (
    TrainingSample,
    artifact_is_accepted,
    fit_contact_prior,
    participant_group,
    split_participants,
    validate_artifact,
)


def test_participant_split_is_disjoint_and_groups_repeat_sessions() -> None:
    assert participant_group("p2a") == participant_group("p2b") == "p2"
    split = split_participants([f"p{i}" for i in range(1, 11)] + ["p2a", "p2b"], seed=42)
    assert set(split["train"]).isdisjoint(split["validation"])
    assert set(split["train"]).isdisjoint(split["test"])
    assert set(split["validation"]).isdisjoint(split["test"])
    assert sum(map(len, split.values())) == 10


def test_fit_produces_real_weights_metrics_and_no_demographics() -> None:
    samples = []
    for participant in [f"p{i}" for i in range(1, 11)]:
        for index in range(20):
            positive = index >= 15
            samples.append(
                TrainingSample(
                    participant=participant,
                    features=np.array([0.2, 0.8, 3.0 if positive else 0.1]),
                    label=int(positive),
                )
            )
    artifact = fit_contact_prior(samples, seed=42, trained_at="2026-07-16T00:00:00Z")
    validate_artifact(artifact)
    assert any(abs(value) > 0.01 for value in artifact["model"]["coefficients"])
    assert artifact["metrics"]["test"]["roc_auc"] > 0.9
    assert artifact["metrics"]["test"]["positive_count"] == 10
    assert artifact["metrics"]["test"]["negative_count"] == 30
    assert 0 <= artifact["metrics"]["test"]["balanced_accuracy"] <= 1
    assert 0 <= artifact["metrics"]["test"]["precision"] <= 1
    assert 0 <= artifact["metrics"]["test"]["recall"] <= 1
    assert artifact_is_accepted(artifact)

    def keys(value):  # type: ignore[no-untyped-def]
        if isinstance(value, dict):
            return set(value) | set().union(*(keys(item) for item in value.values()))
        if isinstance(value, list):
            return set().union(*(keys(item) for item in value), set())
        return set()

    assert keys(artifact).isdisjoint({"height", "age", "gender", "experience"})


def test_artifact_validation_rejects_wrong_features() -> None:
    with pytest.raises(ValueError, match="features"):
        validate_artifact({"schema_version": 1, "features": ["bad"]})


def test_quality_gate_rejects_weak_validation_metrics() -> None:
    artifact = {
        "metrics": {
            "validation": {"roc_auc": 0.53, "balanced_accuracy": 0.51},
        }
    }
    assert not artifact_is_accepted(artifact)
