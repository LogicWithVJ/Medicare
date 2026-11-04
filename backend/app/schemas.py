from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.referral_status import ReferralStatus

RequiredName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
RequiredService = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
RequiredReason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class PatientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    date_of_birth: date | None = None
    village: str | None = Field(default=None, max_length=120)

    @field_validator("full_name")
    @classmethod
    def full_name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Full name cannot be blank")
        return value


class IntakeCreate(BaseModel):
    symptoms: str = Field(min_length=1, max_length=4000)
    duration: str | None = Field(default=None, max_length=120)
    relevant_history: str | None = Field(default=None, max_length=4000)
    confirmed_by_worker: Literal[True]

    @field_validator("symptoms")
    @classmethod
    def symptoms_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Symptoms cannot be blank")
        return value


class IntakeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    symptoms: str
    duration: str | None
    relevant_history: str | None
    confirmed_by_worker: bool
    created_at: datetime


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    date_of_birth: date | None
    village: str | None
    created_at: datetime


class PatientDetailResponse(PatientResponse):
    intakes: list[IntakeResponse]


class ReferralCreate(BaseModel):
    requested_service: RequiredService
    reason: RequiredReason
    requested_by: RequiredName
    intake_id: UUID | None = None


class ReferralReview(BaseModel):
    decision: Literal["approved", "rejected"]
    reviewed_by: RequiredName
    note: str | None = Field(default=None, max_length=2000)


class ReferralStatusUpdate(BaseModel):
    status: Literal["patient_arrived", "service_completed", "cancelled"]
    updated_by: RequiredName
    note: str | None = Field(default=None, max_length=2000)


class ReferralEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    referral_id: UUID
    from_status: ReferralStatus | None
    to_status: ReferralStatus
    actor: str
    note: str | None
    created_at: datetime


class ReferralSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    intake_id: UUID | None
    requested_service: str
    reason: str
    requested_by: str
    status: ReferralStatus
    created_at: datetime
    updated_at: datetime


class ReferralResponse(ReferralSummaryResponse):
    events: list[ReferralEventResponse]
