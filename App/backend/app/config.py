import os
from pathlib import Path

from dotenv import load_dotenv

# Auto-load backend/.env so local runs don't need --env-file every time.
if os.getenv("DISABLE_DOTENV_LOAD", "0") != "1":
    load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env", override=False)


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
API_KEY = os.getenv("API_KEY")

# Default to the pothole-specific model.
MODEL_PATH = os.getenv(
    "MODEL_PATH",
    "https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/main/best.pt",
)

YOLO_DEVICE = os.getenv("YOLO_DEVICE", "cuda:0")

# Inference tunables (count accuracy is often driven by these).
YOLO_IMGSZ = int(os.getenv("YOLO_IMGSZ", "960"))
YOLO_CONF = float(os.getenv("YOLO_CONF", "0.20"))
YOLO_IOU = float(os.getenv("YOLO_IOU", "0.45"))
YOLO_MAXDET = int(os.getenv("YOLO_MAXDET", "100"))

# Useful for tests/CI to avoid heavyweight model loading on import.
DISABLE_MODEL_LOAD = os.getenv("DISABLE_MODEL_LOAD", "0") == "1"

# Citizen reporting — LLM message drafting (server-side only; never expose to clients).
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")

# MongoDB persistence for citizen + authority workflows.
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "pothole_reporting")

# Nominatim (OpenStreetMap) — set a contact email per usage policy.
NOMINATIM_USER_AGENT = os.getenv("NOMINATIM_USER_AGENT", "PotholeReportApp/1.0 (contact@example.com)")
NOMINATIM_BASE = os.getenv("NOMINATIM_BASE", "https://nominatim.openstreetmap.org").rstrip("/")

