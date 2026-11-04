import math
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.availability_status import EffectiveAvailability, ReportedAvailability
from app.database import get_session
from app.models import AvailabilityUpdate, Facility, FacilityService
from app.schemas import (
    AvailabilityUpdateCreate,
    AvailabilityUpdateResponse,
    DiagnosticRecommendationResponse,
    FacilityCreate,
    FacilityResponse,
    FacilityServiceListResponse,
    FacilityServiceResponse,
)

router = APIRouter(tags=["facilities"])


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _latest_update(facility_service: FacilityService) -> AvailabilityUpdate | None:
    if not facility_service.availability_updates:
        return None
    return facility_service.availability_updates[-1]


def _effective_status(
    update: AvailabilityUpdate | None,
    now: datetime,
    freshness: timedelta,
) -> EffectiveAvailability:
    if update is None or update.reported_status == ReportedAvailability.UNKNOWN:
        return EffectiveAvailability.UNKNOWN
    if now - _utc(update.created_at) > freshness:
        return EffectiveAvailability.OUTDATED
    return EffectiveAvailability(update.reported_status.value)


def _distance_km(
    origin_latitude: float,
    origin_longitude: float,
    target_latitude: float,
    target_longitude: float,
) -> float:
    earth_radius_km = 6371.0
    lat1, lat2 = math.radians(origin_latitude), math.radians(target_latitude)
    delta_lat = lat2 - lat1
    delta_lon = math.radians(target_longitude - origin_longitude)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(haversine))


def _facility_service_response(
    facility_service: FacilityService,
    now: datetime,
    freshness: timedelta,
) -> FacilityServiceResponse:
    update = _latest_update(facility_service)
    return FacilityServiceResponse(
        id=facility_service.id,
        service_name=facility_service.service_name,
        effective_status=_effective_status(update, now, freshness),
        latest_reported_status=update.reported_status if update else None,
        equipment_status=update.equipment_status if update else None,
        updated_at=update.created_at if update else None,
    )


