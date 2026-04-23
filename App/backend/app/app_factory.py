import time

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_api_key
from app.authority_routes import router as authority_router
from app.citizen_routes import router as citizen_router
from app.db import close_db, ensure_indexes, mongo_enabled
from app.detection_service import run_detection
from app.incident_service import create_incident_from_detection, infer_ward_from_location
from app.logging_setup import logger
from app.notification_routes import router as notification_router
from app.stores import incident_store
from app.time_utils import to_relative_time


def create_app() -> FastAPI:
    app = FastAPI(title="YOLO Detection API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(citizen_router)
    app.include_router(authority_router)
    app.include_router(notification_router)

    @app.on_event("startup")
    async def _startup_db() -> None:
        if mongo_enabled():
            await ensure_indexes()

    @app.on_event("shutdown")
    async def _shutdown_db() -> None:
        await close_db()

    @app.post("/detect", dependencies=[Depends(require_api_key)])
    async def detect(file: UploadFile = File(...)):
        try:
            image_bytes = await file.read()
            logger.info(
                "Received file=%s size=%d bytes content_type=%s",
                file.filename,
                len(image_bytes),
                file.content_type,
            )
            detections, elapsed_ms = run_detection(image_bytes)
            logger.info(
                "Completed detection count=%d conf>=0.25 imgsz=640 duration_ms=%.1f",
                len(detections),
                elapsed_ms,
            )

            batch_time_ms = int(time.time() * 1000)
            for idx, det in enumerate(detections):
                incident_store.insert(
                    0,
                    create_incident_from_detection(
                        det,
                        road=f"Detected Segment {((len(incident_store) + idx) % 150) + 1}",
                        ward=f"Ward {((len(incident_store) + idx) % 20) + 1:02d}",
                        reported_at_ms=batch_time_ms,
                    ),
                )
            if len(incident_store) > 500:
                del incident_store[500:]

            return {"detections": detections, "duration_ms": elapsed_ms}
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Detection failed: %s", exc)
            raise HTTPException(status_code=500, detail="inference_failed") from exc

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/dashboard/summary", dependencies=[Depends(require_api_key)])
    async def dashboard_summary():
        total_reports = len(incident_store)
        open_cases = len(
            [item for item in incident_store if item["status"] in {"Open", "In Progress", "Scheduled"}]
        )
        critical = len([item for item in incident_store if item["severity"] == "Critical"])
        resolved = len([item for item in incident_store if item["status"] == "Resolved"])
        sla = 100.0 if total_reports == 0 else max(0.0, min(100.0, (resolved / total_reports) * 100))

        pipeline = {
            "open": len([item for item in incident_store if item["status"] == "Open"]),
            "in_progress": len([item for item in incident_store if item["status"] == "In Progress"]),
            "scheduled": len([item for item in incident_store if item["status"] == "Scheduled"]),
            "resolved_7d": resolved,
        }

        return {
            "kpis": {
                "total_reports_30d": total_reports,
                "open_cases": open_cases,
                "critical_potholes": critical,
                "sla_compliance": round(sla, 1),
            },
            "pipeline": pipeline,
        }

    @app.get("/dashboard/incidents", dependencies=[Depends(require_api_key)])
    async def dashboard_incidents(limit: int = 20):
        safe_limit = max(1, min(limit, 100))
        items = incident_store[:safe_limit]
        return {
            "incidents": [
                {
                    "id": item["id"],
                    "ward": item["ward"],
                    "road": item["road"],
                    "severity": item["severity"],
                    "status": item["status"],
                    "reportedAt": to_relative_time(item["reported_at_ms"]),
                }
                for item in items
            ]
        }

    @app.post("/reports/process", dependencies=[Depends(require_api_key)])
    async def process_report_media(file: UploadFile = File(...), lat: float = 0.0, lon: float = 0.0):
        image_bytes = await file.read()
        detections, duration_ms = run_detection(image_bytes)
        ward = infer_ward_from_location(lat, lon)
        return {
            "detections": detections,
            "duration_ms": duration_ms,
            "geocoded": {"ward": ward, "lat": lat, "lon": lon},
        }

    return app

