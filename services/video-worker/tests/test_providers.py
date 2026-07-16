import json

import httpx
import pytest

from climb_video.coaching import CoachingError, synthesize_coaching
from climb_video.contracts import EvidenceFrame, EvidenceSequence
from climb_video.providers.base import PerceptionProvider, ProviderError
from climb_video.providers.openai import OpenAIProvider
from climb_video.providers.qwen import QwenVllmProvider


def evidence() -> list[EvidenceSequence]:
    return [
        EvidenceSequence(
            id="sequence-1",
            frames=[
                EvidenceFrame(
                    id=f"frame-{index}",
                    sequence_id="sequence-1",
                    frame_index=index,
                    timestamp_ms=index * 1000,
                    sha256=f"{index:064x}",
                    path=f"/frames/{index}.jpg",
                )
                for index in range(3)
            ],
        )
    ]


def response_payload(evidence_ref: str = "frame-1") -> dict:
    return {
        "observations": [
            {
                "id": "obs-1",
                "label": "Hip position",
                "detail": "Hips drift away from the wall",
                "confidence": 0.8,
                "visibility": "visible",
                "evidence_refs": [evidence_ref],
            }
        ],
        "recommendations": [],
        "provenance": {"provider": "qwen-vllm", "model": "qwen", "prompt_version": "v1"},
    }


def test_provider_is_an_interface() -> None:
    assert PerceptionProvider.__abstractmethods__ == frozenset({"analyze"})


def test_qwen_requires_private_vllm_url() -> None:
    with pytest.raises(ValueError, match="private vLLM"):
        QwenVllmProvider(base_url="https://models.example.com", model="qwen")
    assert QwenVllmProvider(base_url="http://vllm:8000", model="qwen").model == "qwen"


@pytest.mark.asyncio
async def test_qwen_sends_labeled_timestamps_and_parses_strict_json(tmp_path) -> None:
    for index in range(3):
        (tmp_path / f"{index}.jpg").write_bytes(f"image-{index}".encode())
    sequences = evidence()
    sequences = [
        sequence.model_copy(
            update={
                "frames": [
                    frame.model_copy(update={"path": str(tmp_path / f"{index}.jpg")})
                    for index, frame in enumerate(sequence.frames)
                ]
            }
        )
        for sequence in sequences
    ]
    request_body: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        request_body.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(response_payload())}}]},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = QwenVllmProvider(base_url="http://vllm:8000", model="qwen", client=client)
    result = await provider.analyze(sequences, {"knowledge:one": "Reviewed cue"})
    content = request_body["messages"][0]["content"]
    labels = [part["text"] for part in content if part["type"] == "text"]
    assert any("frame-1" in label and "1000ms" in label for label in labels)
    assert result.observations[0].evidence_refs == ["frame-1"]
    await client.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={"choices": [{"message": {"content": "not-json"}}]}),
        httpx.Response(200, json={"choices": [{"message": {"refusal": "no", "content": ""}}]}),
        httpx.ReadTimeout("slow"),
    ],
)
async def test_qwen_rejects_malformed_refused_and_timed_out_results(response) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        if isinstance(response, Exception):
            raise response
        return response

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = QwenVllmProvider(base_url="http://vllm:8000", model="qwen", client=client)
    with pytest.raises(ProviderError):
        await provider.analyze(evidence(), {})
    await client.aclose()


@pytest.mark.asyncio
async def test_qwen_rejects_unknown_evidence_reference() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"choices": [{"message": {"content": json.dumps(response_payload("missing"))}}]},
            )
        )
    )
    provider = QwenVllmProvider(base_url="http://vllm:8000", model="qwen", client=client)
    with pytest.raises(ProviderError, match="unknown evidence"):
        await provider.analyze(evidence(), {})
    await client.aclose()


def test_coaching_requires_reviewed_citations_and_applies_pain_override() -> None:
    perception = response_payload()
    perception["recommendations"] = [
        {
            "id": "rec-1",
            "title": "Train harder",
            "guidance": "Add maximal attempts",
            "evidence_refs": ["frame-1"],
            "citations": ["knowledge:load"],
        }
    ]
    result = synthesize_coaching(
        perception,
        evidence_ids={"frame-0", "frame-1", "frame-2"},
        reviewed_knowledge={"knowledge:load"},
        athlete_context="Sharp finger pain during loading",
    )
    assert result.recommendations[0].id == "safety-pain"
    assert "stop" in result.recommendations[0].guidance.lower()

    with pytest.raises(CoachingError, match="unreviewed citation"):
        synthesize_coaching(
            perception,
            evidence_ids={"frame-1"},
            reviewed_knowledge=set(),
            athlete_context="",
        )


def test_openai_adapter_is_disabled_by_default() -> None:
    with pytest.raises(ValueError, match="disabled"):
        OpenAIProvider(api_key="secret", model="gpt-4.1")


@pytest.mark.asyncio
async def test_enabled_openai_adapter_uses_same_result_schema() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"choices": [{"message": {"content": json.dumps(response_payload())}}]},
            )
        )
    )
    provider = OpenAIProvider(
        api_key="secret", model="gpt-4.1", enabled=True, client=client
    )
    result = await provider.analyze(evidence(), {"knowledge:one": "Reviewed cue"})
    assert result.observations[0].id == "obs-1"
    assert result.provenance.provider == "openai"
    await client.aclose()
