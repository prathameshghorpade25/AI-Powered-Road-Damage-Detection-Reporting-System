from __future__ import annotations

from typing import Any

from app.config import MONGODB_DB_NAME, MONGODB_URI
from app.logging_setup import logger

try:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
except Exception:  # pragma: no cover - import guard for constrained environments
    AsyncIOMotorClient = None  # type: ignore[assignment]
    AsyncIOMotorCollection = Any  # type: ignore[misc,assignment]
    AsyncIOMotorDatabase = Any  # type: ignore[misc,assignment]


_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def mongo_enabled() -> bool:
    return bool(MONGODB_URI and AsyncIOMotorClient is not None)


def get_db() -> AsyncIOMotorDatabase | None:
    global _client, _db
    if not mongo_enabled():
        return None
    if _db is None:
        _client = AsyncIOMotorClient(MONGODB_URI, appname="pothole-reporting-api")
        _db = _client[MONGODB_DB_NAME]
        logger.info("MongoDB enabled db=%s", MONGODB_DB_NAME)
    return _db


def reports_collection() -> AsyncIOMotorCollection | None:
    db = get_db()
    return None if db is None else db["citizen_reports"]


def users_collection() -> AsyncIOMotorCollection | None:
    db = get_db()
    return None if db is None else db["citizen_users"]


async def ensure_indexes() -> None:
    col = reports_collection()
    if col is None:
        return
    await col.create_index("id", unique=True)
    await col.create_index([("device_id", 1), ("created_at_ms", -1)])
    await col.create_index([("ops_status", 1), ("created_at_ms", -1)])
    ucol = users_collection()
    if ucol is not None:
        await ucol.create_index("device_id", unique=True, sparse=True)
        await ucol.create_index("email", sparse=True)
        await ucol.create_index("phone", sparse=True)


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
