import uuid

from app.stores import incident_store


def map_condition_to_severity(condition: str) -> str:
    if condition == "serious":
        return "Critical"
    if condition == "moderate":
        return "High"
    return "Medium"


def pick_status_for_incident(index: int) -> str:
    statuses = ["Open", "In Progress", "Scheduled", "Resolved"]
    return statuses[index % len(statuses)]


def infer_ward_from_location(lat: float, lon: float) -> str:
    # Placeholder geocoding logic. Replace with real reverse geocoder in production.
    ward_num = (abs(int(lat * 10_000)) + abs(int(lon * 10_000))) % 20 + 1
    return f"Ward {ward_num:02d}"


def create_incident_from_detection(
    detection: dict,
    road: str,
    ward: str,
    reported_at_ms: int,
    status_value: str | None = None,
) -> dict:
    return {
        "id": f"INC-{uuid.uuid4().hex[:8].upper()}",
        "ward": ward,
        "road": road,
        "severity": map_condition_to_severity(detection["condition"]),
        "status": status_value or pick_status_for_incident(len(incident_store)),
        "reported_at_ms": reported_at_ms,
    }

