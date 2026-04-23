from __future__ import annotations

from typing import Any

from app.db import reports_collection, users_collection
from app.stores import citizen_report_store


def _strip_mongo_id(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


async def save_report(record: dict[str, Any]) -> None:
    col = reports_collection()
    if col is None:
        citizen_report_store[record["id"]] = record
        return
    await col.replace_one({"id": record["id"]}, record, upsert=True)


async def get_report(report_id: str) -> dict[str, Any] | None:
    col = reports_collection()
    if col is None:
        return citizen_report_store.get(report_id)
    doc = await col.find_one({"id": report_id})
    return _strip_mongo_id(doc)


async def list_reports_for_device(device_id: str, limit: int) -> list[dict[str, Any]]:
    col = reports_collection()
    if col is None:
        rows = [r for r in citizen_report_store.values() if r.get("device_id") == device_id]
        rows.sort(key=lambda x: int(x.get("created_at_ms", 0)), reverse=True)
        return rows[:limit]
    cursor = col.find({"device_id": device_id}).sort("created_at_ms", -1).limit(limit)
    return [_strip_mongo_id(doc) for doc in await cursor.to_list(length=limit) if doc]


async def list_all_reports(limit: int | None = None) -> list[dict[str, Any]]:
    col = reports_collection()
    if col is None:
        rows = sorted(
            citizen_report_store.values(),
            key=lambda x: int(x.get("created_at_ms", 0)),
            reverse=True,
        )
        return rows if limit is None else rows[:limit]
    q = col.find({}).sort("created_at_ms", -1)
    if limit is not None:
        q = q.limit(limit)
    length = limit if limit is not None else 5000
    return [_strip_mongo_id(doc) for doc in await q.to_list(length=length) if doc]


async def update_report(report_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    col = reports_collection()
    if col is None:
        rec = citizen_report_store.get(report_id)
        if not rec:
            return None
        rec.update(fields)
        citizen_report_store[report_id] = rec
        return rec
    await col.update_one({"id": report_id}, {"$set": fields})
    return await get_report(report_id)


async def upsert_user_profile_from_payload(
    *,
    payload: dict[str, Any],
    device_id: str | None,
    report_id: str,
    created_at_ms: int,
) -> None:
    ucol = users_collection()
    if ucol is None:
        return

    key = {}
    if device_id:
        key["device_id"] = device_id
    elif payload.get("email"):
        key["email"] = payload.get("email")
    elif payload.get("phone"):
        key["phone"] = payload.get("phone")
    else:
        return

    update: dict[str, Any] = {
        "$set": {
            "device_id": device_id,
            "name": payload.get("name"),
            "email": payload.get("email"),
            "phone": payload.get("phone"),
            "allow_followup_contact": bool(payload.get("allow_followup_contact")),
            "submission_mode": payload.get("submission_mode"),
            "locale": payload.get("locale"),
            "last_report_id": report_id,
            "updated_at_ms": created_at_ms,
        },
        "$setOnInsert": {"created_at_ms": created_at_ms},
        "$inc": {"report_count": 1},
    }
    await ucol.update_one(key, update, upsert=True)
