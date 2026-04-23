from typing import List, Optional

from pydantic import BaseModel, Field


class Location(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None


class DetectionPayload(BaseModel):
    label: str
    confidence: float
    box: List[float] = Field(..., min_length=4, max_length=4)  # [x1, y1, x2, y2]
    condition: Optional[str] = None


class CreateReportRequest(BaseModel):
    image_base64: str
    location: Location
    client_timestamp: Optional[str] = None
    image_name: Optional[str] = None

