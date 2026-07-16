from __future__ import annotations

import re
from typing import Any

from pydantic import ValidationError

from climb_video.contracts import AnalysisResult, Recommendation


class CoachingError(ValueError):
    pass


_PAIN_PATTERN = re.compile(r"\b(pain|hurt|injur|sharp|swelling|numb)\w*\b", re.IGNORECASE)


def synthesize_coaching(
    perception: dict[str, Any],
    *,
    evidence_ids: set[str],
    reviewed_knowledge: set[str],
    athlete_context: str,
) -> AnalysisResult:
    try:
        result = AnalysisResult.model_validate(perception)
    except ValidationError as error:
        raise CoachingError("invalid perception result") from error

    for observation in result.observations:
        if not set(observation.evidence_refs) <= evidence_ids:
            raise CoachingError("unknown evidence reference")
    for recommendation in result.recommendations:
        if not set(recommendation.evidence_refs) <= evidence_ids:
            raise CoachingError("unknown evidence reference")
        unknown = set(recommendation.citations) - reviewed_knowledge
        if unknown:
            raise CoachingError(f"unreviewed citation: {sorted(unknown)}")

    if _PAIN_PATTERN.search(athlete_context):
        anchor = next(iter(sorted(evidence_ids)), "athlete-context")
        override = Recommendation(
            id="safety-pain",
            title="Stop painful loading",
            guidance=(
                "Stop the painful movement and reduce load. Seek an appropriate qualified health "
                "professional if symptoms persist or are severe."
            ),
            evidence_refs=[anchor],
            citations=["safety:pain-override"],
        )
        return result.model_copy(update={"recommendations": [override]})
    return result

