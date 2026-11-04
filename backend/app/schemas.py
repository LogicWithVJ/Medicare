from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
