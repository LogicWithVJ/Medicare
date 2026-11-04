# RuralCare Connect

RuralCare Connect is a prototype for coordinating patient intake, doctor-approved referrals, and diagnostic services in settings with intermittent connectivity. It is intended to support health workers and clinical decision-making, not replace them.

## MVP development sequence

1. Establish the backend API and local development workflow.
2. Add patient registration and structured intake using synthetic data.
3. Add doctor review, approved referrals, and referral status tracking.
4. Add facility and diagnostic availability with freshness-aware search.
5. Add the mobile and web clients, then offline synchronization.
6. Evaluate the prototype against documented baselines.

Marathi speech support follows the basic intake workflow so there is a safe manual-entry path first. No clinical information is inferred or saved without worker review and confirmation. Initial development uses synthetic records; any real-world pilot requires appropriate institutional and healthcare-partner approval.

## Initial architecture

- **Backend:** FastAPI (Python), providing REST APIs for the mobile and web clients.
- **Central data store:** PostgreSQL as the project grows to multi-facility use.
- **Offline data store:** SQLite on the mobile device; synchronization is a later MVP step.
- **Clients:** Flutter mobile app and React web dashboard.
- **Maps and analytics:** OpenStreetMap and Plotly where those features are introduced.

The backend currently supports patient registration and worker-confirmed structured intake for synthetic development records. SQLite is the local default; set `DATABASE_URL` to a PostgreSQL connection URL to use PostgreSQL.

## Backend quick start

From `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

For PostgreSQL, set `DATABASE_URL` before starting the API, for example:

```powershell
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/ruralcare"
python -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the generated API documentation, or `http://127.0.0.1:8000/health` to check that the API is running.

Run the backend tests from `backend`:

```powershell
python -m pytest
```

## Current API

- `GET /health` — reports that the API process is responsive; it does not yet check database connectivity.
- `POST /patients` — registers a patient using a minimum set of demographic fields.
- `GET /patients` — lists patients with bounded `offset` and `limit` pagination.
- `GET /patients/{patient_id}` — reads a patient and their saved intake records.
- `POST /patients/{patient_id}/intakes` — saves symptoms, optional duration/history, and requires worker confirmation.

## Safety and privacy status

This prototype stores patient data and is for synthetic records in local development only; it is not ready for clinical use. The intake confirmation field records a client assertion and is not authenticated worker identity or authorization. Authentication, role-based access, consent, encryption, audit logging, retention controls, secure synchronization, and database migrations must be implemented and validated before handling real health information. No ABDM compliance is claimed.
