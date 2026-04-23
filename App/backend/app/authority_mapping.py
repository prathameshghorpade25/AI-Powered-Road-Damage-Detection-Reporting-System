"""Map stored citizen reports to authority-console DTOs."""

from __future__ import annotations

import time
from typing import Any

from app.traffic_profile import TRAFFIC_LEVEL_RANK, match_traffic_profile

_ISSUE_LABELS: dict[str, str] = {
    "pothole": "Pothole",
    "crack": "Crack",
    "broken_road": "Broken road",
    "water_filled": "Water filled",
    "other": "Other",
}


def issue_type_label(issue_type: str) -> str:
    return _ISSUE_LABELS.get(issue_type, issue_type.replace("_", " ").title())


def sla_hours_for_severity(severity: str) -> int:
    if severity == "severe":
        return 4
    if severity == "moderate":
        return 24
    return 48


def road_type_for_severity(severity: str) -> str:
    if severity == "severe":
        return "Arterial"
    if severity == "moderate":
        return "Collector"
    return "Local"


def infer_zone(payload: dict[str, Any], routing: dict[str, Any]) -> str:
    loc = payload.get("location") or {}
    z = loc.get("zone")
    if isinstance(z, str) and z.strip():
        return z.strip()
    ward = (routing.get("ward") or loc.get("ward") or "Ward 01") or "Ward 01"
    idx = abs(hash(ward)) % 3
    return ("North", "East", "Central")[idx]


def normalize_ops_status(rec: dict[str, Any]) -> str:
    raw = rec.get("ops_status")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    # Legacy: citizen-facing status
    if rec.get("status") == "submitted":
        return "new"
    return "new"


def confidence_from_record(rec: dict[str, Any], payload: dict[str, Any]) -> float:
    v = rec.get("confidence")
    if isinstance(v, (int, float)) and 0 <= float(v) <= 1:
        return float(v)
    v2 = payload.get("detection_peak_confidence")
    if isinstance(v2, (int, float)) and 0 <= float(v2) <= 1:
        return float(v2)
    return 0.55


def _severity_rank(severity: str) -> int:
    return {"minor": 1, "moderate": 2, "severe": 3}.get(severity, 2)


def _priority_band(score: int) -> str:
    if score >= 75:
        return "immediate"
    if score >= 55:
        return "today"
    return "scheduled"


def _priority_reason(
    *,
    severity: str,
    traffic_level: str,
    is_peak_now: bool,
    overdue_ratio: float,
) -> str:
    parts: list[str] = []
    if severity == "severe":
        parts.append("severe surface damage")
    elif severity == "moderate":
        parts.append("moderate road-risk report")
    else:
        parts.append("minor damage report")

    if traffic_level in ("high", "very_high"):
        parts.append(f"{traffic_level.replace('_', ' ')} traffic corridor")
    if is_peak_now:
        parts.append("active peak-hour traffic window")
    if overdue_ratio >= 1:
        parts.append("SLA window exceeded")
    return "Priority drivers: " + ", ".join(parts)


