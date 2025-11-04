"""Helpers for working with airport metadata."""

from __future__ import annotations

from typing import Any, Dict, Optional, List

try:
    from airportsdata import load as load_airports
except ImportError as exc:
    raise SystemExit("Install airportsdata: pip install airportsdata") from exc

AIRPORTS_ICAO = load_airports("ICAO")
AIRPORTS_IATA = load_airports("IATA")


def lookup_airport(code: Optional[str]) -> Optional[Dict[str, Any]]:
    """Look up an airport by ICAO or IATA code."""
    if not code:
        return None
    token = code.upper()
    return AIRPORTS_ICAO.get(token) or AIRPORTS_IATA.get(token)


def normalize_airport(record: Optional[Dict[str, Any]], code: Optional[str]) -> Dict[str, Any]:
    """Return a normalized airport payload with consistent keys."""
    candidate = (code or "").upper()
    return {
        "icao": (record.get("icao") if record else (candidate if len(candidate) == 4 else None)),
        "iata": (record.get("iata") if record else (candidate if len(candidate) == 3 else None)),
        "name": record.get("name") if record else None,
        "city": record.get("city") if record else None,
        "subd": record.get("subd") if record else None,
        "country": record.get("country") if record else None,
        "elevation": record.get("elevation") if record else None,
        "lat": record.get("lat") if record else None,
        "lon": record.get("lon") if record else None,
    }


def airport_from_codes(codes: List[str]) -> Dict[str, Any]:
    """
    Resolve an airport from a list of codes (ICAO preferred, fall back to IATA).
    """
    tokens = [code.strip().upper() for code in codes if code]

    icao = next((c for c in tokens if len(c) == 4), None)
    iata = next((c for c in tokens if len(c) == 3), None)

    record = lookup_airport(icao) if icao else None
    if not record and iata:
        record = lookup_airport(iata)

    normalized = normalize_airport(record, icao or iata)

    if iata and not normalized.get("iata"):
        normalized["iata"] = iata.upper()
    if icao and not normalized.get("icao"):
        normalized["icao"] = icao.upper()

    return normalized


def airports_match(left: Optional[Dict[str, Any]], right: Optional[Dict[str, Any]]) -> bool:
    """Return True if two airport records appear to describe the same place."""
    if not left or not right:
        return True
    for key in ("icao", "iata"):
        l_val = (left.get(key) or "").upper()
        r_val = (right.get(key) or "").upper()
        if l_val and r_val and l_val != r_val:
            return False
    return True
