from pathlib import Path
from uuid import uuid4

import pytest

from climb_video.contracts import AnalysisResult, ProviderProvenance
from climb_video.pipeline import ClaimedJob, VideoPipeline
from climb_video.repository import SupabaseVideoRepository


class FakeRepository:
    def __init__(self, claim: ClaimedJob) -> None:
        self.claim_value = claim
        self.checkpoints: list[tuple[str, int, dict]] = []
        self.finalized: list[dict] = []
        self.downloads = 0
        self.fail_finalization = False
        self.knowledge = {"knowledge:movement": "Reviewed movement cue"}

    def claim(self, worker_id: str, visibility_seconds: int):
        value, self.claim_value = self.claim_value, None
        return value

    def download_asset(self, claim: ClaimedJob, destination: Path) -> None:
        self.downloads += 1
        destination.write_bytes(b"video")

    def checkpoint(self, job_id, stage: str, progress: int, payload: dict) -> None:
        assert not self.checkpoints or progress >= self.checkpoints[-1][1]
        self.checkpoints.append((stage, progress, payload))

    def finalize(self, job_id, envelope: dict) -> str:
        if self.fail_finalization:
            raise RuntimeError("database unavailable")
        self.finalized.append(envelope)
        return "analysis-1"

    def get_reviewed_knowledge(self) -> dict[str, str]:
        return self.knowledge


class FakeProvider:
    def __init__(self) -> None:
        self.calls = 0
        self.knowledge: dict[str, str] = {}

    async def analyze(self, sequences, knowledge):  # type: ignore[no-untyped-def]
        self.calls += 1
        self.knowledge = knowledge
        return AnalysisResult(
            observations=[],
            recommendations=[],
            provenance=ProviderProvenance(
                provider="qwen-vllm", model="qwen", prompt_version="v1"
            ),
        )


def claim(checkpoint: dict | None = None, attempt: int = 1) -> ClaimedJob:
    return ClaimedJob(
        job_id=uuid4(),
        asset_id=uuid4(),
        correlation_id="corr-1",
        bucket="climbing-videos",
        object_path="athlete/asset.mp4",
        attempt=attempt,
        checkpoint=checkpoint or {},
    )


@pytest.mark.asyncio
async def test_pipeline_claims_downloads_checkpoints_and_finalizes(monkeypatch) -> None:
    claimed = claim()
    repository = FakeRepository(claimed)
    provider = FakeProvider()
    monkeypatch.setattr("climb_video.pipeline.probe_video", lambda path, max_bytes: object())
    monkeypatch.setattr("climb_video.pipeline.extract_frames", lambda *args, **kwargs: [])
    monkeypatch.setattr("climb_video.pipeline.select_evidence", lambda frames: [])
    pipeline = VideoPipeline(repository=repository, provider=provider, worker_id="worker-1")

    processed = await pipeline.run_once()

    assert processed is True
    assert repository.downloads == 1
    assert [stage for stage, _, _ in repository.checkpoints] == ["extracting", "perceiving"]
    assert repository.finalized[0]["job_id"] == str(claimed.job_id)
    assert provider.calls == 1
    assert provider.knowledge == repository.knowledge


@pytest.mark.asyncio
async def test_pipeline_reuses_persisted_provider_result_on_redelivery() -> None:
    result = AnalysisResult(
        observations=[],
        recommendations=[],
        provenance=ProviderProvenance(provider="qwen-vllm", model="qwen", prompt_version="v1"),
    )
    claimed = claim(checkpoint={"provider_result": result.model_dump(mode="json"), "evidence_sequences": []}, attempt=2)
    repository = FakeRepository(claimed)
    provider = FakeProvider()
    pipeline = VideoPipeline(repository=repository, provider=provider, worker_id="worker-1")

    assert await pipeline.run_once() is True
    assert repository.downloads == 0
    assert provider.calls == 0
    assert len(repository.finalized) == 1


@pytest.mark.asyncio
async def test_pipeline_records_safe_failure_and_retry_exhaustion() -> None:
    repository = FakeRepository(claim(attempt=3))
    provider = FakeProvider()
    pipeline = VideoPipeline(repository=repository, provider=provider, worker_id="worker-1", max_attempts=3)
    repository.download_asset = lambda claim, destination: (_ for _ in ()).throw(RuntimeError("secret=abc"))  # type: ignore[method-assign]

    assert await pipeline.run_once() is True
    stage, _, payload = repository.checkpoints[-1]
    assert stage == "failed"
    assert payload == {"code": "processing_failed", "retryable": False}


def test_repository_uses_narrow_rpcs_and_signed_private_download(tmp_path: Path) -> None:
    calls: list[tuple[str, dict]] = []

    class Query:
        def __init__(self, data):  # type: ignore[no-untyped-def]
            self.data = data

        def execute(self):  # type: ignore[no-untyped-def]
            return self

    class Bucket:
        def create_signed_url(self, path, expires_in):  # type: ignore[no-untyped-def]
            calls.append(("signed", {"path": path, "expires": expires_in}))
            return {"signedURL": "https://storage.invalid/signed"}

    class Client:
        storage = type("Storage", (), {"from_": lambda self, bucket: Bucket()})()

        def rpc(self, name, params):  # type: ignore[no-untyped-def]
            calls.append((name, params))
            return Query(None)

    repo = SupabaseVideoRepository(Client(), http_get=lambda url: b"private-video")  # type: ignore[arg-type]
    claimed = claim()
    repo.checkpoint(claimed.job_id, "extracting", 10, {})
    assert repo.get_reviewed_knowledge() == {}
    repo.finalize(claimed.job_id, {"job_id": str(claimed.job_id)})
    destination = tmp_path / "video.mp4"
    repo.download_asset(claimed, destination)
    assert destination.read_bytes() == b"private-video"
    assert [name for name, _ in calls] == [
        "checkpoint_video_analysis_job",
        "get_reviewed_climbing_knowledge",
        "finalize_video_analysis_job",
        "signed",
    ]
