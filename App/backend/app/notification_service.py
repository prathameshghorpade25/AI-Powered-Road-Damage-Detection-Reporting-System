"""Notification service for user notifications when authority takes actions."""

from __future__ import annotations

import time
from typing import Any

from app.stores import notification_store

# Notification types for authority actions
NOTIFICATION_TYPES = frozenset(
    {
        "verified",
        "routed",
        "in_progress",
        "resolved",
        "rejected",
    }
)

# Action to notification message mapping
ACTION_MESSAGES = {
    "verified": "Your report has been verified by the authority.",
    "routed": "Your report has been routed to the appropriate team.",
    "in_progress": "Work has started on your report.",
    "resolved": "Your report has been marked as resolved.",
    "rejected": "Your report has been rejected.",
}


def create_notification(
    *,
    report_id: str,
    device_id: str,
    action: str,
    report_description: str | None = None,
) -> dict[str, Any]:
    """Create a notification for a user when authority takes an action."""
    now_ms = int(time.time() * 1000)
    notification_id = f"NOTIF-{report_id}-{action}-{now_ms}"
    
    message = ACTION_MESSAGES.get(action, f"Status update: {action}")
    if report_description:
        message = f"{message} ({report_description})"
    
    notification = {
        "id": notification_id,
        "report_id": report_id,
        "device_id": device_id,
        "type": action,
        "title": f"Report {action.replace('_', ' ').title()}",
        "message": message,
        "created_at_ms": now_ms,
        "read": False,
    }
    
    notification_store[notification_id] = notification
    return notification


async def get_notifications_for_device(device_id: str) -> list[dict[str, Any]]:
    """Get all notifications for a specific device."""
    notifications = [
        n for n in notification_store.values() 
        if n.get("device_id") == device_id
    ]
    # Sort by created_at_ms descending (newest first)
    notifications.sort(key=lambda x: x.get("created_at_ms", 0), reverse=True)
    return notifications


async def mark_notification_read(notification_id: str) -> dict[str, Any] | None:
    """Mark a notification as read."""
    notification = notification_store.get(notification_id)
    if notification:
        notification["read"] = True
    return notification


async def mark_all_notifications_read(device_id: str) -> int:
    """Mark all notifications for a device as read."""
    count = 0
    for n in notification_store.values():
        if n.get("device_id") == device_id and not n.get("read"):
            n["read"] = True
            count += 1
    return count


async def get_unread_count(device_id: str) -> int:
    """Get count of unread notifications for a device."""
    return sum(
        1 for n in notification_store.values()
        if n.get("device_id") == device_id and not n.get("read")
    )