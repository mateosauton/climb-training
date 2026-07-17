from __future__ import annotations

import base64
import json
from pathlib import Path

import httpx
from pydantic import ValidationError

from climb_video.contracts import AnalysisResult, EvidenceSequence, ProviderProvenance
from climb_video.providers.base import PerceptionProvider, ProviderError


class OpenAIProvider(PerceptionProvider):
    """Optional fallback adapter; deliberately unavailable unless explicitly enabled."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        enabled: bool = False,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not enabled:
            raise ValueError("OpenAI provider is disabled")
        if not api_key:
            raise ValueError("OpenAI API key is required")
        self.api_key = api_key
        self.model = model
        self._client = client

    async def analyze(
        self, sequences: list[EvidenceSequence], knowledge: dict[str, str]
    ) -> AnalysisResult:
        evidence_ids = {frame.id for sequence in sequences for frame in sequence.frames}
        content: list[dict[str, object]] = [
            {"type": "text", "text": "Return strict JSON grounded in the labeled climbing frames."}
        ]
        if knowledge:
            content.append(
                {
                    "type": "text",
                    "text": "Reviewed knowledge (cite only these IDs): " + json.dumps(knowledge),
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
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient()
        try:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "user", "content": content}],
                },
                timeout=120,
            )
            response.raise_for_status()
            message = response.json()["choices"][0]["message"]
            if message.get("refusal"):
                raise ProviderError("model refused the analysis")
            parsed = AnalysisResult.model_validate(json.loads(message["content"]))
            referenced = {
                ref
                for observation in parsed.observations
                for ref in observation.evidence_refs
            } | {
                ref
                for recommendation in parsed.recommendations
                for ref in recommendation.evidence_refs
            }
            if not referenced <= evidence_ids:
                raise ProviderError("unknown evidence reference")
            return parsed.model_copy(
                update={
                    "provenance": ProviderProvenance(
                        provider="openai", model=self.model, prompt_version="v1"
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
