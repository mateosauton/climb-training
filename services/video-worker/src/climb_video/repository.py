from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx


class RepositoryError(RuntimeError):
    pass


class SupabaseVideoRepository:
    def __init__(
        self,
        client: Any,
        *,
        http_get: Callable[[str], bytes] | None = None,
    ) -> None:
        self.client = client
        self._http_get = http_get or self._download

    @staticmethod
    def _download(url: str) -> bytes:
        response = httpx.get(url, timeout=120, follow_redirects=True)
        response.raise_for_status()
        return response.content

    def claim(self, worker_id: str, visibility_seconds: int) -> Any:
        from climb_video.pipeline import ClaimedJob

        response = self.client.rpc(
            "claim_video_analysis_job",
            {"p_worker_id": worker_id, "p_visibility_seconds": visibility_seconds},
        ).execute()
        data = response.data
        if not data:
            return None
        try:
            return ClaimedJob(
                job_id=UUID(str(data["job_id"])),
                asset_id=UUID(str(data.get("video_asset_id", data.get("asset_id")))),
                correlation_id=data["correlation_id"],
                bucket=data["bucket"],
                object_path=data["object_path"],
                attempt=data["attempt_count"],
                checkpoint=data.get("checkpoint", data.get("checkpoints", {})),
            )
        except (KeyError, TypeError, ValueError) as error:
            raise RepositoryError("claim returned invalid identifiers") from error

    def checkpoint(self, job_id: UUID, stage: str, progress: int, payload: dict[str, Any]) -> None:
        self.client.rpc(
            "checkpoint_video_analysis_job",
            {
                "p_job_id": str(job_id),
                "p_stage": stage,
                "p_progress": progress,
                "p_checkpoint": payload,
            },
        ).execute()

    def finalize(self, job_id: UUID, envelope: dict[str, Any]) -> str:
        response = self.client.rpc(
            "finalize_video_analysis_job",
            {"p_job_id": str(job_id), "p_result": envelope},
        ).execute()
        return str(response.data)

    def get_reviewed_knowledge(self) -> dict[str, str]:
        response = self.client.rpc("get_reviewed_climbing_knowledge", {}).execute()
        if response.data is None:
            return {}
        if not isinstance(response.data, list):
            raise RepositoryError("reviewed knowledge RPC returned invalid data")
        result: dict[str, str] = {}
        for item in response.data:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not isinstance(item.get("content"), str):
                raise RepositoryError("reviewed knowledge RPC returned invalid data")
            result[item["id"]] = item["content"]
        return result

    def download_asset(self, claim: Any, destination: Path) -> None:
        signed = self.client.storage.from_(claim.bucket).create_signed_url(
            claim.object_path, expires_in=300
        )
        url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
        if not isinstance(url, str):
            raise RepositoryError("private download URL unavailable")
        destination.write_bytes(self._http_get(url))
