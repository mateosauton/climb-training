from fastapi.testclient import TestClient

from climb_video.main import create_app


class Pipeline:
    async def run_once(self) -> bool:
        return False


def test_health_and_readiness() -> None:
    app = create_app(pipeline=Pipeline(), ready=lambda: True)
    with TestClient(app) as client:
        assert client.get("/healthz").json() == {"status": "ok"}
        assert client.get("/readyz").status_code == 200


def test_readiness_reports_dependency_failure() -> None:
    app = create_app(pipeline=Pipeline(), ready=lambda: False)
    with TestClient(app) as client:
        response = client.get("/readyz")
        assert response.status_code == 503
        assert response.json() == {"status": "not_ready"}
