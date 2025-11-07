"""High-level orchestration for downloading and exporting track logs."""

from __future__ import annotations

import json
import logging
import math
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd

from .airports import airports_match, lookup_airport, normalize_airport
from .aircraft_parser import parse_aircraft_details
from .cache import ensure_dir
from .config import URLS_CSV
from .download import aircraft_page_from_flight_url, download_if_needed
from .flights import read_flights_csv
from .tracklog_parser import parse_tracklog_table

PACKAGE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_ROOT.parent
EXPORT_ROOT = PROJECT_ROOT / "export"
CACHE_ROOT = EXPORT_ROOT / "cache"
FLIGHTS_CACHE_DIR = CACHE_ROOT / "flights"
FLIGHTS_CACHE_JSON = FLIGHTS_CACHE_DIR / "cache.json"
AIRCRAFT_CACHE_DIR = CACHE_ROOT / "aircrafts"
AIRCRAFT_CACHE_JSON = AIRCRAFT_CACHE_DIR / "cache.json"
EXPORT_FLIGHTS_DIR = EXPORT_ROOT / "flights"

EARTH_RADIUS_KM = 6371.0088
MAX_SPEED_FILL_KTS = 750  # simple sanity cap for derived speeds
TIME_GAP_SECONDS = 120
INTERPOLATION_STEP_SECONDS = 30
INTERPOLATED_NUMERIC_COLUMNS = {
    "latitude",
    "longitude",
    "altitude_ft",
    "course_deg_clockwise_from_north",
    "speed_kts",
    "speed_mph",
    "vertical_rate_fpm",
}

TARGETING_PATTERN = re.compile(r"\.setTargeting\('([^']+)',\s*'([^']*)'\)")
TARGETING_KEYS = {
    "aircraft_make",
    "aircraft_model",
    "aircraft_type",
    "engine_category",
    "engine_type",
    "type",
}

log = logging.getLogger(__name__)


def parse_flight_targeting(html: str) -> Dict[str, str]:
    """Extract aircraft metadata from the tracklog HTML targeting script."""
    result: Dict[str, str] = {}
    for key, value in TARGETING_PATTERN.findall(html):
        key_lower = key.strip().lower()
        if key_lower in TARGETING_KEYS:
            result[key_lower] = value.strip()
    return result


def process_flights(entries: Iterable[Dict[str, str]]) -> None:
    """Iterate through ``entries`` and export each available track log."""
    for entry in entries:
        callsign = entry.get("callsign") or entry.get("rufzeichen") or "?"
        flight_url = (entry.get("url") or "").strip()
        if not flight_url:
            log.warning("Skipping %s: no flight URL provided", callsign)
            continue

        log.info("Processing flight %s (%s)", callsign, flight_url)
        html_path, status = download_if_needed(
            flight_url, FLIGHTS_CACHE_DIR, FLIGHTS_CACHE_JSON
        )

        if not html_path or status == "error":
            log.error("Failed to obtain tracklog for %s (%s)", callsign, flight_url)
            continue

        with open(html_path, "r", encoding="utf-8") as handle:
            html = handle.read()

        flight_metadata = parse_flight_targeting(html)
        if flight_metadata:
            log.info("Flight metadata extracted for %s: %s", callsign, flight_metadata)
        else:
            log.info("No flight metadata found for %s", callsign)

        aircraft_info = {}
        aircraft_url = aircraft_page_from_flight_url(flight_url)
        if aircraft_url:
            aircraft_path, _ = download_if_needed(
                aircraft_url, AIRCRAFT_CACHE_DIR, AIRCRAFT_CACHE_JSON
            )
            if aircraft_path:
                try:
                    with open(aircraft_path, "r", encoding="utf-8") as aircraft_handle:
                        aircraft_html = aircraft_handle.read()
                    aircraft_info = parse_aircraft_details(aircraft_html)
                    if aircraft_info:
                        log.info("Aircraft info parsed for %s: %s", callsign, aircraft_info)
                except (OSError, ValueError, json.JSONDecodeError):
                    aircraft_info = {}

        df_main, airports_json, metadata = parse_tracklog_table(html, url=flight_url)
        export_tracklog(
            entry,
            flight_url,
            df_main,
            airports_json,
            metadata,
            aircraft_info,
            flight_metadata,
        )


