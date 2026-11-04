import os
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload, sessionmaker

from app.database import Base, create_database_engine, get_session
from app.facilities import router as facilities_router
from app.models import IntakeRecord, Patient
from app.referrals import router as referrals_router
from app.schemas import (
    IntakeCreate,
    IntakeResponse,
    PatientCreate,
    PatientDetailResponse,
    PatientResponse,
)


def create_app(database_url: str | None = None) -> FastAPI:
    engine = create_database_engine(
        database_url or os.getenv("DATABASE_URL", "sqlite:///./ruralcare.db")
    )
    session_factory = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        Base.metadata.create_all(bind=engine)
        yield
        engine.dispose()

    app = FastAPI(
        title="RuralCare Connect API",
        description="Prototype API for rural healthcare coordination.",
        version="0.3.0",
        lifespan=lifespan,
    )
    app.state.session_factory = session_factory
    app.include_router(referrals_router)
    app.include_router(facilities_router)

    @app.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    @app.post(
        "/patients",
        response_model=PatientResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["patients"],
    )
    def create_patient(
        patient_data: PatientCreate,
        session: Annotated[Session, Depends(get_session)],
    ) -> Patient:
        patient = Patient(**patient_data.model_dump())
        session.add(patient)
        session.commit()
        session.refresh(patient)
        return patient

    @app.get("/patients", response_model=list[PatientResponse], tags=["patients"])
    def list_patients(
        session: Annotated[Session, Depends(get_session)],
        offset: Annotated[int, Query(ge=0)] = 0,
        limit: Annotated[int, Query(ge=1, le=100)] = 50,
    ) -> list[Patient]:
        statement = select(Patient).order_by(Patient.created_at.desc()).offset(offset).limit(limit)
        return list(session.scalars(statement).all())

    @app.get(
        "/patients/{patient_id}",
        response_model=PatientDetailResponse,
        tags=["patients"],
    )
    def get_patient(
        patient_id: UUID,
        session: Annotated[Session, Depends(get_session)],
    ) -> Patient:
        statement = (
            select(Patient)
            .options(selectinload(Patient.intakes))
            .where(Patient.id == str(patient_id))
        )
        patient = session.scalar(statement)
        if patient is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
        return patient

    @app.post(
        "/patients/{patient_id}/intakes",
        response_model=IntakeResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["intakes"],
    )
    def create_intake(
        patient_id: UUID,
        intake_data: IntakeCreate,
        session: Annotated[Session, Depends(get_session)],
    ) -> IntakeRecord:
        patient = session.get(Patient, str(patient_id))
        if patient is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

        intake = IntakeRecord(patient_id=str(patient_id), **intake_data.model_dump())
        session.add(intake)
        session.commit()
        session.refresh(intake)
        return intake

    return app


app = create_app()
