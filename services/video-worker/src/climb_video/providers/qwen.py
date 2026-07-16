from __future__ import annotations

import base64
import ipaddress
import json
from pathlib import Path
from urllib.parse import urlparse

import httpx
from pydantic import ValidationError

from climb_video.contracts import AnalysisResult, EvidenceSequence, ProviderProvenance
from climb_video.providers.base import PerceptionProvider, ProviderError


def _is_private_url(base_url: str) -> bool:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    host = parsed.hostname
    if host in {"localhost", "vllm", "127.0.0.1", "::1"} or "." not in host:
        return True
    try:
        return ipaddress.ip_address(host).is_private
    except ValueError:
        return host.endswith(".internal") or host.endswith(".local")


class QwenVllmProvider(PerceptionProvider):
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        client: httpx.AsyncClient | None = None,
        timeout_seconds: float = 120,
    ) -> None:
        if not _is_private_url(base_url):
            raise ValueError("Qwen must use a private vLLM URL")
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client = client
        self.timeout_seconds = timeout_seconds

    async def analyze(
        self, sequences: list[EvidenceSequence], knowledge: dict[str, str]
    ) -> AnalysisResult:
        evidence_ids = {frame.id for sequence in sequences for frame in sequence.frames}
        content: list[dict[str, object]] = [
            {
                "type": "text",
                "text": (
                    "Analyze climbing movement only from visible evidence. Return strict JSON matching "
                    "the supplied schema. Never diagnose injury. Reference frame IDs in every observation."
                ),
            }
        ]
        if knowledge:
            content.append(
                {
                    "type": "text",
                    "text": (
                        "Reviewed climbing knowledge (cite only these IDs): "
                        + json.dumps(knowledge, sort_keys=True)
                    ),
                }
            )
        for sequence in sequences:
            for frame in sequence.frames:
                content.append(
                    {
                        "type": "text",
                        "text": f"{sequence.id} {frame.id} timestamp={frame.timestamp_ms}ms",
                    }
                )
                if frame.path and Path(frame.path).is_file():
                    encoded = base64.b64encode(Path(frame.path).read_bytes()).decode("ascii")
                    content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
                        }
                    )
        body = {
            "model": self.model,
            "temperature": 0,
            "messages": [{"role": "user", "content": content}],
            "response_format": {"type": "json_object"},
        }
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient()
        try:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions", json=body, timeout=self.timeout_seconds
            )
            response.raise_for_status()
            message = response.json()["choices"][0]["message"]
            if message.get("refusal"):
                raise ProviderError("model refused the analysis")
            result = AnalysisResult.model_validate(json.loads(message["content"]))
            referenced = {
                ref
                for observation in result.observations
                for ref in observation.evidence_refs
            } | {
                ref
                for recommendation in result.recommendations
                for ref in recommendation.evidence_refs
            }
            unknown = referenced - evidence_ids
            if unknown:
                raise ProviderError(f"unknown evidence reference: {sorted(unknown)}")
            return result.model_copy(
                update={
                    "provenance": ProviderProvenance(
                        provider="qwen-vllm", model=self.model, prompt_version="v1"
                    )
                }
            )
        except ProviderError:
            raise
        except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as error:
            raise ProviderError("invalid provider response") from error
        finally:
            if owns_client:
                await client.aclose()
