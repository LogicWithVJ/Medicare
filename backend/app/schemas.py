from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.availability_status import EffectiveAvailability, ReportedAvailability
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
    target_facility_id: UUID | None = None


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
    target_facility_id: UUID | None
    requested_service: str
    reason: str
    requested_by: str
    status: ReferralStatus
    created_at: datetime
    updated_at: datetime


class ReferralResponse(ReferralSummaryResponse):
    events: list[ReferralEventResponse]


class FacilityCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    address: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    operating_hours: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def coordinates_must_be_provided_together(self) -> "FacilityCreate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together")
        return self


class FacilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    address: str | None
    latitude: float | None
    longitude: float | None
    operating_hours: str | None
    created_at: datetime


class AvailabilityUpdateCreate(BaseModel):
    service_name: RequiredService
    status: ReportedAvailability
    equipment_status: str | None = Field(default=None, max_length=300)
    updated_by: RequiredName
    note: str | None = Field(default=None, max_length=2000)


class AvailabilityUpdateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    facility_service_id: UUID
    reported_status: ReportedAvailability
    equipment_status: str | None
    updated_by: str
    note: str | None
    created_at: datetime


class FacilityServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    service_name: str
    effective_status: EffectiveAvailability
    latest_reported_status: ReportedAvailability | None
    equipment_status: str | None
    updated_at: datetime | None


class FacilityServiceListResponse(BaseModel):
    facility: FacilityResponse
    services: list[FacilityServiceResponse]


class DiagnosticRecommendationResponse(BaseModel):
    facility_id: UUID
    facility_name: str
    address: str | None
    latitude: float | None
    longitude: float | None
    service_name: str
    effective_status: EffectiveAvailability
    latest_reported_status: ReportedAvailability | None
    equipment_status: str | None
    availability_updated_at: datetime | None
    distance_km: float | None
    reason: str
