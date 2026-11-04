from enum import Enum


class ReportedAvailability(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"


class EffectiveAvailability(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    OUTDATED = "outdated"
    UNKNOWN = "unknown"
