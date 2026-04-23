import json
import os

from fastapi.testclient import TestClient


def _auth_headers() -> dict:
    key = os.getenv("API_KEY", "")
    return {"x-api-key": key} if key else {}


def _submit_minimal(client: TestClient) -> str:
    payload = {
        "location": {
            "lat": 12.97,
            "lon": 77.59,
            "location_confirmed": True,
            "address_line": "Test Rd",
        },
        "issue_type": "pothole",
        "description": "Hole",
        "severity": "moderate",
        "submission_mode": "anonymous",
        "allow_followup_contact": False,
        "consent_service_improvement": True,
        "consent_followup_contact": False,
        "consent_genuine": True,
        "notification_opt_in": False,
        "device_id": "auth-test-device",
        "detection_peak_confidence": 0.72,
    }
    res = client.post(
        "/citizen/reports/submit",
        data={"payload": json.dumps(payload)},
        headers=_auth_headers(),
    )
    assert res.status_code == 200
    return res.json()["report_id"]


def test_authority_lists_submitted_report(client: TestClient):
    rid = _submit_minimal(client)
    res = client.get("/authority/reports", headers=_auth_headers())
    assert res.status_code == 200
    cases = res.json()["cases"]
    assert any(c["id"] == rid for c in cases)
    match = next(c for c in cases if c["id"] == rid)
    assert match["status"] == "new"
    assert match["severity"] == "moderate"


def test_authority_patch_status(client: TestClient):
    rid = _submit_minimal(client)
    res = client.patch(
        f"/authority/reports/{rid}",
        json={"ops_status": "in_progress"},
        headers=_auth_headers(),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "in_progress"

    listed = client.get("/authority/reports", headers=_auth_headers()).json()["cases"]
    m = next(c for c in listed if c["id"] == rid)
    assert m["status"] == "in_progress"
