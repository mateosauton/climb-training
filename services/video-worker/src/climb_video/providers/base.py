from __future__ import annotations

from abc import ABC, abstractmethod

from climb_video.contracts import AnalysisResult, EvidenceSequence


class ProviderError(RuntimeError):
    pass


class PerceptionProvider(ABC):
    @abstractmethod
    async def analyze(self, sequences: list[EvidenceSequence]) -> AnalysisResult:
        """Analyze timestamped evidence and return a grounded structured result."""

