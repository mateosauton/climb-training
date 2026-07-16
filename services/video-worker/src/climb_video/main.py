from __future__ import annotations

import asyncio
import contextlib
import socket
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import httpx
from fastapi import FastAPI, Response, status
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import create_client

from climb_video.pipeline import VideoPipeline
from climb_video.providers.qwen import QwenVllmProvider
from climb_video.repository import SupabaseVideoRepository


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    qwen_base_url: str = "http://vllm:8000"
    qwen_model: str = "Qwen/Qwen3-VL-8B-Instruct"
    video_worker_id: str = socket.gethostname()
    video_poll_seconds: float = 2
    video_max_bytes: int = 500 * 1024 * 1024


def build_pipeline(settings: Settings) -> VideoPipeline:
    repository = SupabaseVideoRepository(
        create_client(settings.supabase_url, settings.supabase_service_role_key)
    )
    provider = QwenVllmProvider(base_url=settings.qwen_base_url, model=settings.qwen_model)
    return VideoPipeline(
        repository=repository,
        provider=provider,
        worker_id=settings.video_worker_id,
        max_bytes=settings.video_max_bytes,
    )


def create_app(
    *,
    pipeline: Any | None = None,
    ready: Callable[[], bool] | None = None,
) -> FastAPI:
    state: dict[str, Any] = {"pipeline": pipeline, "ready": ready or (lambda: False)}

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        task: asyncio.Task[None] | None = None
        if state["pipeline"] is None:
            try:
                settings = Settings()  # type: ignore[call-arg]
                state["pipeline"] = build_pipeline(settings)
                state["ready"] = lambda: _model_ready(settings.qwen_base_url)
                state["poll_seconds"] = settings.video_poll_seconds
            except Exception:
                state["pipeline"] = None
        if state["pipeline"] is not None:
            task = asyncio.create_task(
                _consume(state["pipeline"], state.get("poll_seconds", 2))
            )
        yield
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="Climb video worker", lifespan=lifespan)

    @app.get("/healthz")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz")
    async def readiness(response: Response) -> dict[str, str]:
        if not state["ready"]():
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return {"status": "not_ready"}
        return {"status": "ready"}

    return app


async def _consume(pipeline: Any, poll_seconds: float) -> None:
    while True:
        processed = await pipeline.run_once()
        if not processed:
            await asyncio.sleep(poll_seconds)


def _model_ready(base_url: str) -> bool:
    try:
        return httpx.get(f"{base_url.rstrip('/')}/health", timeout=2).is_success
    except httpx.HTTPError:
        return False


app = create_app()