@router.post(
    "/facilities",
    response_model=FacilityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_facility(
    facility_data: FacilityCreate,
    session: Annotated[Session, Depends(get_session)],
) -> Facility:
    facility = Facility(**facility_data.model_dump())
    session.add(facility)
    session.commit()
    session.refresh(facility)
    return facility


@router.get("/facilities", response_model=list[FacilityResponse])
def list_facilities(
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[Facility]:
    statement = select(Facility).order_by(Facility.name).offset(offset).limit(limit)
    return list(session.scalars(statement).all())


@router.get("/facilities/{facility_id}/services", response_model=FacilityServiceListResponse)
def list_facility_services(
    facility_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    freshness_hours: Annotated[float, Query(ge=0, le=8760)] = 24,
) -> FacilityServiceListResponse:
    statement = (
        select(Facility)
        .options(
            selectinload(Facility.diagnostic_services).selectinload(
                FacilityService.availability_updates
            )
        )
        .where(Facility.id == str(facility_id))
    )
    facility = session.scalar(statement)
    if facility is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    now = datetime.now(timezone.utc)
    freshness = timedelta(hours=freshness_hours)
    services = [
        _facility_service_response(item, now, freshness)
        for item in facility.diagnostic_services
    ]
    return FacilityServiceListResponse(facility=facility, services=services)


@router.post(
    "/facilities/{facility_id}/services/availability",
    response_model=AvailabilityUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
def update_service_availability(
    facility_id: UUID,
    update_data: AvailabilityUpdateCreate,
    session: Annotated[Session, Depends(get_session)],
) -> AvailabilityUpdate:
    facility = session.get(Facility, str(facility_id))
    if facility is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    statement = select(FacilityService).where(
        FacilityService.facility_id == str(facility_id),
        func.lower(FacilityService.service_name) == update_data.service_name.lower(),
    )
    facility_service = session.scalar(statement)
    if facility_service is None:
        facility_service = FacilityService(
            facility_id=str(facility_id),
            service_name=update_data.service_name,
        )
        session.add(facility_service)
        session.flush()

    availability_update = AvailabilityUpdate(
        facility_service_id=facility_service.id,
        reported_status=update_data.status,
        equipment_status=update_data.equipment_status,
        updated_by=update_data.updated_by,
        note=update_data.note,
    )
    session.add(availability_update)
    session.commit()
    session.refresh(availability_update)
    return availability_update


@router.get(
    "/facilities/{facility_id}/services/{facility_service_id}/availability-history",
    response_model=list[AvailabilityUpdateResponse],
)
def list_availability_history(
    facility_id: UUID,
    facility_service_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[AvailabilityUpdate]:
    facility_service = session.scalar(
        select(FacilityService).where(
            FacilityService.id == str(facility_service_id),
            FacilityService.facility_id == str(facility_id),
        )
    )
    if facility_service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnostic service not found for facility",
        )

    statement = (
        select(AvailabilityUpdate)
        .where(AvailabilityUpdate.facility_service_id == str(facility_service_id))
        .order_by(AvailabilityUpdate.created_at.desc(), AvailabilityUpdate.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.scalars(statement).all())


@router.get(
    "/diagnostics/recommendations",
    response_model=list[DiagnosticRecommendationResponse],
)
def recommend_diagnostic_facilities(
    service: Annotated[str, Query(min_length=1, max_length=120)],
    session: Annotated[Session, Depends(get_session)],
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
    freshness_hours: Annotated[float, Query(ge=0, le=8760)] = 24,
) -> list[DiagnosticRecommendationResponse]:
    service = service.strip()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Service name cannot be blank",
        )
    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Latitude and longitude must be provided together",
        )

    statement = (
        select(FacilityService)
        .options(
            selectinload(FacilityService.facility),
            selectinload(FacilityService.availability_updates),
        )
        .where(func.lower(FacilityService.service_name) == service.lower())
    )
    facility_services = session.scalars(statement).all()
    now = datetime.now(timezone.utc)
    freshness = timedelta(hours=freshness_hours)
    recommendations: list[DiagnosticRecommendationResponse] = []

    for facility_service in facility_services:
        facility = facility_service.facility
        update = _latest_update(facility_service)
        effective_status = _effective_status(update, now, freshness)
        distance = None
        if (
            latitude is not None
            and longitude is not None
            and facility.latitude is not None
            and facility.longitude is not None
        ):
            distance = _distance_km(latitude, longitude, facility.latitude, facility.longitude)

        if effective_status == EffectiveAvailability.AVAILABLE and update is not None:
            reason = f"Reported available by facility staff at {_utc(update.created_at).isoformat()}."
        elif effective_status == EffectiveAvailability.UNAVAILABLE and update is not None:
            reason = f"Facility staff reported unavailable at {_utc(update.created_at).isoformat()}."
        elif effective_status == EffectiveAvailability.OUTDATED and update is not None:
            reason = (
                f"The last report was {update.reported_status.value} at "
                f"{_utc(update.created_at).isoformat()}, older than the freshness limit; "
                "availability is outdated and not confirmed."
            )
        else:
            reason = "No availability update is recorded; current availability is unknown."

        if distance is not None:
            reason += f" Straight-line distance from the supplied location is {distance:.1f} km."
        elif latitude is not None:
            reason += " Facility coordinates are not recorded, so distance is unknown."
        else:
            reason += " No origin location was supplied, so distance was not ranked."

        recommendations.append(
            DiagnosticRecommendationResponse(
                facility_id=facility.id,
                facility_name=facility.name,
                address=facility.address,
                latitude=facility.latitude,
                longitude=facility.longitude,
                service_name=facility_service.service_name,
                effective_status=effective_status,
                latest_reported_status=update.reported_status if update else None,
                equipment_status=update.equipment_status if update else None,
                availability_updated_at=update.created_at if update else None,
                distance_km=distance,
                reason=reason,
            )
        )

    status_rank = {
        EffectiveAvailability.AVAILABLE: 0,
        EffectiveAvailability.OUTDATED: 1,
        EffectiveAvailability.UNKNOWN: 2,
        EffectiveAvailability.UNAVAILABLE: 3,
    }
    recommendations.sort(
        key=lambda item: (
            status_rank[item.effective_status],
            item.distance_km if item.distance_km is not None else math.inf,
            item.facility_name.casefold(),
        )
    )
    return recommendations
