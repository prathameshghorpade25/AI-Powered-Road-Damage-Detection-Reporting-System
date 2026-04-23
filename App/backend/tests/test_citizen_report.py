import json
import os

from fastapi.testclient import TestClient


def _auth_headers() -> dict:
    key = os.getenv("API_KEY", "")
    return {"x-api-key": key} if key else {}


def test_citizen_submit_validation_fails_without_consent(client: TestClient):
    payload = {
        "location": {
            "lat": 12.97,
            "lon": 77.59,
            "location_confirmed": True,
            "address_line": "Test Rd",
        },
        "issue_type": "pothole",
        "description": "Test",
        "severity": "moderate",
        "submission_mode": "anonymous",
        "allow_followup_contact": False,
        "consent_service_improvement": False,
        "consent_followup_contact": False,
        "consent_genuine": False,
    }
    res = client.post(
        "/citizen/reports/submit",
        data={"payload": json.dumps(payload)},
        headers=_auth_headers(),
    )
    assert res.status_code == 422


def test_citizen_submit_stores_report(client: TestClient):
    payload = {
        "location": {
            "lat": 12.97,
            "lon": 77.59,
            "accuracy_m": 12.0,
            "address_line": "MG Road",
            "ward": "Ward 05",
            "landmark": "Near metro",
            "location_confirmed": True,
        },
        "issue_type": "pothole",
        "description": "Large pothole after rain.",
        "severity": "severe",
        "hazard_notes": "",
        "submission_mode": "anonymous",
        "allow_followup_contact": False,
        "consent_service_improvement": True,
        "consent_followup_contact": False,
        "consent_genuine": True,
        "notification_opt_in": False,
        "device_id": "device-unit-test-1",
    }
    res = client.post(
        "/citizen/reports/submit",
        data={"payload": json.dumps(payload)},
        files={"image": ("road.jpg", b"\xff\xd8\xff", "image/jpeg")},
        headers=_auth_headers(),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["report_id"].startswith("RPT-")
    assert "authority_message" in data
    rid = data["report_id"]
    get_res = client.get(f"/citizen/reports/{rid}", headers=_auth_headers())
    assert get_res.status_code == 200
    assert get_res.json()["id"] == rid
    assert "lifecycle" in get_res.json()

    list_res = client.get(
        "/citizen/reports",
        params={"device_id": "device-unit-test-1"},
        headers=_auth_headers(),
    )
    assert list_res.status_code == 200
    listed = list_res.json()["reports"]
    assert any(r["id"] == rid for r in listed)

    empty = client.get("/citizen/reports", headers=_auth_headers())
    assert empty.json()["reports"] == []
