from __future__ import annotations

from climb_video.contracts import AnalysisResult, EvidenceSequence
from climb_video.providers.base import PerceptionProvider, ProviderError


class OpenAIProvider(PerceptionProvider):
    """Optional fallback adapter; deliberately unavailable unless explicitly enabled."""

    def __init__(self, *, api_key: str, model: str, enabled: bool = False) -> None:
        if not enabled:
            raise ValueError("OpenAI provider is disabled")
        if not api_key:
            raise ValueError("OpenAI API key is required")
        self.api_key = api_key
        self.model = model

    async def analyze(self, sequences: list[EvidenceSequence]) -> AnalysisResult:
        raise ProviderError("OpenAI fallback is not configured in this deployment")

