from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

TRAFFIC_LEVEL_RANK = {"low": 1, "medium": 2, "high": 3, "very_high": 4}


@dataclass(frozen=True)
class TrafficSlot:
    location: str
    location_norm: str
    level: str
    time_text: str
    minute_of_day: int


def _normalize_text(value: str) -> str:
    clean = "".join(ch.lower() if (ch.isalnum() or ch.isspace()) else " " for ch in value)
    return " ".join(clean.split())


def _parse_level(value: str) -> str:
    v = _normalize_text(value)
    if v in {"low", "medium", "high"}:
        return v
    if v in {"very high", "very_high"}:
        return "very_high"
    # Graceful fallback for noisy CSV rows.
    return "medium"


def _parse_time_to_minutes(value: str) -> int:
    raw = value.strip().upper().replace(" ", "")
    for fmt in ("%I:%M%p", "%I%p"):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.hour * 60 + dt.minute
        except ValueError:
            continue
    # Unknown format: keep it neutral at noon.
    return 12 * 60


@lru_cache(maxsize=1)
def load_traffic_slots() -> list[TrafficSlot]:
    csv_path = Path(__file__).resolve().parents[2] / "authority" / "traffic_data.csv"
    if not csv_path.exists():
        return []

    slots: list[TrafficSlot] = []
    with csv_path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            location = (row.get("Location") or "").strip()
            level_raw = (row.get("Traffic") or "").strip()
            time_text = (row.get("Time") or "").strip() or "12:00 PM"
            if not location:
                continue
            level = _parse_level(level_raw)
            slots.append(
                TrafficSlot(
                    location=location,
                    location_norm=_normalize_text(location),
                    level=level,
                    time_text=time_text,
                    minute_of_day=_parse_time_to_minutes(time_text),
                )
            )
    return slots


def _token_overlap_score(left: str, right: str) -> float:
    lt = set(left.split())
    rt = set(right.split())
    if not lt or not rt:
        return 0.0
    inter = len(lt.intersection(rt))
    union = len(lt.union(rt))
    return inter / union


def match_traffic_profile(*, location_candidates: list[str], now_minute: int | None = None) -> dict[str, object] | None:
    slots = load_traffic_slots()
    if not slots:
        return None

    norm_candidates = [_normalize_text(c) for c in location_candidates if c and c.strip()]
    if not norm_candidates:
        return None

    best_slot: TrafficSlot | None = None
    best_score = 0.0
    for slot in slots:
        score = max(
            (
                1.0
                if cand in slot.location_norm or slot.location_norm in cand
                else _token_overlap_score(cand, slot.location_norm)
            )
            for cand in norm_candidates
        )
        if score > best_score:
            best_score = score
            best_slot = slot

    if not best_slot or best_score < 0.25:
        return None

    minute = now_minute if now_minute is not None else (datetime.now().hour * 60 + datetime.now().minute)
    dist = abs(minute - best_slot.minute_of_day)
    nearest = min(dist, 1440 - dist)
    is_peak_now = nearest <= 90

    return {
        "traffic_level": best_slot.level,
        "traffic_location": best_slot.location,
        "traffic_peak_time": best_slot.time_text,
        "is_peak_now": is_peak_now,
        "match_score": round(best_score, 3),
    }

