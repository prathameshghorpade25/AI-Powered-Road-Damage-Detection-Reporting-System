from typing import Any

import httpx

from app.config import NOMINATIM_BASE, NOMINATIM_USER_AGENT
from app.logging_setup import logger


async def reverse_geocode_osm(lat: float, lon: float) -> dict[str, Any]:
    """Reverse geocode via Nominatim. Respect usage policy: cache, rate-limit in production."""
    url = f"{NOMINATIM_BASE}/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1,
        "zoom": 18,
    }
    headers = {"User-Agent": NOMINATIM_USER_AGENT}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Nominatim reverse failed: %s", exc)
        raise


def summarize_nominatim_payload(data: dict) -> dict:
    addr = data.get("address") or {}
    road = addr.get("road") or addr.get("pedestrian") or addr.get("path")
    suburb = addr.get("suburb") or addr.get("neighbourhood") or addr.get("quarter")
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
    state = addr.get("state")
    postcode = addr.get("postcode")
    parts = [p for p in [road, suburb, city, state, postcode] if p]
    line = ", ".join(parts) if parts else (data.get("display_name") or "")

    landmarks: list[str] = []
    if road:
        landmarks.append(f"Near {road}")
    if suburb:
        landmarks.append(f"{suburb} area")
    amenity = addr.get("amenity")
    if amenity:
        landmarks.append(str(amenity))

    return {
        "display_name": data.get("display_name"),
        "address_line": line or None,
        "road": road,
        "suburb": suburb,
        "city": city,
        "state": state,
        "postcode": postcode,
        "suggested_landmarks": landmarks[:5],
        "raw_address": addr,
    }
