import json
from typing import Any

import httpx

from app.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
from app.logging_setup import logger


def _fallback_message(payload: dict[str, Any], routing: dict[str, Any]) -> str:
    loc = payload.get("location") or {}
    issue = payload.get("issue_type", "road_damage")
    sev = payload.get("severity", "unknown")
    desc = (payload.get("description") or "").strip()
    hazard = (payload.get("hazard_notes") or "").strip()
    lm = (loc.get("landmark") or "").strip()
    manual = (loc.get("manual_address") or "").strip()
    addr = (loc.get("address_line") or "").strip()
    lines = [
        f"OFFICIAL ROAD CONDITION REPORT — {routing.get('department', 'Public Works')}",
        f"Authority: {routing.get('authority_name', 'Local authority')}",
        f"Ward / zone: {routing.get('ward', 'Unknown')}",
        "",
        f"Location: {addr or manual or 'GPS coordinates on file'}",
        f"Coordinates: {loc.get('lat')}, {loc.get('lon')}",
    ]
    if lm:
        lines.append(f"Landmark reference: {lm}")
    lines += [
        "",
        f"Issue type: {issue.replace('_', ' ')}",
        f"Reported severity: {sev}",
    ]
    if desc:
        lines += ["", f"Observation: {desc}"]
    if hazard:
        lines += ["", f"Hazard notes: {hazard}"]
    lines += [
        "",
        "This report was submitted by a citizen via the municipal reporting channel.",
        "Photo evidence is attached to the electronic record.",
    ]
    return "\n".join(lines)


async def compose_authority_message(payload: dict[str, Any], routing: dict[str, Any]) -> str:
    if not ANTHROPIC_API_KEY:
        return _fallback_message(payload, routing)

    system = (
        "You draft concise, authoritative municipal correspondence. "
        "Write a short message suitable for a roads department inbox. "
        "No markdown. No emojis. Formal but readable. "
        "Include: issue summary, severity, location (address if any + lat/lon), ward, and requested action. "
        "Do not invent facts not in the JSON. Max ~180 words."
    )
    user_content = json.dumps({"report": payload, "routing": routing}, ensure_ascii=False)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": ANTHROPIC_MODEL,
                    "max_tokens": 512,
                    "system": system,
                    "messages": [{"role": "user", "content": user_content}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("content") or []
            if parts and isinstance(parts[0], dict) and parts[0].get("text"):
                return str(parts[0]["text"]).strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Anthropic compose failed, using template: %s", exc)

    return _fallback_message(payload, routing)
