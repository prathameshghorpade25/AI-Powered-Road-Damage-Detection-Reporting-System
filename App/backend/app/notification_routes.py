"""Notification API for citizen notifications."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_api_key
from app.notification_service import (
    get_notifications_for_device,
    get_unread_count,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    report_id: str
    device_id: str
    type: str
    title: str
    message: str
    created_at_ms: int
    read: bool


class NotificationListResponse(BaseModel):
    notifications: list[dict[str, Any]]
    unread_count: int


@router.get("", dependencies=[Depends(require_api_key)])
async def list_notifications(device_id: str) -> NotificationListResponse:
    """Get all notifications for a device."""
    notifications = await get_notifications_for_device(device_id)
    unread_count = await get_unread_count(device_id)
    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read", dependencies=[Depends(require_api_key)])
async def mark_read(notification_id: str) -> dict[str, Any]:
    """Mark a notification as read."""
    notification = await mark_notification_read(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="notification_not_found")
    return notification


@router.post("/read-all", dependencies=[Depends(require_api_key)])
async def mark_all_read(device_id: str) -> dict[str, Any]:
    """Mark all notifications as read for a device."""
    count = await mark_all_notifications_read(device_id)
    return {"marked_read": count}


@router.get("/unread-count", dependencies=[Depends(require_api_key)])
async def unread_count(device_id: str) -> dict[str, Any]:
    """Get unread notification count for a device."""
    count = await get_unread_count(device_id)
    return {"unread_count": count}