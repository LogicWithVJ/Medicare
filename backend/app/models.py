from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.referral_status import ReferralStatus


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    village: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    intakes: Mapped[list["IntakeRecord"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="IntakeRecord.created_at",
    )
    referrals: Mapped[list["Referral"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="Referral.created_at",
    )


class IntakeRecord(Base):
    __tablename__ = "intake_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    symptoms: Mapped[str] = mapped_column(Text, nullable=False)
    duration: Mapped[str | None] = mapped_column(String(120), nullable=True)
    relevant_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed_by_worker: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    patient: Mapped[Patient] = relationship(back_populates="intakes")
    referrals: Mapped[list["Referral"]] = relationship(back_populates="intake")


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    intake_id: Mapped[str | None] = mapped_column(
        ForeignKey("intake_records.id"),
        nullable=True,
        index=True,
    )
    requested_service: Mapped[str] = mapped_column(String(120), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[ReferralStatus] = mapped_column(
        SqlEnum(
            ReferralStatus,
            native_enum=False,
            values_callable=lambda enum_type: [item.value for item in enum_type],
            length=32,
        ),
        nullable=False,
        default=ReferralStatus.PENDING_REVIEW,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    patient: Mapped[Patient] = relationship(back_populates="referrals")
    intake: Mapped[IntakeRecord | None] = relationship(back_populates="referrals")
    events: Mapped[list["ReferralEvent"]] = relationship(
        back_populates="referral",
        cascade="all, delete-orphan",
        order_by="ReferralEvent.created_at",
    )


class ReferralEvent(Base):
    __tablename__ = "referral_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    referral_id: Mapped[str] = mapped_column(ForeignKey("referrals.id"), nullable=False, index=True)
    from_status: Mapped[ReferralStatus | None] = mapped_column(
        SqlEnum(
            ReferralStatus,
            native_enum=False,
            values_callable=lambda enum_type: [item.value for item in enum_type],
            length=32,
        ),
        nullable=True,
    )
    to_status: Mapped[ReferralStatus] = mapped_column(
        SqlEnum(
            ReferralStatus,
            native_enum=False,
            values_callable=lambda enum_type: [item.value for item in enum_type],
            length=32,
        ),
        nullable=False,
    )
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    referral: Mapped[Referral] = relationship(back_populates="events")
