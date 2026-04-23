import time
from io import BytesIO
from typing import List, Optional

import torch
from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO

from app.config import DISABLE_MODEL_LOAD, MODEL_PATH, YOLO_CONF, YOLO_DEVICE, YOLO_IMGSZ, YOLO_IOU, YOLO_MAXDET
from app.logging_setup import logger


def is_pothole_class(raw_name: str) -> bool:
    name = raw_name.strip().lower()
    return name in {"0", "pothole", "potholes"}


def classify_pothole_condition(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    image_width: int,
    image_height: int,
    confidence: float,
) -> str:
    """Estimate pothole condition using box area + confidence."""
    box_width = max(0.0, x2 - x1)
    box_height = max(0.0, y2 - y1)
    image_area = max(1.0, float(image_width * image_height))
    area_ratio = (box_width * box_height) / image_area

    # Stricter defaults:
    # - serious: only larger, high-confidence detections
    # - moderate: medium area, or smaller high-confidence detections
    # - minor: remaining detections
    if area_ratio >= 0.045 and confidence >= 0.55:
        return "serious"
    if area_ratio >= 0.022:
        return "moderate"
    if area_ratio >= 0.014 and confidence >= 0.70:
        return "moderate"
    return "minor"


def select_device() -> str:
    if torch.cuda.is_available():
        return YOLO_DEVICE
    logger.warning("CUDA not available; falling back to CPU.")
    return "cpu"


def load_model() -> YOLO:
    device = select_device()
    try:
        yolo_model = YOLO(MODEL_PATH)
        yolo_model.to(device)
        logger.info("Loaded model=%s on device=%s", MODEL_PATH, device)
        return yolo_model
    except Exception as exc:  # noqa: BLE001
        logger.exception("Model load failed: %s", exc)
        raise


_model: Optional[YOLO] = None


def get_model() -> YOLO:
    global _model
    if DISABLE_MODEL_LOAD:
        raise RuntimeError("Model loading disabled (DISABLE_MODEL_LOAD=1).")
    if _model is None:
        _model = load_model()
    return _model


def set_model_for_tests(model: YOLO) -> None:
    """Allow tests to inject a lightweight stub model."""
    global _model
    _model = model

def _predict_on_image(model: YOLO, image: Image.Image) -> list[dict]:
    results = model.predict(
        image,
        imgsz=YOLO_IMGSZ,
        conf=YOLO_CONF,
        iou=YOLO_IOU,
        max_det=YOLO_MAXDET,
        verbose=False,
    )
    detections: List[dict] = []
    if not results:
        return detections
    result = results[0]
    w, h = image.size
    for box in result.boxes:
        class_name = str(result.names[int(box.cls)])
        if not is_pothole_class(class_name):
            continue
        coords = box.xyxy[0]
        if hasattr(coords, "tolist"):
            coords = coords.tolist()
        x1, y1, x2, y2 = list(coords)
        condition = classify_pothole_condition(
            x1,
            y1,
            x2,
            y2,
            image_width=w,
            image_height=h,
            confidence=float(box.conf),
        )
        detections.append(
            {
                "label": "pothole",
                "condition": condition,
                "confidence": float(box.conf),
                "box": [x1, y1, x2, y2],
            }
        )
    return detections

def run_detection(image_bytes: bytes) -> tuple[list[dict], float]:
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty_file")

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except UnidentifiedImageError as exc:
        logger.warning("Invalid image upload: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_image") from exc

    started = time.perf_counter()

    model = get_model()
    detections = _predict_on_image(model, image)

    elapsed_ms = (time.perf_counter() - started) * 1000
    return detections, elapsed_ms

