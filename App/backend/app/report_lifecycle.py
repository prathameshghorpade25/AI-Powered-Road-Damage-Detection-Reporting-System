"""Demo lifecycle overlay for citizen reports — simulates authority progression for UX trust testing."""

import time
from typing import Any


def _age_ms(created_at_ms: int) -> float:
    return max(0.0, time.time() * 1000 - created_at_ms)


def public_lifecycle(created_at_ms: int) -> dict[str, Any]:
    """
    Deterministic demo phases (not real municipal integration).
    Replace with webhook-driven status in production.
    """
    age = _age_ms(created_at_ms)
    if age < 15_000:
        phase = "routing"
        headline = "Routing to nearest authority"
        authority_accepted = False
        resolved = False
    elif age < 90_000:
        phase = "awaiting_ack"
        headline = "Awaiting authority acknowledgment"
        authority_accepted = False
        resolved = False
    elif age < 300_000:
        phase = "acknowledged"
        headline = "Authority acknowledged report"
        authority_accepted = True
        resolved = False
    elif age < 600_000:
        phase = "work_order"
        headline = "Work order in progress"
        authority_accepted = True
        resolved = False
    else:
        phase = "resolved"
        headline = "Issue marked resolved (demo timeline)"
        authority_accepted = True
        resolved = True

    feed = [
        {"ts_offset_ms": 0, "message": "Report received and encrypted at rest"},
        {"ts_offset_ms": 2_000, "message": "Location verified against jurisdiction"},
        {"ts_offset_ms": 5_000, "message": "Routed to roads department inbox"},
    ]
    if age >= 90_000:
        feed.append({"ts_offset_ms": 90_000, "message": "Authority opened the report (demo)"})
    if age >= 300_000:
        feed.append({"ts_offset_ms": 300_000, "message": "Maintenance crew assigned (demo)"})
    if age >= 600_000:
        feed.append({"ts_offset_ms": 600_000, "message": "Closure recorded — verify on site (demo)"})

    return {
        "phase": phase,
        "headline": headline,
        "authority_accepted": authority_accepted,
        "resolved": resolved,
        "age_ms": int(age),
        "automation_feed": feed,
    }


def summarize_for_list(record: dict[str, Any]) -> dict[str, Any]:
    payload = record.get("payload") or {}
    loc = payload.get("location") or {}
    lc = public_lifecycle(record["created_at_ms"])
    routing = record.get("routing") or {}
    return {
        "id": record["id"],
        "created_at_ms": record["created_at_ms"],
        "issue_type": payload.get("issue_type"),
        "severity": payload.get("severity"),
        "location_summary": loc.get("address_line") or loc.get("manual_address") or "GPS on file",
        "ward": routing.get("ward") or loc.get("ward"),
        "routed_to": routing.get("authority_name"),
        "lifecycle": lc,
    }
