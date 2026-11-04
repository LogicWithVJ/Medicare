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

The backend currently supports patient registration, worker-confirmed structured intake, doctor-reviewed referrals, and facility diagnostic-availability coordination for synthetic development records. SQLite is the local default; set `DATABASE_URL` to a PostgreSQL connection URL to use PostgreSQL.

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
- `POST /patients/{patient_id}/referrals` — creates a referral request in `pending_review` state.
- `GET /referrals` — lists referrals, optionally filtered by patient or status.
- `GET /referrals/{referral_id}` — reads a referral and its status history.
- `POST /referrals/{referral_id}/review` — records a doctor approval or rejection.
- `POST /referrals/{referral_id}/status` — records arrival, service completion, or cancellation when the transition is valid.
- `POST /facilities` — registers a participating facility and optional coordinates/hours.
- `GET /facilities` — lists facilities with bounded pagination.
- `POST /facilities/{facility_id}/services/availability` — registers or updates a facility service and records the reporting staff label and server timestamp.
- `GET /facilities/{facility_id}/services` — returns service status as `available`, `unavailable`, `outdated`, or `unknown`; freshness defaults to 24 hours and can be varied for evaluation. An explicit `unknown` report remains unknown; stale available/unavailable reports become outdated.
- `GET /facilities/{facility_id}/services/{facility_service_id}/availability-history` — returns timestamped availability updates with bounded pagination.
- `GET /diagnostics/recommendations?service=...` — ranks matching facilities by effective availability, then distance when an origin and facility coordinates are available; each result explains its status.

An approved referral can include `target_facility_id`; the facility must have the requested service registered. This selection does not itself verify current availability, which must be reviewed from the freshness-aware result.

## Web dashboard

The React + TypeScript dashboard provides a doctor referral queue with review actions, referral status tracking, patient intake views, facility registration, availability updates/history, and freshness-aware service recommendations. It uses synthetic demo labels; authentication and role-based permissions are not implemented.

In a second terminal, from `web`:

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:5173`. Start the backend separately using the steps above. Set `VITE_API_URL` in `web/.env.local` if the backend is not at `http://127.0.0.1:8000`. For a deployed frontend, configure the backend's `CORS_ORIGINS` environment variable with the exact web origin.

Build and lint the dashboard from `web`:

```powershell
npm run build
npm run lint
```

## Safety and privacy status

This prototype stores patient data and is for synthetic records in local development only; it is not ready for clinical use. Facility availability reports are staff-entered claims, not independently verified. Outdated or unknown availability is never presented as confirmed. Worker confirmation and referral actor fields record client assertions and are not authenticated identity or authorization. Authentication, role-based access, consent, encryption, tamper-resistant audit logging, retention controls, secure synchronization, and database migrations must be implemented and validated before handling real health information. No ABDM compliance is claimed.
