from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app("sqlite://")
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_patient_and_add_confirmed_intake(client: TestClient) -> None:
    patient_response = client.post(
        "/patients",
        json={
            "full_name": "  Synthetic Patient  ",
            "date_of_birth": "2000-01-15",
            "village": "Example Village",
        },
    )

    assert patient_response.status_code == 201
    patient = patient_response.json()
    assert patient["full_name"] == "Synthetic Patient"

    intake_response = client.post(
        f"/patients/{patient['id']}/intakes",
        json={
            "symptoms": "  Synthetic symptom description  ",
            "duration": "2 days",
            "relevant_history": None,
            "confirmed_by_worker": True,
        },
    )

    assert intake_response.status_code == 201
    assert intake_response.json()["symptoms"] == "Synthetic symptom description"

    detail_response = client.get(f"/patients/{patient['id']}")
    assert detail_response.status_code == 200
    assert len(detail_response.json()["intakes"]) == 1


def test_intake_requires_worker_confirmation(client: TestClient) -> None:
    patient = client.post("/patients", json={"full_name": "Synthetic Patient"}).json()

    response = client.post(
        f"/patients/{patient['id']}/intakes",
        json={"symptoms": "Example symptom", "confirmed_by_worker": False},
    )

    assert response.status_code == 422


def test_intake_requires_nonblank_symptoms(client: TestClient) -> None:
    patient = client.post("/patients", json={"full_name": "Synthetic Patient"}).json()

    response = client.post(
        f"/patients/{patient['id']}/intakes",
        json={"symptoms": "   ", "confirmed_by_worker": True},
    )

    assert response.status_code == 422


def test_intake_for_unknown_patient_returns_not_found(client: TestClient) -> None:
    response = client.post(
        "/patients/00000000-0000-0000-0000-000000000001/intakes",
        json={"symptoms": "Example symptom", "confirmed_by_worker": True},
    )

    assert response.status_code == 404
