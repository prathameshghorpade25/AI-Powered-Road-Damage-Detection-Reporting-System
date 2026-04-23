"""Staff / authority API — queue, summary, and workflow updates."""

from __future__ import annotations

import time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import require_api_key
from app.authority_mapping import compute_summary, map_record_to_ops_case
from app.logging_setup import logger
from app.notification_service import create_notification
from app.report_repository import get_report, list_all_reports, update_report
from app.traffic_zone_service import build_traffic_hotspots, build_traffic_zones

router = APIRouter(prefix="/authority", tags=["authority"])

_OPS_STATUSES = frozenset(
    {
        "new",
        "unverified",
        "routed",
        "in_progress",
        "resolved",
        "rejected",
    }
)


class AuthorityReportPatch(BaseModel):
    ops_status: Optional[str] = None
    assigned_to: Optional[str] = Field(default=None, max_length=200)


async def _all_cases(*, include_image_base64: bool = False) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for rec in await list_all_reports():
        rows.append(map_record_to_ops_case(rec, include_image_base64=include_image_base64))
    return rows


@router.get("/meta", dependencies=[Depends(require_api_key)])
async def authority_meta() -> dict[str, Any]:
    cases = await _all_cases(include_image_base64=False)
    wards = sorted({c["ward"] for c in cases if c.get("ward")})
    zones = sorted({c["zone"] for c in cases if c.get("zone")})
    return {"wards": wards, "zones": zones}


@router.get("/summary", dependencies=[Depends(require_api_key)])
async def authority_summary() -> dict[str, Any]:
    cases = await _all_cases(include_image_base64=False)
    s = compute_summary(cases)
    return {"summary": s}


@router.get("/reports", dependencies=[Depends(require_api_key)])
async def authority_list_reports() -> dict[str, Any]:
    cases = await _all_cases(include_image_base64=False)
    cases.sort(
        key=lambda c: (int(c.get("priorityScore") or 0), int(c.get("submittedAtMs") or 0)),
        reverse=True,
    )
    return {"cases": cases, "clusters": []}


@router.get("/traffic-zones", dependencies=[Depends(require_api_key)])
async def authority_traffic_zones() -> dict[str, Any]:
    return {"zones": build_traffic_zones()}


@router.get("/traffic-hotspots", dependencies=[Depends(require_api_key)])
async def authority_traffic_hotspots() -> dict[str, Any]:
    return {"hotspots": build_traffic_hotspots()}


@router.get("/reports/{report_id}", dependencies=[Depends(require_api_key)])
async def authority_get_report(report_id: str) -> dict[str, Any]:
    rec = await get_report(report_id)
    if not rec:
        raise HTTPException(status_code=404, detail="report_not_found")
    return map_record_to_ops_case(rec, include_image_base64=True)


@router.patch("/reports/{report_id}", dependencies=[Depends(require_api_key)])
async def authority_patch_report(report_id: str, body: AuthorityReportPatch) -> dict[str, Any]:
    rec = await get_report(report_id)
    if not rec:
        raise HTTPException(status_code=404, detail="report_not_found")

    now_ms = int(time.time() * 1000)
    updates: dict[str, Any] = {}
    notification_action = None
    
    if body.ops_status is not None:
        st = body.ops_status.strip().lower()
        if st not in _OPS_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"invalid_ops_status: {body.ops_status}",
            )
        updates["ops_status"] = st
        if st == "resolved":
            updates["resolved_at_ms"] = now_ms
        elif st == "rejected":
            updates["resolved_at_ms"] = now_ms
        updates["updated_at_ms"] = now_ms
        logger.info("Authority updated report %s ops_status=%s", report_id, st)
        
        # Map ops_status to notification action
        if st == "routed":
            notification_action = "routed"
        elif st == "in_progress":
            notification_action = "in_progress"
        elif st == "resolved":
            notification_action = "resolved"
        elif st == "rejected":
            notification_action = "rejected"
        elif st == "unverified":
            notification_action = "verified"  # "verified" means marked as verified

    if body.assigned_to is not None:
        updates["assigned_to"] = body.assigned_to.strip() or None
        updates["updated_at_ms"] = now_ms

    updated = await update_report(report_id, updates) if updates else rec
    if not updated:
        raise HTTPException(status_code=404, detail="report_not_found")
    
    # Create notification for the citizen if ops_status changed
    if notification_action and rec.get("device_id"):
        # Get report description from payload
        payload = rec.get("payload", {})
        description = payload.get("description", "")[:50] if payload.get("description") else None
        
        create_notification(
            report_id=report_id,
            device_id=rec["device_id"],
            action=notification_action,
            report_description=description,
        )
        logger.info("Created notification for report %s action=%s", report_id, notification_action)
    
    return map_record_to_ops_case(updated, include_image_base64=True)
