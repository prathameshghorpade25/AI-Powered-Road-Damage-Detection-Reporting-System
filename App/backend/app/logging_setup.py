import logging

from app.config import LOG_LEVEL


logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("yolo_pothole_detection")

