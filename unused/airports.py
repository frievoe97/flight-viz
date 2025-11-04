import csv
import logging
import re
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Iterable

from airportsdata import load as load_airports

from config import AIRPORT_MISSING_CSV, AIRPORT_OVERRIDE_CSV

log = logging.getLogger("airports")

AIRPORTS_ICAO = load_airports("ICAO")
AIRPORTS_IATA = load_airports("IATA")

_MISSING_HEADERS = ["code"]
_OVERRIDE_HEADERS = [
    "code",
    "icao",
    "iata",
    "name",
    "city",
    "subd",
    "country",
    "elevation",
    "lat",
    "lon",
]


def _ensure_csv(path: Path, headers: Iterable[str]) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(list(headers))


def _load_missing_codes() -> set[str]:
    codes: set[str] = set()
    if AIRPORT_MISSING_CSV.exists():
        with AIRPORT_MISSING_CSV.open("r", newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                code = (row.get("code") or "").strip().upper()
                if code:
                    codes.add(code)
    else:
        _ensure_csv(AIRPORT_MISSING_CSV, _MISSING_HEADERS)
    return codes


def _clean_number(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _clean_elevation(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _override_row_to_record(code: str, row: Dict[str, str]) -> Dict[str, Any]:
    def _get(key: str) -> Optional[str]:
        val = row.get(key)
        if val is None:
            return None
        val = val.strip()
        return val or None

    icao = _get("icao") or (code if len(code) == 4 else None)
    iata = _get("iata") or (code if len(code) == 3 else None)
    return {
        "icao": icao,
        "iata": iata,
        "name": _get("name"),
        "city": _get("city"),
        "subd": _get("subd"),
        "country": _get("country"),
        "elevation": _clean_elevation(_get("elevation")),
        "lat": _clean_number(_get("lat")),
        "lon": _clean_number(_get("lon")),
    }


def _load_overrides() -> Dict[str, Dict[str, Any]]:
    overrides: Dict[str, Dict[str, Any]] = {}
    _ensure_csv(AIRPORT_OVERRIDE_CSV, _OVERRIDE_HEADERS)
    if not AIRPORT_OVERRIDE_CSV.exists():
        return overrides
    with AIRPORT_OVERRIDE_CSV.open("r", newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            code = (row.get("code") or "").strip().upper()
            if not code:
                continue
            overrides[code] = _override_row_to_record(code, row)
    return overrides


_MISSING_CODES = _load_missing_codes()
AIRPORT_OVERRIDES = _load_overrides()


def _is_complete_airport(record: Optional[Dict[str, Any]]) -> bool:
    if not record:
        return False
    return (
        record.get("icao")
        and record.get("iata")
        and record.get("lat") is not None
        and record.get("lon") is not None
    )

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    la1, lo1, la2, lo2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = sin(dlat / 2) ** 2 + cos(la1) * cos(la2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    earth_radius_km = 6371.0088
    return earth_radius_km * c

def record_missing_code(code: Optional[str]) -> None:
    if not code:
        return
    code_upper = code.strip().upper()
    if not code_upper or code_upper in _MISSING_CODES:
        return
    _MISSING_CODES.add(code_upper)
    _ensure_csv(AIRPORT_MISSING_CSV, _MISSING_HEADERS)
    with AIRPORT_MISSING_CSV.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow([code_upper])
    log.info("airport code missing in db recorded=%s", code_upper)


def remove_missing_code(code: Optional[str]) -> None:
    if not code:
        return
    code_upper = code.strip().upper()
    if code_upper not in _MISSING_CODES:
        return
    _MISSING_CODES.remove(code_upper)
    _ensure_csv(AIRPORT_MISSING_CSV, _MISSING_HEADERS)
    with AIRPORT_MISSING_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(_MISSING_HEADERS)
        for value in sorted(_MISSING_CODES):
            writer.writerow([value])


def lookup_airport(code: str) -> Optional[Dict[str, Any]]:
    if not code:
        return None
    code_upper = code.upper()
    override = AIRPORT_OVERRIDES.get(code_upper)
    if override:
        return override
    return AIRPORTS_ICAO.get(code_upper) or AIRPORTS_IATA.get(code_upper)

def normalize_airport_record(record: Optional[Dict[str, Any]], code: str) -> Dict[str, Any]:
    record = record or {}
    code_upper = code.upper()
    return {
        "icao": record.get("icao") or (code_upper if len(code_upper) == 4 else None),
        "iata": record.get("iata") or (code_upper if len(code_upper) == 3 else None),
        "name": record.get("name"),
        "city": record.get("city"),
        "subd": record.get("subd"),
        "country": record.get("country"),
        "elevation": record.get("elevation"),
        "lat": record.get("lat"),
        "lon": record.get("lon"),
    }


def resolve_airport_candidates(candidates: Iterable[str]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    clean_candidates = [c.strip().upper() for c in candidates if c and c.strip()]
    for cand in clean_candidates:
        rec = lookup_airport(cand)
        if rec:
            return normalize_airport_record(rec, cand), cand
    return None, clean_candidates[0] if clean_candidates else None


def find_nearest_airport(lat: float, lon: float, max_km: float = 10.0) -> Tuple[Optional[Dict[str, Any]], Optional[float]]:
    best = None
    def _iter_records() -> Iterable[Dict[str, Any]]:
        yield from AIRPORTS_ICAO.values()
        for code, rec in AIRPORT_OVERRIDES.items():
            # Skip overrides already covered by ICAO dataset
            if code in AIRPORTS_ICAO or code in AIRPORTS_IATA:
                continue
            yield {**rec, "icao": rec.get("icao") or (code if len(code) == 4 else None), "iata": rec.get("iata") or (code if len(code) == 3 else None)}

    for rec in _iter_records():
        rlat, rlon = rec.get("lat"), rec.get("lon")
        if rlat is None or rlon is None:
            continue
        dist = haversine_km(lat, lon, float(rlat), float(rlon))
        penalty = 5.0 if not rec.get("iata") else 0.0
        score = dist + penalty
        if best is None or score < best["score"]:
            best = {"record": rec, "distance_km": dist, "score": score}

    if not best or (max_km is not None and best["distance_km"] > max_km):
        return None, None

    rec = best["record"]
    code = rec.get("icao") or rec.get("iata") or ""
    norm = normalize_airport_record(rec, code)
    return norm, best["distance_km"]

def select_display_code(info: Optional[Dict[str, Any]], fallback: Optional[str]) -> str:
    if info and info.get("iata"):
        return re.sub(r"[^0-9A-Z]", "", info["iata"].upper()) or "UNK"
    if info and info.get("icao"):
        return re.sub(r"[^0-9A-Z]", "", info["icao"].upper()) or "UNK"
    if fallback:
        return re.sub(r"[^0-9A-Z]", "", fallback.upper()) or "UNK"
    return "UNK"

def log_airport_resolution(kind: str, method: str, code: Optional[str], detail: Optional[str] = None) -> None:
    detail_suffix = f" detail={detail}" if detail else ""
    log.info("airport resolution kind=%s method=%s code=%s%s", kind, method, code, detail_suffix)


def update_missing_registry(code: Optional[str], airport: Optional[Dict[str, Any]]) -> None:
    if not code:
        return
    if _is_complete_airport(airport):
        remove_missing_code(code)
    else:
        record_missing_code(code)
