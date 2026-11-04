from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_session
from app.models import FacilityService, IntakeRecord, Patient, Referral, ReferralEvent
from app.referral_status import ReferralStatus
from app.schemas import (
    ReferralCreate,
    ReferralResponse,
    ReferralReview,
    ReferralStatusUpdate,
    ReferralSummaryResponse,
)

router = APIRouter(tags=["referrals"])

ALLOWED_TRANSITIONS = {
    ReferralStatus.PENDING_REVIEW: {
        ReferralStatus.APPROVED,
        ReferralStatus.REJECTED,
        ReferralStatus.CANCELLED,
    },
    ReferralStatus.APPROVED: {
        ReferralStatus.PATIENT_ARRIVED,
        ReferralStatus.CANCELLED,
    },
    ReferralStatus.PATIENT_ARRIVED: {
        ReferralStatus.SERVICE_COMPLETED,
        ReferralStatus.CANCELLED,
    },
    ReferralStatus.REJECTED: set(),
    ReferralStatus.SERVICE_COMPLETED: set(),
    ReferralStatus.CANCELLED: set(),
}


def _get_referral(session: Session, referral_id: UUID) -> Referral:
    statement = (
        select(Referral)
        .options(selectinload(Referral.events))
        .where(Referral.id == str(referral_id))
    )
    referral = session.scalar(statement)
    if referral is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")
    return referral


def _change_status(
    session: Session,
    referral: Referral,
    new_status: ReferralStatus,
    actor: str,
    note: str | None,
) -> None:
    if new_status not in ALLOWED_TRANSITIONS[referral.status]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot change referral from {referral.status.value} to {new_status.value}",
        )

    previous_status = referral.status
    referral.status = new_status
    referral.events.append(
        ReferralEvent(
            from_status=previous_status,
            to_status=new_status,
            actor=actor,
            note=note,
        )
    )
    session.commit()


@router.post(
    "/patients/{patient_id}/referrals",
    response_model=ReferralResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_referral(
    patient_id: UUID,
    referral_data: ReferralCreate,
    session: Annotated[Session, Depends(get_session)],
) -> Referral:
    patient = session.get(Patient, str(patient_id))
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    intake_id = str(referral_data.intake_id) if referral_data.intake_id else None
    if intake_id is not None:
        intake = session.get(IntakeRecord, intake_id)
        if intake is None or intake.patient_id != str(patient_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Intake record not found for patient",
            )

    target_facility_id = (
        str(referral_data.target_facility_id) if referral_data.target_facility_id else None
    )
    if target_facility_id is not None:
        service_statement = select(FacilityService).where(
            FacilityService.facility_id == target_facility_id,
            func.lower(FacilityService.service_name)
            == referral_data.requested_service.lower(),
        )
        if session.scalar(service_statement) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested service not registered at target facility",
            )

    referral = Referral(
        patient_id=str(patient_id),
        intake_id=intake_id,
        target_facility_id=target_facility_id,
        requested_service=referral_data.requested_service,
        reason=referral_data.reason,
        requested_by=referral_data.requested_by,
        status=ReferralStatus.PENDING_REVIEW,
    )
    referral.events.append(
        ReferralEvent(
            from_status=None,
            to_status=ReferralStatus.PENDING_REVIEW,
            actor=referral_data.requested_by,
        )
    )
    session.add(referral)
    session.commit()
    session.refresh(referral)
    return referral


@router.get("/referrals", response_model=list[ReferralSummaryResponse])
def list_referrals(
    session: Annotated[Session, Depends(get_session)],
    patient_id: UUID | None = None,
    referral_status: ReferralStatus | None = Query(default=None, alias="status"),
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[Referral]:
    statement = select(Referral).order_by(Referral.created_at.desc())
    if patient_id is not None:
        statement = statement.where(Referral.patient_id == str(patient_id))
    if referral_status is not None:
        statement = statement.where(Referral.status == referral_status)
    statement = statement.offset(offset).limit(limit)
    return list(session.scalars(statement).all())


@router.get("/referrals/{referral_id}", response_model=ReferralResponse)
def get_referral(
    referral_id: UUID,
    session: Annotated[Session, Depends(get_session)],
) -> Referral:
    return _get_referral(session, referral_id)


@router.post("/referrals/{referral_id}/review", response_model=ReferralResponse)
def review_referral(
    referral_id: UUID,
    review: ReferralReview,
    session: Annotated[Session, Depends(get_session)],
) -> Referral:
    referral = _get_referral(session, referral_id)
    _change_status(
        session,
        referral,
        ReferralStatus(review.decision),
        review.reviewed_by,
        review.note,
    )
    return referral


@router.post("/referrals/{referral_id}/status", response_model=ReferralResponse)
def update_referral_status(
    referral_id: UUID,
    update: ReferralStatusUpdate,
    session: Annotated[Session, Depends(get_session)],
) -> Referral:
    referral = _get_referral(session, referral_id)
    _change_status(
        session,
        referral,
        ReferralStatus(update.status),
        update.updated_by,
        update.note,
    )
    return referral