def export_tracklog(
    entry: Dict[str, str],
    flight_url: str,
    df_main: pd.DataFrame,
    tracklog_airports: Dict[str, Dict[str, Any]],
    metadata: Dict[str, Any],
    aircraft_info: Dict[str, Any],
    flight_metadata: Dict[str, str],
) -> None:
    """Write the parsed tracklog CSV, summary JSON and GeoJSON to disk."""
    df = interpolate_time_gaps(df_main.copy(), metadata.get("time_column"))
    speed_filled = fill_missing_speed_from_positions(df, metadata.get("time_column"))
    ensure_speed_mph_column(df)
    altitude_filled = normalize_altitude_and_rates(df)
    mark_computed_rows(df, speed_filled, altitude_filled)
    time_info = extract_time_info(df, metadata.get("time_column"))

    resolved_airports = resolve_airports(entry, tracklog_airports)

    out_dir = determine_output_directory(resolved_airports, time_info)
    ensure_dir(out_dir)

    summary = build_summary(
        df,
        resolved_airports,
        entry,
        flight_url,
        metadata,
        time_info,
        aircraft_info,
        flight_metadata,
    )
    write_outputs(out_dir, df, summary, metadata.get("time_column"))

    dep = resolved_airports["departure"]
    arr = resolved_airports["arrival"]
    callsign = entry.get("callsign") or entry.get("rufzeichen") or "?"
    log.info(
        "Exported %s: rows=%d dep=(%s,%s) arr=(%s,%s)",
        callsign,
        len(df),
        dep.get("iata"),
        dep.get("icao"),
        arr.get("iata"),
        arr.get("icao"),
    )


