from app.incident_service import infer_ward_from_location


def route_nearest_authority(lat: float, lon: float) -> dict:
    """Return a plausible municipal routing target (demo — replace with real jurisdiction DB)."""
    ward = infer_ward_from_location(lat, lon)
    return {
        "authority_name": "Municipal Corporation — Roads & Public Works",
        "department": "Road Maintenance & Safety",
        "ward": ward,
        "routing_note": "Reports are routed by GPS coordinates and administrative ward inference.",
    }
