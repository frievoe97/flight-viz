"""Utilities for parsing FlightAware tracklog tables."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

import pandas as pd
from bs4 import BeautifulSoup, Tag
from dateutil import tz

# eigene Config
from .config import TARGET_TZ, ABBR_TO_IANA
from .airports import airport_from_codes, normalize_airport

log = logging.getLogger(__name__)

# Für responsive Tabellen – wir nehmen genau EINE bevorzugte Variante je Zelle
PREFERRED_CLASS_SUBSTRINGS = (
    "show-for-large",
    "show-for-medium",
    "show-for-desktop",
    "show-for-medium-up",
    "show-for-large-up",
)

# ---------------------------
# Regex / Parsing-Regeln
# ---------------------------

RE_EVENT_DEPARTURE = re.compile(r"\bdeparture\b", re.IGNORECASE)
RE_EVENT_ARRIVAL   = re.compile(r"\barrival\b",   re.IGNORECASE)
RE_PARENS          = re.compile(r"\(([^)]*)\)")
# z. B. "FlightAware ADS-B(PMO / LICJ)" oder "FlightAware ADS-B (ETNN)"
RE_REPORTING_VALID = re.compile(r"^flightaware\s+ads-b\s*\(([^)]*)\)\s*$", re.IGNORECASE)

# ---------------------------
# Generische Parsing-Helper
# ---------------------------

def primary_cell_text(td: Tag) -> str:
    """
    Liefert genau EINE Textvariante aus der Zelle:
    - bevorzugt show-for-* große Varianten
    - sonst erste show-/hide-Variante
    - sonst erstes Kindelement
    - sonst erster Text-Node
    """
    for sub in PREFERRED_CLASS_SUBSTRINGS:
        el = td.select_one(f'span[class*="{sub}"], div[class*="{sub}"]')
        if el:
            return el.get_text(" ", strip=True)

    el = td.select_one(
        'span[class*="show-for-"], div[class*="show-for-"], '
        'span[class*="hide-for-"], div[class*="hide-for-"]'
    )
    if el:
        return el.get_text(" ", strip=True)

    first_child = td.find(True)
    if first_child:
        return first_child.get_text(" ", strip=True)

    for s in td.stripped_strings:
        return s.strip()
    return ""

def _split_codes(raw_inside_parens: str) -> List[str]:
    """
    "CGN / EDDK" -> ["CGN", "EDDK"] ; "ETNN" -> ["ETNN"]
    """
    parts = re.split(r"[\/|,]", raw_inside_parens.strip())
    codes: List[str] = []
    for p in parts:
        token = re.sub(r"\s+", "", p).upper()
        if token and re.fullmatch(r"[A-Z0-9]{3,4}", token):
            codes.append(token)
    # Deduplizieren bei Erhalt der Reihenfolge
    uniq, seen = [], set()
    for c in codes:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq

def _headers_from_table(table: Tag) -> List[str]:
    return [primary_cell_text(th) for th in table.find_all("th")]

def _find_col(raw_headers: List[str], prefix: str) -> Optional[int]:
    for i, header in enumerate(raw_headers):
        if header.strip().startswith(prefix):
            return i
    return None

def _resolve_source_tz_from_header(raw_headers: List[str]):
    label = None
    for h in raw_headers:
        if h.strip().startswith("Time"):
            m = re.search(r"\(([^)]+)\)", h)
            if m:
                label = m.group(1).strip().upper()
            break
    name = ABBR_TO_IANA.get(label, "UTC")
    return tz.gettz(name)

def _parse_url_date(url: str) -> datetime:
    m = re.search(r"/history/(\d{8})/", url)
    return datetime.strptime(m.group(1), "%Y%m%d") if m else datetime.utcnow()

def _clean_first_float(text: str, digits: int = 4) -> Optional[str]:
    """
    Erste Fließkommazahl extrahieren und formatieren.
    Fix für doppelte Darstellung wie '38.169538.17' -> '38.1695'.
    """
    m = re.search(r"(-?\d+(?:\.\d+)?)", text.replace(",", "."))
    if not m:
        return None
    val = float(m.group(1))
    return f"{val:.{digits}f}"

def _clean_course(value: str) -> str:
    m = re.search(r"(-?\d+)\s*°", value)
    return m.group(1) if m else value.strip()

def _clean_intlike(value: str) -> str:
    return re.sub(r"[^\d\-]", "", value or "")

def _clean_rate(value: str) -> str:
    if not value:
        return value
    cleaned = value.replace(".", "").replace(",", ".")
    if re.search(r",\d{3}$", value):
        cleaned = value.replace(",", "")
    return cleaned.strip()

def _rename_headers(raw_headers: List[str]) -> List[str]:
    """
    Sanfte Normalisierung → Ziel-Spaltennamen für die Ausgabe.
    """
    time_col_name = f"time_{TARGET_TZ.key.replace('/', '_').lower()}"
    mapping = {
        "Time": time_col_name,
        "Latitude": "latitude",
        "Longitude": "longitude",
        "Course": "course_deg_clockwise_from_north",
        "kts": "speed_kts",
        "mph": "speed_mph",
        "feet": "altitude_ft",
        "Rate": "vertical_rate_fpm",
        "Reporting Facility": "reporting_facility",
    }
    result = []
    for header in raw_headers:
        base = header.split("(")[0].strip() if "(" in header and ")" in header else header.strip()
        result.append(mapping.get(base, re.sub(r"\W+", "_", base.lower()).strip("_")))
    return result

def _pick_reporting_col(df: pd.DataFrame) -> Optional[str]:
    for c in df.columns:
        if "report" in c.lower() and "facility" in c.lower():
            return c
    return None

# ---------------------------
# Öffentliche API
# ---------------------------

def parse_tracklog_table(html: str, url: str) -> Tuple[pd.DataFrame, Dict[str, Any], Dict[str, Any]]:
    """
    Parsed die Tracklog-Tabelle und liefert:
      - df_main (bereinigt, keine Event-Zeilen, keine doppelten Zelltexte)
      - airports_json mit departure_airport / arrival_airport (via events → sonst reporting_facility),
        jeweils mit Feldern: icao, iata, name, city, subd, country, elevation, lat, lon.
      - metadata mit zusätzlichen Informationen (u. a. Reporting Facilities).
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id="tracklogTable")
    if not table:
        raise ValueError("tracklogTable nicht gefunden")

    # Header
    raw_headers = _headers_from_table(table)
    if not raw_headers:
        raise ValueError("Keine Header in Tracklog")
    cols_out = _rename_headers(raw_headers)
    src_tz = _resolve_source_tz_from_header(raw_headers)
    time_index   = _find_col(raw_headers, "Time")
    course_index = _find_col(raw_headers, "Course")
    feet_index   = _find_col(raw_headers, "feet")
    rate_index   = _find_col(raw_headers, "Rate")
    kts_index    = _find_col(raw_headers, "kts")
    mph_index    = _find_col(raw_headers, "mph")
    date_from_url = _parse_url_date(url)

    # Event-Texte einsammeln (für Airport-Erkennung 1.1)
    event_texts: List[str] = []
    # Datenzeilen sammeln
    records: List[Dict[str, Any]] = []
    time_conversion_success = 0

    for tr in table.find_all("tr"):
        classes = tr.get("class", []) or []
        tds = tr.find_all("td")
        if not tds:
            # Header- oder Leerzeile
            continue

        # Event-Zeilen erkennen (enthält 'Departure'/'Arrival' irgendwo)
        txt_all = tr.get_text(" ", strip=True)
        if RE_EVENT_DEPARTURE.search(txt_all) or RE_EVENT_ARRIVAL.search(txt_all):
            event_texts.append(txt_all)
            continue  # Events NICHT ins main übernehmen

        # Normale Zeilen: pro Zelle GENAU EINE Textvariante
        values = [primary_cell_text(td) for td in tds]
        if len(values) != len(raw_headers):
            # inkonsistente Zeile überspringen
            continue

        cleaned = values[:]

        # Zeit konvertieren
        if time_index is not None:
            try:
                naive = datetime.strptime(cleaned[time_index], "%a %I:%M:%S %p")
                source_time = datetime(
                    date_from_url.year, date_from_url.month, date_from_url.day,
                    naive.hour, naive.minute, naive.second, tzinfo=src_tz,
                )
                local_time = source_time.astimezone(TARGET_TZ)
                cleaned[time_index] = local_time.strftime("%d.%m.%Y %H:%M:%S")
                time_conversion_success += 1
            except Exception:
                # still leave original if parsing failed
                pass

        # Kurs nur Zahl
        if course_index is not None:
            cleaned[course_index] = _clean_course(cleaned[course_index])

        # numerische Felder
        if feet_index is not None:
            cleaned[feet_index] = _clean_intlike(cleaned[feet_index])
        if kts_index is not None:
            cleaned[kts_index] = _clean_intlike(cleaned[kts_index])
        if mph_index is not None:
            cleaned[mph_index] = _clean_intlike(cleaned[mph_index])
        if rate_index is not None:
            cleaned[rate_index] = _clean_rate(cleaned[rate_index])

        records.append(dict(zip(cols_out, cleaned)))

    # DataFrame
    df = pd.DataFrame.from_records(records)
    if df.empty:
        raise ValueError("Keine Datenzeilen in Tracklog")

    # Reihenfolge zeitlich
    time_col = next((c for c in df.columns if c.startswith("time_")), None)
    if time_col:
        order = pd.to_datetime(df[time_col], format="%d.%m.%Y %H:%M:%S", errors="coerce")
        df = df.loc[order.sort_values().index].reset_index(drop=True)

    # Lat/Lon sauber ziehen (erste Float in Zelle)
    if "latitude" in df.columns:
        df["latitude"] = df["latitude"].astype(str).map(lambda x: _clean_first_float(x) or "")
    if "longitude" in df.columns:
        df["longitude"] = df["longitude"].astype(str).map(lambda x: _clean_first_float(x) or "")

    # Finale Spaltenauswahl & Umbenennungen
    # mph lassen wir bewusst weg
    keep_columns = [c for c in [
        time_col,
        "latitude",
        "longitude",
        "course_deg_clockwise_from_north",
        "speed_kts",
        "speed_mph",
        "altitude_ft",
        "vertical_rate_fpm",
        "reporting_facility",
    ] if c and c in df.columns]
    if keep_columns:
        df = df[keep_columns]

    log.info(
        "tracklog parsed url=%s columns=%s rows=%d time_converted=%d",
        url, ",".join(df.columns), len(df), time_conversion_success
    )

    # ---------------- Airports bestimmen ----------------
    # 1.1 Events: Departure/Arrival mit Codes in Klammern
    dep_codes: List[str] = []
    arr_codes: List[str] = []
    for text in event_texts:
        if RE_EVENT_DEPARTURE.search(text):
            m = RE_PARENS.search(text)
            if m:
                dep_codes = _split_codes(m.group(1))
        if RE_EVENT_ARRIVAL.search(text):
            m = RE_PARENS.search(text)
            if m:
                arr_codes = _split_codes(m.group(1))

    # 1.2 Reporting Facility (erster/letzter gültiger Eintrag)
    reporting_departure_str: Optional[str] = None
    reporting_arrival_str: Optional[str] = None
    if "reporting_facility" in df.columns:
        series = df["reporting_facility"].astype(str).fillna("")
        for val in series:
            cleaned_val = val.strip()
            match = RE_REPORTING_VALID.match(cleaned_val)
            if match:
                if not reporting_departure_str:
                    reporting_departure_str = cleaned_val
                if not dep_codes:
                    codes = _split_codes(match.group(1))
                    if codes:
                        dep_codes = codes
                # continue scanning to capture arrival string
        for val in reversed(series.tolist()):
            cleaned_val = val.strip()
            match = RE_REPORTING_VALID.match(cleaned_val)
            if match:
                if not reporting_arrival_str:
                    reporting_arrival_str = cleaned_val
                if not arr_codes:
                    codes = _split_codes(match.group(1))
                    if codes:
                        arr_codes = codes
                if reporting_arrival_str and arr_codes:
                    break

    dep_airport = airport_from_codes(dep_codes) if dep_codes else normalize_airport(None, None)
    arr_airport = airport_from_codes(arr_codes) if arr_codes else normalize_airport(None, None)

    airports_json = {
        "departure_airport": dep_airport,
        "arrival_airport":   arr_airport,
    }

    if "reporting_facility" in df.columns:
        df = df.drop(columns=["reporting_facility"])

    metadata = {
        "time_column": time_col,
        "reporting_facility_departure": reporting_departure_str,
        "reporting_facility_departure_source": (
            "tracklog_reporting_facility_column" if reporting_departure_str else None
        ),
        "reporting_facility_arrival": reporting_arrival_str,
        "reporting_facility_arrival_source": (
            "tracklog_reporting_facility_column" if reporting_arrival_str else None
        ),
    }

    return df, airports_json, metadata
