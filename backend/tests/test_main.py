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


def test_referral_review_and_facility_status_lifecycle(client: TestClient) -> None:
    patient = client.post("/patients", json={"full_name": "Synthetic Patient"}).json()
    intake = client.post(
        f"/patients/{patient['id']}/intakes",
        json={"symptoms": "Synthetic symptom", "confirmed_by_worker": True},
    ).json()
    referral_response = client.post(
        f"/patients/{patient['id']}/referrals",
        json={
            "requested_service": "Synthetic diagnostic service",
            "reason": "Synthetic evaluation request",
            "requested_by": "worker-demo",
            "intake_id": intake["id"],
        },
    )

    assert referral_response.status_code == 201
    referral = referral_response.json()
    assert referral["status"] == "pending_review"
    assert referral["events"][0]["to_status"] == "pending_review"

    review_response = client.post(
        f"/referrals/{referral['id']}/review",
        json={
            "decision": "approved",
            "reviewed_by": "doctor-demo",
            "note": "Synthetic review note",
        },
    )
    assert review_response.status_code == 200
    assert review_response.json()["status"] == "approved"

    arrival_response = client.post(
        f"/referrals/{referral['id']}/status",
        json={"status": "patient_arrived", "updated_by": "facility-demo"},
    )
    assert arrival_response.status_code == 200
    assert arrival_response.json()["status"] == "patient_arrived"

    completion_response = client.post(
        f"/referrals/{referral['id']}/status",
        json={
            "status": "service_completed",
            "updated_by": "facility-demo",
            "note": "Synthetic completion",
        },
    )
    assert completion_response.status_code == 200
    completed = completion_response.json()
    assert completed["status"] == "service_completed"
    assert len(completed["events"]) == 4


def test_referral_cannot_skip_approval_or_arrival(client: TestClient) -> None:
    patient = client.post("/patients", json={"full_name": "Synthetic Patient"}).json()
    referral = client.post(
        f"/patients/{patient['id']}/referrals",
        json={
            "requested_service": "Synthetic diagnostic service",
            "reason": "Synthetic evaluation request",
            "requested_by": "worker-demo",
        },
    ).json()

    response = client.post(
        f"/referrals/{referral['id']}/status",
        json={"status": "service_completed", "updated_by": "facility-demo"},
    )

    assert response.status_code == 409
    assert client.get(f"/referrals/{referral['id']}").json()["status"] == "pending_review"


def test_referral_rejects_intake_from_different_patient(client: TestClient) -> None:
    first_patient = client.post("/patients", json={"full_name": "Synthetic Patient One"}).json()
    second_patient = client.post("/patients", json={"full_name": "Synthetic Patient Two"}).json()
    intake = client.post(
        f"/patients/{first_patient['id']}/intakes",
        json={"symptoms": "Synthetic symptom", "confirmed_by_worker": True},
    ).json()

    response = client.post(
        f"/patients/{second_patient['id']}/referrals",
        json={
            "requested_service": "Synthetic diagnostic service",
            "reason": "Synthetic evaluation request",
            "requested_by": "worker-demo",
            "intake_id": intake["id"],
        },
    )

    assert response.status_code == 404