def resolve_airports(
    entry: Dict[str, str],
    tracklog_airports: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """Combine CSV-provided codes with tracklog-derived airport data."""
    callsign = entry.get("callsign") or entry.get("rufzeichen") or "?"

    tracklog_departure = tracklog_airports.get("departure_airport") or normalize_airport(None, None)
    tracklog_arrival = tracklog_airports.get("arrival_airport") or normalize_airport(None, None)

    departure_record, departure_label, departure_detail = select_airport(
        entry,
        prefix="origin",
        fallback=tracklog_departure,
        callsign=callsign,
        role="departure",
    )
    arrival_record, arrival_label, arrival_detail = select_airport(
        entry,
        prefix="destination",
        fallback=tracklog_arrival,
        callsign=callsign,
        role="arrival",
    )

    log.info(
        "%s departure resolved via %s (%s): IATA=%s ICAO=%s",
        callsign,
        departure_label,
        departure_detail,
        departure_record.get("iata"),
        departure_record.get("icao"),
    )
    log.info(
        "%s arrival resolved via %s (%s): IATA=%s ICAO=%s",
        callsign,
        arrival_label,
        arrival_detail,
        arrival_record.get("iata"),
        arrival_record.get("icao"),
    )

    return {
        "departure": departure_record,
        "arrival": arrival_record,
    }


def select_airport(
    entry: Dict[str, str],
    prefix: str,
    fallback: Dict[str, Any],
    callsign: str,
    role: str,
) -> Tuple[Dict[str, Any], str, str]:
    """Determine the best airport record for the given role."""
    entry_iata = (entry.get(f"{prefix}_iata") or "").strip().upper() or None
    entry_icao = (entry.get(f"{prefix}_icao") or "").strip().upper() or None

    fallback_record = dict(fallback) if fallback else normalize_airport(None, None)
    selected_record = fallback_record.copy()
    source_label = "tracklog"
    source_detail = "tracklog"

    if entry_iata or entry_icao:
        record_iata = lookup_airport(entry_iata) if entry_iata else None
        record_icao = lookup_airport(entry_icao) if entry_icao else None

        if record_iata and record_icao and not airports_match(record_iata, record_icao):
            log.warning(
                "%s CSV %s codes differ (IATA=%s, ICAO=%s) – preferring ICAO data",
                callsign,
                role,
                entry_iata,
                entry_icao,
            )

        if record_icao:
            selected_record = normalize_airport(record_icao, entry_icao)
            source_label = "csv"
            source_detail = "csv_icao"
        elif record_iata:
            selected_record = normalize_airport(record_iata, entry_iata)
            source_label = "csv"
            source_detail = "csv_iata"
        else:
            selected_record = fallback_record.copy()
            if entry_iata:
                selected_record["iata"] = entry_iata
            if entry_icao:
                selected_record["icao"] = entry_icao
            source_label = "csv"
            source_detail = "csv_codes_only"

    if entry_iata and not selected_record.get("iata"):
        selected_record["iata"] = entry_iata
    if entry_icao and not selected_record.get("icao"):
        selected_record["icao"] = entry_icao

    return selected_record, source_label, source_detail


def interpolate_time_gaps(df: pd.DataFrame, time_column: Optional[str]) -> pd.DataFrame:
    """Insert interpolated rows when gaps exceed ``TIME_GAP_SECONDS``."""
    if df.empty:
        df["value_origin"] = pd.Series(dtype="object")
        return df

    if not time_column or time_column not in df.columns:
        df["value_origin"] = pd.Series(["original"] * len(df))
        return df

    times = pd.to_datetime(df[time_column], format="%d.%m.%Y %H:%M:%S", errors="coerce")
    columns = list(df.columns)
    new_rows: List[Dict[str, Any]] = []
    origins: List[str] = []

    for idx in range(len(df)):
        current_row = df.iloc[idx]
        new_rows.append(current_row.to_dict())
        origins.append("original")

        if idx == len(df) - 1:
            continue

        current_time = times.iloc[idx]
        next_time = times.iloc[idx + 1]
        if pd.isna(current_time) or pd.isna(next_time):
            continue

        gap_seconds = (next_time - current_time).total_seconds()
        if gap_seconds <= TIME_GAP_SECONDS:
            continue

        prev_series = df.iloc[idx]
        next_series = df.iloc[idx + 1]
        insert_time = current_time + timedelta(seconds=INTERPOLATION_STEP_SECONDS)
        while insert_time < next_time:
            fraction = (insert_time - current_time).total_seconds() / gap_seconds
            interpolated_row: Dict[str, Any] = {}
            for col in columns:
                if col == time_column:
                    interpolated_row[col] = insert_time.strftime("%d.%m.%Y %H:%M:%S")
                elif col in INTERPOLATED_NUMERIC_COLUMNS:
                    interpolated_row[col] = _interpolate_numeric(prev_series[col], next_series[col], fraction)
                else:
                    interpolated_row[col] = prev_series[col]
            new_rows.append(interpolated_row)
            origins.append("interpolated")
            insert_time += timedelta(seconds=INTERPOLATION_STEP_SECONDS)

    new_df = pd.DataFrame(new_rows, columns=columns)
    new_df.insert(len(columns), "value_origin", origins)
    return new_df.reset_index(drop=True)


def ensure_speed_mph_column(df: pd.DataFrame) -> None:
    """Guarantee a ``speed_mph`` column based on ``speed_kts`` if missing."""
    if "speed_mph" in df.columns:
        mph_numeric = pd.to_numeric(df["speed_mph"], errors="coerce")
    elif "speed_kts" in df.columns:
        speed_kts = pd.to_numeric(df["speed_kts"], errors="coerce")
        mph_numeric = speed_kts * 1.15078
        insert_index = df.columns.get_loc("speed_kts") + 1
        df.insert(insert_index, "speed_mph", mph_numeric)
    else:
        df["speed_mph"] = pd.Series([pd.NA] * len(df), dtype="Int64")
        return

    if "speed_kts" in df.columns:
        speed_kts = pd.to_numeric(df["speed_kts"], errors="coerce")
        mph_numeric = mph_numeric.fillna(speed_kts * 1.15078)

    df["speed_mph"] = pd.to_numeric(mph_numeric, errors="coerce").round().astype("Int64")


def normalize_altitude_and_rates(df: pd.DataFrame) -> pd.Series:
    """Fill sensible defaults for missing altitude and vertical-rate values."""
    filled_mask = pd.Series([False] * len(df), index=df.index)
    if "altitude_ft" in df.columns:
        altitude = pd.to_numeric(df["altitude_ft"], errors="coerce")
        missing = altitude.isna()
        if altitude.notna().any():
            altitude = altitude.ffill().bfill()
            df["altitude_ft"] = altitude.round().astype("Int64")
            filled_mask = missing
        else:
            df["altitude_ft"] = pd.Series([0] * len(df), index=df.index, dtype="Int64")
            filled_mask = pd.Series([True] * len(df), index=df.index)

    if "vertical_rate_fpm" in df.columns:
        rates = pd.to_numeric(df["vertical_rate_fpm"], errors="coerce").fillna(0)
        df["vertical_rate_fpm"] = rates.round().astype("Int64")

    return filled_mask


def fill_missing_speed_from_positions(df: pd.DataFrame, time_column: Optional[str]) -> pd.Series:
    """Estimate ``speed_kts`` by deriving segment speed from positions/time."""
    empty_mask = pd.Series([False] * len(df), index=df.index)
    if "speed_kts" not in df.columns:
        return empty_mask
    if not time_column or time_column not in df.columns:
        return empty_mask

    latitudes = pd.to_numeric(df.get("latitude"), errors="coerce")
    longitudes = pd.to_numeric(df.get("longitude"), errors="coerce")
    timestamps = pd.to_datetime(df[time_column], format="%d.%m.%Y %H:%M:%S", errors="coerce")
    speed_series = pd.to_numeric(df["speed_kts"], errors="coerce")

    if latitudes is None or longitudes is None:
        return empty_mask

    if not speed_series.isna().any():
        df["speed_kts"] = speed_series.round().astype("Int64")
        return empty_mask

    computed = speed_series.copy()
    filled_mask = pd.Series([False] * len(df), index=df.index)
    prev_lat = prev_lon = None
    prev_time: Optional[pd.Timestamp] = None

    for idx in range(len(df)):
        lat = latitudes.iloc[idx]
        lon = longitudes.iloc[idx]
        time_val = timestamps.iloc[idx]
        if pd.isna(lat) or pd.isna(lon) or pd.isna(time_val):
            continue

        if (
            prev_lat is not None
            and prev_lon is not None
            and prev_time is not None
            and pd.isna(computed.iloc[idx])
        ):
            delta_hours = (time_val - prev_time).total_seconds() / 3600.0
            if delta_hours > 0:
                distance_km = haversine_km(prev_lat, prev_lon, lat, lon)
                if distance_km > 0:
                    speed_kts = (distance_km / delta_hours) / 1.852
                    if 0 < speed_kts <= MAX_SPEED_FILL_KTS:
                        computed.iloc[idx] = speed_kts
                        filled_mask.iloc[idx] = True

        prev_lat = lat
        prev_lon = lon
        prev_time = time_val

    df["speed_kts"] = pd.to_numeric(computed, errors="coerce").round().astype("Int64")
    return filled_mask


def extract_time_info(df: pd.DataFrame, time_column: Optional[str]) -> Dict[str, Any]:
    """Extract first/last timestamps and parsed datetimes."""
    if not time_column or time_column not in df.columns:
        return {"start_str": None, "end_str": None, "start_dt": None, "end_dt": None}

    series = df[time_column].astype(str)
    values = [val for val in series.tolist() if val and val.lower() != "nan"]

    start_str = values[0] if values else None
    end_str = values[-1] if values else None
    start_dt = parse_time_string(start_str)
    end_dt = parse_time_string(end_str)
    return {
        "start_str": start_str,
        "end_str": end_str,
        "start_dt": start_dt,
        "end_dt": end_dt,
    }


def parse_time_string(value: Optional[str]) -> Optional[datetime]:
    """Parse ``dd.mm.yyyy HH:MM:SS`` timestamps to ``datetime``."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d.%m.%Y %H:%M:%S")
    except ValueError:
        return None


def mark_computed_rows(
    df: pd.DataFrame,
    speed_filled: pd.Series,
    altitude_filled: pd.Series,
) -> None:
    """Update ``value_origin`` to flag synthetic values."""
    if "value_origin" not in df.columns:
        df["value_origin"] = pd.Series(["original"] * len(df))

    combined_mask = (
        speed_filled.reindex(df.index, fill_value=False)
        | altitude_filled.reindex(df.index, fill_value=False)
    )
    existing_rows = df["value_origin"].ne("interpolated")
    df.loc[existing_rows & combined_mask, "value_origin"] = "computed"


def determine_output_directory(airports: Dict[str, Dict[str, Any]], time_info: Dict[str, Any]) -> Path:
    """Generate the output directory name (date_start_destination)."""
    date_part = "unknown-date"
    if time_info.get("start_dt"):
        date_part = time_info["start_dt"].date().isoformat()

    dep_code = airport_display_code(airports.get("departure"))
    arr_code = airport_display_code(airports.get("arrival"))

    base_name = f"{date_part}_{dep_code}_{arr_code}"
    out_dir = EXPORT_FLIGHTS_DIR / base_name

    counter = 1
    while out_dir.exists():
        out_dir = EXPORT_FLIGHTS_DIR / f"{base_name}_{counter:02d}"
        counter += 1

    return out_dir


def airport_display_code(airport: Optional[Dict[str, Any]]) -> str:
    """Return a short code (IATA preferred, fall back to ICAO)."""
    if not airport:
        return "UNKNOWN"
    return (airport.get("iata") or airport.get("icao") or "UNKNOWN").replace(" ", "_")


def build_summary(
    df: pd.DataFrame,
    airports: Dict[str, Dict[str, Any]],
    entry: Dict[str, str],
    flight_url: str,
    metadata: Dict[str, Any],
    time_info: Dict[str, Any],
    aircraft_info: Dict[str, Any],
    flight_metadata: Dict[str, str],
) -> Dict[str, Any]:
    """Assemble the summary JSON structure."""
    latitudes = pd.to_numeric(df.get("latitude"), errors="coerce")
    longitudes = pd.to_numeric(df.get("longitude"), errors="coerce")

    track_length_km = compute_track_length_km(latitudes, longitudes)
    bbox = compute_bbox(latitudes, longitudes)

    speed_kts = pd.to_numeric(df.get("speed_kts"), errors="coerce")
    speed_mph = pd.to_numeric(df.get("speed_mph"), errors="coerce")
    altitude_ft = pd.to_numeric(df.get("altitude_ft"), errors="coerce")
    vertical_rate = pd.to_numeric(df.get("vertical_rate_fpm"), errors="coerce")

    speed_kts_min = min_value(speed_kts)
    speed_kts_max = max_value(speed_kts)
    speed_kts_avg = mean_value(speed_kts)

    speed_mph_min = min_value(speed_mph)
    speed_mph_max = max_value(speed_mph)
    speed_mph_avg = mean_value(speed_mph)

    altitude_min = min_value(altitude_ft)
    altitude_max = max_value(altitude_ft)
    altitude_avg = mean_value(altitude_ft)

    vertical_min = min_value(vertical_rate)
    vertical_max = max_value(vertical_rate)
    vertical_avg = mean_value(vertical_rate)

    summary = {
        "start_time_utc": time_info.get("start_str"),
        "end_time_utc": time_info.get("end_str"),
        "duration_seconds": compute_duration_seconds(time_info.get("start_dt"), time_info.get("end_dt")),
        "track_length_km": round(track_length_km, 3) if track_length_km is not None else None,
        "bbox": bbox,
        "speed_kts_min": maybe_int(speed_kts_min),
        "speed_kts_max": maybe_int(speed_kts_max),
        "speed_kts_avg": round(speed_kts_avg, 1) if speed_kts_avg is not None else None,
        "speed_mph_min": maybe_int(speed_mph_min),
        "speed_mph_max": maybe_int(speed_mph_max),
        "speed_mph_avg": round(speed_mph_avg, 1) if speed_mph_avg is not None else None,
        "altitude_ft_min": maybe_int(altitude_min),
        "altitude_ft_max": maybe_int(altitude_max),
        "altitude_ft_avg": maybe_int(altitude_avg),
        "vertical_rate_fpm_min": round(vertical_min, 1) if vertical_min is not None else None,
        "vertical_rate_fpm_max": round(vertical_max, 1) if vertical_max is not None else None,
        "vertical_rate_fpm_avg": round(vertical_avg, 1) if vertical_avg is not None else None,
        "points": int(len(df)),
        "callsign": entry.get("callsign") or entry.get("rufzeichen") or None,
        "aircraft_registration": entry.get("aircraft_registration") or entry.get("flugzeug") or None,
        "aircraft_hex": entry.get("aircraft_hex") or entry.get("flugzeugnummer") or None,
        "aircraft_friendly_type": aircraft_info.get("aircraft_type"),
        "operator": aircraft_info.get("operator"),
        "aircraft_make": flight_metadata.get("aircraft_make"),
        "aircraft_model": flight_metadata.get("aircraft_model"),
        "aircraft_type": flight_metadata.get("aircraft_type"),
        "engine_category": flight_metadata.get("engine_category"),
        "engine_type": flight_metadata.get("engine_type"),
        "type": flight_metadata.get("type"),
        "source_url": flight_url,
    }

    summary["departure_airport"] = airports.get("departure")
    summary["arrival_airport"] = airports.get("arrival")

    return summary


def compute_duration_seconds(start_dt: Optional[datetime], end_dt: Optional[datetime]) -> Optional[int]:
    if not start_dt or not end_dt:
        return None
    return int((end_dt - start_dt).total_seconds())


def compute_track_length_km(latitudes: pd.Series, longitudes: pd.Series) -> Optional[float]:
    total = 0.0
    prev_lat = prev_lon = None
    segments = 0

    for lat, lon in zip(latitudes, longitudes):
        if lat is None or lon is None or pd.isna(lat) or pd.isna(lon):
            continue
        if prev_lat is not None and prev_lon is not None:
            total += haversine_km(prev_lat, prev_lon, lat, lon)
            segments += 1
        prev_lat, prev_lon = lat, lon

    if segments == 0:
        return None
    return total


def compute_bbox(latitudes: pd.Series, longitudes: pd.Series) -> Dict[str, Optional[float]]:
    lat_clean = latitudes.dropna()
    lon_clean = longitudes.dropna()

    if lat_clean.empty or lon_clean.empty:
        return {
            "min_lat": None,
            "min_lon": None,
            "max_lat": None,
            "max_lon": None,
        }

    return {
        "min_lat": round(float(lat_clean.min()), 4),
        "min_lon": round(float(lon_clean.min()), 4),
        "max_lat": round(float(lat_clean.max()), 4),
        "max_lon": round(float(lon_clean.max()), 4),
    }


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute the great-circle distance between two lat/lon pairs."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def min_value(series: pd.Series) -> Optional[float]:
    if series is None:
        return None
    clean = series.dropna()
    if clean.empty:
        return None
    return float(clean.min())


def max_value(series: pd.Series) -> Optional[float]:
    if series is None:
        return None
    clean = series.dropna()
    if clean.empty:
        return None
    return float(clean.max())


def mean_value(series: pd.Series) -> Optional[float]:
    if series is None:
        return None
    clean = series.dropna()
    if clean.empty:
        return None
    return float(clean.mean())


def maybe_int(value: Optional[float]) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return int(round(value))


def write_outputs(
    out_dir: Path,
    df: pd.DataFrame,
    summary: Dict[str, Any],
    time_column: Optional[str],
) -> None:
    """Write CSV, summary JSON and GeoJSON artifacts."""
    df.to_csv(out_dir / "main.csv", index=False)

    with open(out_dir / "summary.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    write_geojson(out_dir / "track.geojson", df, time_column)


def write_geojson(out_path: Path, df: pd.DataFrame, time_column: Optional[str]) -> None:
    """Create a GeoJSON FeatureCollection for the track."""
    latitudes = pd.to_numeric(df.get("latitude"), errors="coerce")
    longitudes = pd.to_numeric(df.get("longitude"), errors="coerce")
    coordinates = [
        [float(lon), float(lat)]
        for lat, lon in zip(latitudes, longitudes)
        if not (lat is None or lon is None or pd.isna(lat) or pd.isna(lon))
    ]

    properties: Dict[str, Any] = {}
    if time_column and time_column in df.columns:
        properties["time_europe_berlin"] = df[time_column].fillna("").astype(str).tolist()

    properties["course_deg_clockwise_from_north"] = [
        maybe_int(val) if val is not None else None
        for val in series_to_list(pd.to_numeric(df.get("course_deg_clockwise_from_north"), errors="coerce"))
    ]
    properties["speed_kts"] = [
        maybe_int(val) if val is not None else None
        for val in series_to_list(pd.to_numeric(df.get("speed_kts"), errors="coerce"))
    ]
    properties["speed_mph"] = [
        round(val, 1) if val is not None else None
        for val in series_to_list(pd.to_numeric(df.get("speed_mph"), errors="coerce"))
    ]
    properties["altitude_ft"] = [
        maybe_int(val) if val is not None else None
        for val in series_to_list(pd.to_numeric(df.get("altitude_ft"), errors="coerce"))
    ]
    properties["vertical_rate_fpm"] = [
        round(val, 1) if val is not None else None
        for val in series_to_list(pd.to_numeric(df.get("vertical_rate_fpm"), errors="coerce"))
    ]

    feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates,
        },
        "properties": properties,
    }

    collection = {
        "type": "FeatureCollection",
        "features": [feature],
    }

    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(collection, handle, ensure_ascii=False, indent=2)


def series_to_list(series: pd.Series) -> List[Optional[float]]:
    if series is None:
        return []
    return [
        float(value) if value is not None and not pd.isna(value) else None
        for value in series.tolist()
    ]


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if pd.isna(value):
        return True
    if isinstance(value, float):
        return math.isnan(value)
    text = str(value).strip()
    return text == "" or text.lower() == "nan"


def _interpolate_numeric(start: Any, end: Any, fraction: float) -> Optional[float]:
    start_val = _to_float(start)
    end_val = _to_float(end)
    if start_val is None or end_val is None:
        return None
    return start_val + (end_val - start_val) * fraction


def _to_float(value: Any) -> Optional[float]:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        text = str(value).strip()
        if not text:
            return None
        try:
            return float(text.replace(",", "."))
        except ValueError:
            return None


def main(csv_path: str | None = None) -> None:
    """Entry point for the CLI."""
    ensure_dir(FLIGHTS_CACHE_DIR)
    ensure_dir(AIRCRAFT_CACHE_DIR)
    ensure_dir(EXPORT_FLIGHTS_DIR)
    reset_export_directory()

    flights = read_flights_csv(str(resolve_csv_path(csv_path)))
    process_flights(flights)
    create_export_archive()


def reset_export_directory() -> None:
    """Remove all previous flight exports before a new run."""
    if EXPORT_FLIGHTS_DIR.exists():
        for child in EXPORT_FLIGHTS_DIR.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    ensure_dir(EXPORT_FLIGHTS_DIR)


def resolve_csv_path(csv_path: str | None) -> Path:
    """Resolve the CSV path to an absolute ``Path``."""
    if csv_path:
        candidate = Path(csv_path)
        if not candidate.is_absolute():
            candidate = (Path.cwd() / candidate).resolve()
        return candidate

    default = Path(URLS_CSV)
    if not default.is_absolute():
        default = (PROJECT_ROOT / default).resolve()
    return default


def create_export_archive() -> None:
    """Create a ZIP archive of the exported flight data."""
    if not EXPORT_FLIGHTS_DIR.exists():
        return

    zip_base = EXPORT_ROOT / "flights"
    zip_path = zip_base.with_suffix(".zip")
    if zip_path.exists():
        zip_path.unlink()

    shutil.make_archive(str(zip_base), "zip", root_dir=EXPORT_ROOT, base_dir="flights")
