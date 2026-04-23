import base64
import json
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from app.agent_service import compose_authority_message
from app.auth import require_api_key
from app.authority_mapping import confidence_from_record, sla_hours_for_severity
from app.authority_routing import route_nearest_authority
from app.geocode_service import reverse_geocode_osm, summarize_nominatim_payload
from app.logging_setup import logger
from app.report_lifecycle import public_lifecycle, summarize_for_list
from app.report_models import CitizenReportPreview, CitizenReportSubmit, GeocodeReverseIn
from app.report_repository import (
    get_report,
    list_reports_for_device,
    save_report,
    upsert_user_profile_from_payload,
)

router = APIRouter(prefix="/citizen", tags=["citizen"])


@router.post("/geocode/reverse", dependencies=[Depends(require_api_key)])
async def geocode_reverse(body: GeocodeReverseIn) -> dict[str, Any]:
    raw = await reverse_geocode_osm(body.lat, body.lon)
    summary = summarize_nominatim_payload(raw)
    routing = route_nearest_authority(body.lat, body.lon)
    summary["ward_hint"] = routing.get("ward")
    return summary


@router.post("/reports/submit", dependencies=[Depends(require_api_key)])
async def submit_citizen_report(
    payload: str = Form(..., description="JSON matching CitizenReportSubmit"),
    image: Optional[UploadFile] = File(default=None),
) -> dict[str, Any]:
    try:
        data = CitizenReportSubmit.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=exc.errors(include_context=False),
        ) from exc

    image_bytes = b""
    if image is not None:
        image_bytes = await image.read()

    routing = route_nearest_authority(data.location.lat, data.location.lon)
    payload_dict = data.model_dump()
    # Strip PII when anonymous
    if data.submission_mode == "anonymous":
        payload_dict["name"] = None
        payload_dict["email"] = None
        payload_dict["phone"] = None

    authority_message = await compose_authority_message(payload_dict, routing)

    report_id = f"RPT-{uuid.uuid4().hex[:10].upper()}"
    created_ms = int(time.time() * 1000)
    sev = str(payload_dict.get("severity") or "moderate")
    conf = confidence_from_record(
        {"confidence": data.detection_peak_confidence},
        payload_dict,
    )
    record = {
        "id": report_id,
        "created_at_ms": created_ms,
        "status": "submitted",
        "device_id": data.device_id,
        "routing": routing,
        "payload": payload_dict,
        "authority_message": authority_message,
        "ops_status": "new",
        "assigned_to": None,
        "sla_target_hours": sla_hours_for_severity(sev if sev in ("minor", "moderate", "severe") else "moderate"),
        "confidence": conf,
        "updated_at_ms": created_ms,
        "resolved_at_ms": None,
        "image": {
            "present": bool(image_bytes),
            "content_type": image.content_type if image else None,
            "size_bytes": len(image_bytes),
            "data_base64": base64.b64encode(image_bytes).decode("ascii") if image_bytes else None,
        },
    }
    await save_report(record)
    await upsert_user_profile_from_payload(
        payload=payload_dict,
        device_id=data.device_id,
        report_id=report_id,
        created_at_ms=created_ms,
    )
    logger.info("Citizen report stored id=%s image_bytes=%d", report_id, len(image_bytes))

    return {
        "report_id": report_id,
        "created_at_ms": created_ms,
        "status": "submitted",
        "routed_to": routing,
        "authority_message": authority_message,
        "tracking_path": f"/citizen/reports/{report_id}",
        "lifecycle": public_lifecycle(created_ms),
    }


@router.get("/reports", dependencies=[Depends(require_api_key)])
async def list_citizen_reports(device_id: str | None = None, limit: int = 50) -> dict[str, Any]:
    """List reports for this device only (privacy). Omitting device_id returns an empty list."""
    if not device_id:
        return {"reports": []}
    safe_limit = max(1, min(limit, 100))
    rows = [summarize_for_list(rec) for rec in await list_reports_for_device(device_id, safe_limit)]
    rows.sort(key=lambda r: r["created_at_ms"], reverse=True)
    return {"reports": rows[:safe_limit]}


@router.get("/reports/{report_id}", dependencies=[Depends(require_api_key)])
async def get_citizen_report(report_id: str) -> dict[str, Any]:
    record = await get_report(report_id)
    if not record:
        raise HTTPException(status_code=404, detail="report_not_found")
    # Omit huge base64 in GET by default — return metadata only
    slim = dict(record)
    if slim.get("image", {}).get("data_base64"):
        slim["image"] = {
            **slim["image"],
            "data_base64": None,
            "redacted": True,
        }
    slim["lifecycle"] = public_lifecycle(record["created_at_ms"])
    return slim


@router.post("/reports/preview-message", dependencies=[Depends(require_api_key)])
async def preview_authority_message(body: CitizenReportPreview) -> dict[str, str]:
    """Compose the routed message without persisting (for review modals)."""
    routing = route_nearest_authority(body.location.lat, body.location.lon)
    payload_dict = body.model_dump()
    payload_dict["consent_service_improvement"] = True
    payload_dict["consent_followup_contact"] = bool(body.allow_followup_contact)
    payload_dict["consent_genuine"] = True
    payload_dict["location_confirmed"] = True
    if body.submission_mode == "anonymous":
        payload_dict["name"] = None
        payload_dict["email"] = None
        payload_dict["phone"] = None
    text = await compose_authority_message(payload_dict, routing)
    return {"authority_message": text, "routed_to_summary": json.dumps(routing, ensure_ascii=False)}
