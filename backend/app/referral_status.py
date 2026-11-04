from enum import Enum


class ReferralStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PATIENT_ARRIVED = "patient_arrived"
    SERVICE_COMPLETED = "service_completed"
    CANCELLED = "cancelled"
