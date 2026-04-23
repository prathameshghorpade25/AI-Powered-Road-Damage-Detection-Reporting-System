from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class ReportLocationIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = None
    address_line: Optional[str] = None
    ward: Optional[str] = None
    zone: Optional[str] = None
    landmark: Optional[str] = None
    manual_address: Optional[str] = None
    location_confirmed: bool = False


class CitizenReportSubmit(BaseModel):
    location: ReportLocationIn
    issue_type: Literal["pothole", "crack", "broken_road", "water_filled", "other"]
    description: Optional[str] = Field(default=None, max_length=2000)
    severity: Literal["minor", "moderate", "severe"]
    hazard_notes: Optional[str] = Field(default=None, max_length=500)
    annotation_image_base64: Optional[str] = None

    submission_mode: Literal["full_name", "anonymous"]
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    allow_followup_contact: bool = False

    consent_service_improvement: bool = False
    consent_followup_contact: bool = False
    consent_genuine: bool = False
    notification_opt_in: bool = False

    locale: Optional[str] = Field(default="en", description="BCP-47 language tag for UX copy")
    device_id: Optional[str] = Field(default=None, max_length=128)
    detection_peak_confidence: Optional[float] = Field(
        default=None,
        ge=0,
        le=1,
        description="Optional YOLO peak confidence from the citizen scan step",
    )

    @model_validator(mode="after")
    def validate_consents_and_contact(self) -> "CitizenReportSubmit":
        if not self.location.location_confirmed:
            raise ValueError("location_not_confirmed")
        if not (self.consent_service_improvement and self.consent_genuine):
            raise ValueError("consent_required")
        if self.allow_followup_contact and not self.consent_followup_contact:
            raise ValueError("followup_consent_required")
        if self.submission_mode == "full_name":
            if not (self.name or "").strip():
                raise ValueError("name_required")
        if self.allow_followup_contact:
            email_ok = bool((self.email or "").strip())
            phone_ok = bool((self.phone or "").strip())
            if not email_ok and not phone_ok:
                raise ValueError("contact_required")
        return self


class GeocodeReverseIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class ReportLocationPreview(BaseModel):
    """Location for draft preview (no confirmation / consent gates)."""

    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = None
    address_line: Optional[str] = None
    ward: Optional[str] = None
    zone: Optional[str] = None
    landmark: Optional[str] = None
    manual_address: Optional[str] = None


class CitizenReportPreview(BaseModel):
    location: ReportLocationPreview
    issue_type: Literal["pothole", "crack", "broken_road", "water_filled", "other"]
    description: Optional[str] = Field(default=None, max_length=2000)
    severity: Literal["minor", "moderate", "severe"]
    hazard_notes: Optional[str] = Field(default=None, max_length=500)

    submission_mode: Literal["full_name", "anonymous"]
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    allow_followup_contact: bool = False
