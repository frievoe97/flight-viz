"""Helpers for reading metadata about flights."""

from __future__ import annotations

import csv
import logging
import os
from typing import Dict, List

log = logging.getLogger(__name__)


def read_flights_csv(csv_path: str) -> List[Dict[str, str]]:
    """
    Read the CSV of flights.

    Supports both the legacy schema
    (``URL``, ``Rufzeichen``, ``Flugzeug``, ``Flugzeugnummer``)
    and the new schema
    (``flightaware_url``, ``callsign``, ``aircraft_registration``,
    ``aircraft_hex``, ``origin_iata``, ``origin_icao``, ``destination_iata``,
    ``destination_icao``).
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    rows: List[Dict[str, str]] = []
    with open(csv_path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        lower_to_original = {name.lower(): name for name in fieldnames if name}
        new_format = "flightaware_url" in lower_to_original

        for row in reader:
            normalized = {
                (key or "").lower(): (value or "").strip()
                for key, value in row.items()
            }

            if new_format:
                rows.append(
                    {
                        "url": normalized.get("flightaware_url", ""),
                        "callsign": normalized.get("callsign", ""),
                        "aircraft_registration": normalized.get("aircraft_registration", ""),
                        "aircraft_hex": normalized.get("aircraft_hex", ""),
                        "origin_iata": normalized.get("origin_iata", ""),
                        "origin_icao": normalized.get("origin_icao", ""),
                        "destination_iata": normalized.get("destination_iata", ""),
                        "destination_icao": normalized.get("destination_icao", ""),
                    }
                )
            else:
                rows.append(
                    {
                        "url": normalized.get("url", ""),
                        "callsign": normalized.get("rufzeichen", ""),
                        "aircraft_registration": normalized.get("flugzeug", ""),
                        "aircraft_hex": normalized.get("flugzeugnummer", ""),
                        "origin_iata": "",
                        "origin_icao": "",
                        "destination_iata": "",
                        "destination_icao": "",
                    }
                )
    log.info("Loaded %d flights from %s (new_format=%s)", len(rows), csv_path, new_format)
    return rows
