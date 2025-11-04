import logging
import os
import re
import shutil
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import pandas as pd

from config import (
    ensure_dirs,
    URLS_CSV,
    TARGET_TZ,
    FLIGHTS_BASE,
    AIRCRAFTS_BASE,
    FLIGHT_DOWNLOAD_LOG,
    AIRCRAFT_DOWNLOAD_LOG,
)
from io_utils import read_json, write_json
from net import get_cached
from parse_tracklog import parse_tracklog_table, extract_event_airports
from parse_aircraft import extract_aircraft_info
from airports import (
    select_display_code,
    log_airport_resolution,
    resolve_airport_candidates,
    find_nearest_airport,
    update_missing_registry,
    remove_missing_code,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("runner")
alog = logging.getLogger("airports")

def load_flight_plan(csv_path: str) -> list[Dict[str, Optional[str]]]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Flight definition CSV '{csv_path}' not found.")
    df = pd.read_csv(csv_path)
    df.columns = [c.strip().lower() for c in df.columns]
    df = df.rename(columns={"rufzeichen": "callsign", "flugzeug": "aircraft", "flugzeugnummer": "aircraft_hex"})
    required = {"url", "callsign", "aircraft", "aircraft_hex"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Flight definition CSV is missing required columns: {', '.join(sorted(missing))}")
    flights: list[Dict[str, Optional[str]]] = []
    for row in df.to_dict("records"):
        flights.append(
            {
                "url": str(row.get("url", "")).strip() or None,
                "callsign": str(row.get("callsign", "")).strip() or None,
                "aircraft": str(row.get("aircraft", "")).strip() or None,
                "aircraft_hex": str(row.get("aircraft_hex", "")).strip() or None,
            }
        )
    return flights

def extract_airport_from_facility(facility: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Parst die Reporting-Facility und versucht passende Airports zu finden."""
    if not facility:
        alog.debug("Facility leer -> kein Airport.")
        return None, None

    alog.debug("Facility-Rohstring: %s", facility)

    m = re.search(r"\(([^)]+)\)", facility)
    if not m:
        alog.info("Keine Klammergruppe in Facility gefunden – überspringe. (%s)", facility)
        return None, None

    raw = m.group(1)
    candidates = [
        re.sub(r"\s+", "", c.upper())
        for c in re.split(r"[\\/|]", raw)
        if c.strip()
    ]
    alog.debug("Kandidaten aus Facility: %s", candidates)

    airport, matched = resolve_airport_candidates(candidates)
    if airport:
        if airport.get("lat") is None or airport.get("lon") is None:
            alog.warning(
                "Airport '%s' gefunden, aber ohne Koordinaten in DB (icao=%s, iata=%s).",
                matched,
                airport.get("icao"),
                airport.get("iata"),
            )
        return airport, matched

    if candidates:
        alog.info("Facility geparst, aber kein Airport-Match in DB: %s", candidates)
        return None, candidates[0]

    alog.info("Facility geparst, aber keine Kandidaten extrahierbar: %s", facility)
    return None, None


def _safe_float(value: Any) -> Optional[float]:
    try:
        text = str(value).strip().replace(",", ".")
        if not text:
            return None
        return float(text)
    except Exception:
        return None


def resolve_airport_with_fallback(
    kind: str,
    df: pd.DataFrame,
    event_candidates: list[str],
    facility: Optional[str],
) -> Tuple[Optional[Dict[str, Any]], Optional[str], str, Optional[str], Dict[str, Optional[str]]]:
    """Versucht Event → Facility → Nearest (≤10 km)."""

    chosen_code: Optional[str] = None
    attempts: list[Tuple[str, Optional[str]]] = []
    history_codes: Dict[str, Optional[str]] = {"event": None, "facility": None, "nearest": None}

    facility_airport, facility_code = extract_airport_from_facility(facility)
    facility_detail = f"facility={facility}" if facility else "facility=None"
    if facility_code:
        chosen_code = facility_code
        history_codes["facility"] = select_display_code(facility_airport, facility_code) if facility_airport else select_display_code(None, facility_code)

    if event_candidates:
        airport_event, code_event = resolve_airport_candidates(event_candidates)
        detail_event = f"candidates={','.join(event_candidates)}"
        if code_event:
            chosen_code = code_event
        elif not chosen_code and event_candidates:
            chosen_code = event_candidates[0]
        if airport_event:
            history_codes["event"] = select_display_code(airport_event, code_event)
            return airport_event, chosen_code, "event", detail_event, history_codes
        history_codes["event"] = select_display_code(None, code_event) if code_event else None
        attempts.append(("event", detail_event))

    if facility_airport:
        return facility_airport, facility_code or chosen_code, "facility", facility_detail, history_codes
    attempts.append(("facility", facility_detail))

    # Nearest fallback nur wenn Koordinaten vorhanden sind
    lat_series = df.get("latitude")
    lon_series = df.get("longitude")
    lat_value = None
    lon_value = None
    if lat_series is not None and lon_series is not None and not df.empty:
        if kind == "departure":
            lat_value = _safe_float(lat_series.iloc[0])
            lon_value = _safe_float(lon_series.iloc[0])
        else:
            lat_value = _safe_float(lat_series.iloc[-1])
            lon_value = _safe_float(lon_series.iloc[-1])
    if lat_value is not None and lon_value is not None:
        nearest_airport, distance = find_nearest_airport(lat_value, lon_value, max_km=10.0)
        if nearest_airport:
            detail_nearest = f"distance_km={distance:.2f}" if distance is not None else None
            code_nearest = select_display_code(nearest_airport, None)
            history_codes["nearest"] = code_nearest
            chosen_code = chosen_code or code_nearest
            return nearest_airport, chosen_code, "nearest", detail_nearest, history_codes
        attempts.append(("nearest", f"start={lat_value},{lon_value}"))

    detail_missing = "; ".join(f"{m}:{d}" for m, d in attempts if d)
    if chosen_code:
        record_missing_code(chosen_code)
    return None, chosen_code, "missing", detail_missing or None, history_codes


def df_to_geojson(df: pd.DataFrame) -> dict:
    coords = []
    lats = df["latitude"].tolist()
    lons = df["longitude"].tolist()
    for lat, lon in zip(lats, lons):
        try:
            coords.append([float(lon), float(lat)])
        except Exception:
            continue
    props = {c: df[c].tolist() for c in df.columns if c not in ("latitude", "longitude")}
    feat = {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords}, "properties": props}
    return {"type": "FeatureCollection", "features": [feat]}

def compute_meta(df: pd.DataFrame, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    time_col = next((c for c in df.columns if c.startswith("time_")), None)
    if time_col:
        ts = pd.to_datetime(df[time_col], format="%d.%m.%Y %H:%M:%S", errors="coerce").dropna()
        if not ts.empty:
            meta["start_time_berlin"] = ts.iloc[0].strftime("%d.%m.%Y %H:%M:%S")
            meta["end_time_berlin"] = ts.iloc[-1].strftime("%d.%m.%Y %H:%M:%S")
            meta["duration_seconds"] = int((ts.iloc[-1] - ts.iloc[0]).total_seconds())
    # Distanz
    from airports import haversine_km  # lokal import um Zyklen zu vermeiden
    def _safe(series):
        out = []
        for x in series.fillna("").tolist():
            try:
                out.append(float(str(x).replace(",", ".")))
            except Exception:
                pass
        return out
    lats = _safe(df["latitude"]) if "latitude" in df.columns else []
    lons = _safe(df["longitude"]) if "longitude" in df.columns else []
    if len(lats) > 1 and len(lats) == len(lons):
        segments = [haversine_km(lats[i], lons[i], lats[i+1], lons[i+1]) for i in range(len(lats)-1)]
        meta["track_length_km"] = round(sum(segments), 3)
        meta["bbox"] = {"min_lat": round(min(lats), 6), "min_lon": round(min(lons), 6),
                        "max_lat": round(max(lats), 6), "max_lon": round(max(lons), 6)}
    # einfache Stats
    def _nums(series, caster=float):
        vals = []
        for item in series.fillna("").tolist():
            try: vals.append(caster(str(item)))
            except Exception: pass
        return vals
    if "speed_kts" in df.columns:
        s = _nums(df["speed_kts"], int)
        if s: meta.update(speed_kts_min=min(s), speed_kts_max=max(s), speed_kts_avg=round(sum(s)/len(s),1))
    if "altitude_ft" in df.columns:
        a = _nums(df["altitude_ft"], int)
        if a: meta.update(altitude_ft_min=min(a), altitude_ft_max=max(a), altitude_ft_avg=int(round(sum(a)/len(a))))
    if "vertical_rate_fpm" in df.columns:
        r = _nums(df["vertical_rate_fpm"], float)
        if r: meta.update(vertical_rate_fpm_min=round(min(r),1), vertical_rate_fpm_max=round(max(r),1), vertical_rate_fpm_avg=round(sum(r)/len(r),1))
    meta["points"] = int(len(df))
    if extra: meta.update(extra)
    return meta

def base_flight_name(callsign: str, date_label: str, dep: str, arr: str) -> str:
    return f"{callsign}_{date_label}_{dep}_{arr}"

def aircraft_page_url_from_flight_url(flight_url: str) -> str:
    # alles ab /history abschneiden
    cut = flight_url.split("/history", 1)[0]
    return cut

def main() -> None:
    ensure_dirs()
    flights = load_flight_plan(URLS_CSV)

    flight_idx = read_json(FLIGHT_DOWNLOAD_LOG)
    aircraft_idx = read_json(AIRCRAFT_DOWNLOAD_LOG)

    for f in flights:
        url = f.get("url")
        if not url:
            continue

        callsign = (f.get("callsign") or "UNKNOWN").upper()
        date_match = re.search(r"/history/(\d{8})/", url)
        date_token = date_match.group(1) if date_match else None
        log.info(
            "flight start callsign=%s date=%s url=%s",
            callsign,
            date_token or "unknown",
            url,
        )

        # 1) Tracklog laden
        html_path, src_state_track = get_cached(url, FLIGHT_DOWNLOAD_LOG, FLIGHTS_BASE / "_raw")
        if not html_path:
            log.warning("%s – Tracklog nicht ladbar (HTTP/Cache-Fehler)", callsign)
            continue
        html = html_path.read_text(encoding="utf-8")

        # 2) Tracklog parsen
        try:
            df = parse_tracklog_table(html, url)
        except Exception as exc:
            log.warning("%s – Tracklog-Parsing fehlgeschlagen: %s", callsign, exc)
            continue

        event_airports = extract_event_airports(html)
        dep_event_candidates = event_airports.get("departure", [])
        arr_event_candidates = event_airports.get("arrival", [])

        time_col = next((c for c in df.columns if c.startswith("time_")), None)
        first_time = None
        last_time = None
        if time_col and time_col in df.columns:
            times = df[time_col].dropna()
            if not times.empty:
                first_time = str(times.iloc[0])
                last_time = str(times.iloc[-1])
        log.info(
            "tracklog summary callsign=%s points=%d first_time=%s last_time=%s",
            callsign,
            len(df),
            first_time or "none",
            last_time or "none",
        )

        # Facilities -> (mögliche) Airports
        facilities = []
        if "reporting_facility" in df.columns:
            for val in df["reporting_facility"].tolist():
                if isinstance(val, str) and val and "surface" not in val.lower():
                    facilities.append(val)
        dep_fac = facilities[0] if facilities else None
        arr_fac = facilities[-1] if facilities else None
        dep_airport, dep_raw_code, dep_method, dep_detail, dep_history = resolve_airport_with_fallback(
            "departure", df, dep_event_candidates, dep_fac
        )
        arr_airport, arr_raw_code, arr_method, arr_detail, arr_history = resolve_airport_with_fallback(
            "arrival", df, arr_event_candidates, arr_fac
        )

        log_airport_resolution(
            kind="departure",
            method=dep_method,
            code=select_display_code(dep_airport, dep_raw_code),
            detail=dep_detail,
        )
        log_airport_resolution(
            kind="arrival",
            method=arr_method,
            code=select_display_code(arr_airport, arr_raw_code),
            detail=arr_detail,
        )

        # 3) Aircraft-Seite
        ac_url = aircraft_page_url_from_flight_url(url)
        ac_html_path, src_state_ac = get_cached(
            ac_url, AIRCRAFT_DOWNLOAD_LOG, AIRCRAFTS_BASE
        )
        if ac_html_path:
            log.debug(
                "Aircraft-Seite %s (%s)",
                callsign,
                "CACHE" if src_state_ac == "cache" else "DOWNLOAD",
            )
        else:
            log.warning("%s – Aircraft-Seite nicht ladbar", callsign)
        ac_html = ac_html_path.read_text(encoding="utf-8") if ac_html_path else ""
        ac_info = (
            extract_aircraft_info(ac_html)
            if ac_html
            else {
                "aircraft_type": None,
                "operator": None,
            }
        )

        log.info(
            "aircraft info summary callsign=%s type=%s operator=%s",
            callsign,
            ac_info.get("aircraft_type"),
            ac_info.get("operator"),
        )

        # 4) Ausgabeverzeichnis & Artefakte
        # Datum aus URL
        if date_match:
            date_label = datetime.strptime(date_match.group(1), "%Y%m%d").strftime("%d%m%Y")
        else:
            date_label = datetime.now(TARGET_TZ).strftime("%d%m%Y")

        dep_code = select_display_code(dep_airport, dep_raw_code)
        arr_code = select_display_code(arr_airport, arr_raw_code)

        dep_missing_key = dep_code if dep_code != "UNK" else dep_raw_code
        arr_missing_key = arr_code if arr_code != "UNK" else arr_raw_code
        update_missing_registry(dep_missing_key, dep_airport)
        update_missing_registry(arr_missing_key, arr_airport)

        facility_dep_code = dep_history.get("facility")
        if facility_dep_code and facility_dep_code != dep_code and dep_airport and dep_airport.get("lat") is not None and dep_airport.get("lon") is not None and dep_airport.get("icao") and dep_airport.get("iata"):
            remove_missing_code(facility_dep_code)
        facility_arr_code = arr_history.get("facility")
        if facility_arr_code and facility_arr_code != arr_code and arr_airport and arr_airport.get("lat") is not None and arr_airport.get("lon") is not None and arr_airport.get("icao") and arr_airport.get("iata"):
            remove_missing_code(facility_arr_code)

        dep_cleanup_codes = {code for code in dep_history.values() if code}
        dep_cleanup_codes.add(dep_code)
        dep_cleanup_codes.add("UNK")
        arr_cleanup_codes = {code for code in arr_history.values() if code}
        arr_cleanup_codes.add(arr_code)
        arr_cleanup_codes.add("UNK")

        base_name = base_flight_name(callsign, date_label, dep_code, arr_code)
        flight_dir = FLIGHTS_BASE / base_name
        flight_dir.mkdir(parents=True, exist_ok=True)

        # Roh-HTML des Tracklogs in den Flugordner kopieren
        final_html_path = flight_dir / f"{base_name}.html"
        if html_path.resolve() != final_html_path.resolve():
            shutil.copyfile(html_path, final_html_path)

        # CSV
        csv_path = flight_dir / f"{base_name}.csv"
        df.to_csv(csv_path, sep=";", index=False, encoding="utf-8")

        # GEOJSON
        geojson = df_to_geojson(df)
        (flight_dir / f"{base_name}.geojson").write_text(
            __import__("json").dumps(geojson, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        # META (+ Aircraft-Infos + Fallback-Airports)
        extra_meta = {
            "callsign": callsign,
            "aircraft_registration": f.get("aircraft"),
            "aircraft_hex": f.get("aircraft_hex"),
            "source_url": url,
            "aircraft_page_url": ac_url,
            "aircraft_type": ac_info.get("aircraft_type"),
            "operator": ac_info.get("operator"),
            "reporting_facility_departure": dep_fac,
            "reporting_facility_arrival": arr_fac,
            "departure_airport": dep_airport,
            "arrival_airport": arr_airport,
            "departure_airport_resolution": dep_method,
            "arrival_airport_resolution": arr_method,
        }
        meta = compute_meta(df, extra=extra_meta)
        (flight_dir / f"{base_name}.meta.json").write_text(
            __import__("json").dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        # 5) Kompakter Output (1 Zeile)
        src_tag = f"{'C' if src_state_track == 'cache' else 'D'}/{'C' if src_state_ac == 'cache' else 'D'}"
        length_km = meta.get("track_length_km")
        pts = meta.get("points")
        ac_type = (ac_info.get("aircraft_type") or "?").split("(")[0].strip()
        operator = ac_info.get("operator") or "?"
        print(
            f"✅ {callsign} {date_label} {dep_code}→{arr_code} pts={pts} dist={length_km or 0:.1f}km type={ac_type} op={operator} src={src_tag}"
        )

        # Zusatz: wenn etwas fehlt, kurze INFO statt 'stummem ?'
        if ac_info.get("aircraft_type") is None or ac_info.get("operator") is None:
            log.info(
                "%s – Aircraft-Details unvollständig (type=%s, operator=%s) – Quelle: %s",
                callsign,
                ac_info.get("aircraft_type"),
                ac_info.get("operator"),
                "CACHE" if src_state_ac == "cache" else "DOWNLOAD",
            )

        # Entferne Alt-Ordner mit früheren (Fallback-)Codes
        legacy_bases = {
            base_flight_name(callsign, date_label, dep_alt, arr_alt)
            for dep_alt in dep_cleanup_codes
            for arr_alt in arr_cleanup_codes
            if not (dep_alt == dep_code and arr_alt == arr_code)
        }
        for legacy_base in legacy_bases:
            legacy_dir = FLIGHTS_BASE / legacy_base
            if legacy_dir.exists():
                shutil.rmtree(legacy_dir)

if __name__ == "__main__":
    main()