def map_record_to_ops_case(rec: dict[str, Any], *, include_image_base64: bool = False) -> dict[str, Any]:
    payload = rec.get("payload") or {}
    routing = rec.get("routing") or {}
    loc = payload.get("location") or {}
    lat = float(loc.get("lat") or 0)
    lon = float(loc.get("lon") or 0)

    issue_type = str(payload.get("issue_type") or "other")
    severity = str(payload.get("severity") or "moderate")
    if severity not in ("minor", "moderate", "severe"):
        severity = "moderate"

    ward = str(routing.get("ward") or loc.get("ward") or "Unknown ward")
    zone = infer_zone(payload, routing)
    ops_status = normalize_ops_status(rec)
    created_ms = int(rec["created_at_ms"])
    submitted_iso = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(created_ms / 1000))
    now_ms = int(time.time() * 1000)

    submission_mode = payload.get("submission_mode") or "anonymous"
    reporter_type: str = "named" if submission_mode == "full_name" else "anonymous"
    name = (payload.get("name") or "").strip() if reporter_type == "named" else None

    img = rec.get("image") or {}
    image_payload: dict[str, Any] | None = None
    if include_image_base64 and img.get("data_base64"):
        ct = img.get("content_type") or "image/jpeg"
        b64 = img["data_base64"]
        image_payload = {
            "content_type": ct,
            "data_base64": b64,
            "data_url": f"data:{ct};base64,{b64}",
        }
    elif img.get("present"):
        image_payload = {"present": True, "content_type": img.get("content_type")}
    else:
        image_payload = {"present": False}

    traffic = match_traffic_profile(
        location_candidates=[
            str(loc.get("address_line") or ""),
            str(loc.get("manual_address") or ""),
            str(loc.get("landmark") or ""),
            ward,
            zone,
            str(payload.get("description") or ""),
        ]
    ) or {
        "traffic_level": "medium",
        "traffic_location": None,
        "traffic_peak_time": None,
        "is_peak_now": False,
        "match_score": 0.0,
    }

    severity_points = _severity_rank(severity) * 15
    traffic_level = str(traffic["traffic_level"])
    traffic_points = TRAFFIC_LEVEL_RANK.get(traffic_level, 2) * 8
    peak_points = 12 if bool(traffic["is_peak_now"]) else 0
    sla_h = int(rec.get("sla_target_hours") or sla_hours_for_severity(severity))
    age_h = max(0.0, (now_ms - created_ms) / 3600000)
    overdue_ratio = age_h / max(sla_h, 1)
    age_points = min(20, int(overdue_ratio * 12))
    priority_score = min(100, severity_points + traffic_points + peak_points + age_points)
    priority_band = _priority_band(priority_score)
    priority_reason = _priority_reason(
        severity=severity,
        traffic_level=traffic_level,
        is_peak_now=bool(traffic["is_peak_now"]),
        overdue_ratio=overdue_ratio,
    )

    return {
        "id": rec["id"],
        "lat": lat,
        "lon": lon,
        "ward": ward,
        "zone": zone,
        "roadType": road_type_for_severity(severity),
        "issueType": issue_type_label(issue_type),
        "severity": severity,
        "confidence": confidence_from_record(rec, payload),
        "status": ops_status,
        "assignedTo": rec.get("assigned_to"),
        "slaTargetHours": sla_h,
        "submittedAt": submitted_iso,
        "submittedAtMs": created_ms,
        "reporterType": reporter_type,
        "reporterName": name or None,
        "description": (payload.get("description") or "").strip() or "(No description)",
        "duplicateClusterId": None,
        "duplicateIndex": 0,
        "priorityReason": rec.get("priority_reason") or priority_reason,
        "priorityScore": priority_score,
        "priorityBand": priority_band,
        "trafficLevel": traffic_level,
        "trafficHotspot": traffic.get("traffic_location"),
        "trafficPeakTime": traffic.get("traffic_peak_time"),
        "peakTrafficNow": bool(traffic["is_peak_now"]),
        "trafficMatchScore": float(traffic["match_score"]),
        "image": image_payload,
        "authorityMessage": rec.get("authority_message") or "",
        "deviceId": rec.get("device_id"),
        "updatedAtMs": rec.get("updated_at_ms") or rec["created_at_ms"],
        "resolvedAtMs": rec.get("resolved_at_ms"),
    }


def compute_summary(cases: list[dict[str, Any]]) -> dict[str, Any]:
    now_ms = int(time.time() * 1000)
    start_of_day_ms = now_ms - (now_ms % 86400000)  # UTC day boundary (approximation for demo)

    new_reports = 0
    high_priority = 0
    in_progress = 0
    resolved_today = 0
    overdue = 0
    high_traffic_open = 0
    peak_hour_critical = 0
    immediate_dispatch = 0

    for c in cases:
        st = str(c.get("status") or "new").lower()
        sev = str(c.get("severity") or "moderate").lower()
        traffic_level = str(c.get("trafficLevel") or "medium").lower()
        if st in ("new", "unverified", "routed"):
            new_reports += 1
        if sev == "severe" and st not in ("resolved", "rejected"):
            high_priority += 1
        if st == "in_progress":
            in_progress += 1
        if st == "resolved":
            ram = c.get("resolvedAtMs")
            if isinstance(ram, int) and ram >= start_of_day_ms:
                resolved_today += 1
        sla_h = int(c.get("slaTargetHours") or 24)
        submitted_ms = c.get("submittedAtMs")
        if not isinstance(submitted_ms, int):
            continue
        deadline_ms = submitted_ms + sla_h * 3600000
        if st not in ("resolved", "rejected") and now_ms > deadline_ms:
            overdue += 1
        if st not in ("resolved", "rejected") and traffic_level in ("high", "very_high"):
            high_traffic_open += 1
        if st not in ("resolved", "rejected") and sev == "severe" and bool(c.get("peakTrafficNow")):
            peak_hour_critical += 1
        if st not in ("resolved", "rejected") and str(c.get("priorityBand")) == "immediate":
            immediate_dispatch += 1

    avg_response = 0.0
    resolved_with_times = [
        c
        for c in cases
        if str(c.get("status") or "").lower() == "resolved"
        and isinstance(c.get("submittedAtMs"), int)
        and isinstance(c.get("resolvedAtMs"), int)
    ]
    if resolved_with_times:
        total_h = sum(
            max(0.0, (c["resolvedAtMs"] - c["submittedAtMs"]) / 3600000) for c in resolved_with_times
        )
        avg_response = round(total_h / len(resolved_with_times), 1)

    sla_alerts = min(overdue, 99)

    return {
        "newReports": new_reports,
        "highPriority": high_priority,
        "inProgress": in_progress,
        "resolvedToday": resolved_today,
        "overdue": overdue,
        "avgResponseHours": avg_response,
        "slaAlerts": sla_alerts,
        "highTrafficOpen": high_traffic_open,
        "peakHourCritical": peak_hour_critical,
        "immediateDispatch": immediate_dispatch,
    }
