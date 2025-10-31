import json
import os
import re
import shutil
from datetime import datetime
from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse, unquote

import pandas as pd
import requests
from bs4 import BeautifulSoup
from dateutil import tz
from zoneinfo import ZoneInfo

try:
    from airportsdata import load as load_airports
except ImportError as exc:  # pragma: no cover - fail fast if dependency missing
    raise SystemExit(
        "The 'airportsdata' package is required. Install it via 'pip install airportsdata'."
    ) from exc


# ===================== Konfiguration =====================
TARGET_TZ = ZoneInfo("Europe/Berlin")
EXPORT_BASE = "./export"
URLS_CSV = "flights.csv"
DOWNLOAD_LOG_PATH = os.path.join(EXPORT_BASE, "downloads.json")
CACHE_DIR = os.path.join(EXPORT_BASE, "_cache")

# Abkürzung -> IANA-TZ (stabil & eindeutig)
ABBR_TO_IANA = {
    "EDT": "America/New_York",
    "EST": "America/New_York",
    "CDT": "America/Chicago",
    "CST": "America/Chicago",
    "MDT": "America/Denver",
    "MST": "America/Denver",
    "PDT": "America/Los_Angeles",
    "PST": "America/Los_Angeles",
    "CET": "Europe/Berlin",
    "CEST": "Europe/Berlin",
    "GMT": "Europe/London",
    "BST": "Europe/London",
    "WET": "Europe/Lisbon",
    "WEST": "Europe/Lisbon",
    "EET": "Europe/Helsinki",
    "EEST": "Europe/Helsinki",
    "UTC": "UTC",
    "Z": "UTC",
}

# Flughafendaten vorab laden
AIRPORTS_ICAO = load_airports("ICAO")
AIRPORTS_IATA = load_airports("IATA")


# ===================== Hilfsfunktionen =====================
def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def visible_text(cell) -> str:
    """Bevorzuge sichtbare Spans (show-for-*), sonst gesamter Text. Immer als String."""
    show_span = cell.select_one('span[class*="show-for-"]')
    return show_span.get_text(strip=True) if show_span else cell.get_text(" ", strip=True)


def parse_url_date(url: str) -> datetime:
    """YYYYMMDD aus der URL (/history/20251027/...) extrahieren; Fallback: UTC-heute."""
    match = re.search(r"/history/(\d{8})/", url)
    return datetime.strptime(match.group(1), "%Y%m%d") if match else datetime.utcnow()


def find_col(raw_headers, prefix: str) -> Optional[int]:
    """Index der ersten Header-Spalte, deren Text mit prefix beginnt (z. B. 'Time')."""
    for i, header in enumerate(raw_headers):
        if header.strip().startswith(prefix):
            return i
    return None


def resolve_source_tz_from_header(raw_headers):
    """Liest 'Time (XXX)' aus den rohen Headern und liefert passende Zeitzone (dateutil)."""
    label = None
    for header in raw_headers:
        if header.strip().startswith("Time"):
            match = re.search(r"\(([^)]+)\)", header)
            if match:
                label = match.group(1).strip().upper()
            break
    name = ABBR_TO_IANA.get(label, "UTC")
    return tz.gettz(name)


def clean_course(value: str) -> str:
    """Nur Gradzahl: '↙ 222°' -> '222'."""
    match = re.search(r"(-?\d+)\s*°", value)
    return match.group(1) if match else value.strip()


def clean_integer_like(value: str) -> str:
    """Nur Vorzeichen + Ziffern behalten. '1,100'/'12.345' -> '1100'/'12345'."""
    return re.sub(r"[^\d\-]", "", value)


def clean_rate(value: str) -> str:
    """
    'Rate' formatieren:
    - Ein Komma + 3 Ziffern am Ende => Tausender-Komma entfernen.
    - Sonst: Punkte als Tausender entfernen, Komma -> Punkt (dezimal).
    Ergebnis: String mit Dezimalpunkt.
    """
    cleaned = value.strip()
    if not cleaned:
        return cleaned
    if cleaned.count(",") == 1 and re.search(r",\d{3}$", cleaned):
        return cleaned.replace(",", "")
    cleaned = cleaned.replace(".", "")
    cleaned = cleaned.replace(",", ".")
    return cleaned


def rename_headers(raw_headers: list[str]) -> list[str]:
    """Snake_case, erklärende Namen; Zeitspalte enthält Ziel-TZ im Namen."""
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


def slug_from_url(url: str) -> str:
    """
    Logischen Basisnamen aus der URL bauen (ohne Erweiterung).
    Beispiele:
      UNI132_20251027_1630Z_EHAM_EDDK
      UNI132_20251027_1250Z
      UNI132_20251027_0942Z_EDDK_L_38.21436_13.20616
    """
    path = unquote(urlparse(url).path)
    parts = [part for part in path.split("/") if part]

    try:
        live_index = parts.index("live")
        flight = parts[live_index + 2] if parts[live_index + 1] == "flight" else "FLIGHT"
    except ValueError:
        flight = "FLIGHT"

    try:
        hist_index = parts.index("history")
        date_str = parts[hist_index + 1] if len(parts) > hist_index + 1 else "DATE"
        timez = parts[hist_index + 2] if len(parts) > hist_index + 2 else "TIMEZ"
        optionals = []
        for part in parts[hist_index + 3 :]:
            if part == "tracklog":
                break
            optionals.append(part)
    except ValueError:
        date_str, timez, optionals = "DATE", "TIMEZ", []

    components = [flight, date_str, timez] + optionals
    safe = re.sub(r"[^0-9A-Za-z._-]+", "_", "_".join(components)).strip("_")
    return safe


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Großkreisdistanz zwischen zwei WGS84-Punkten in Kilometern."""
    la1, lo1, la2, lo2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = sin(dlat / 2) ** 2 + cos(la1) * cos(la2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    earth_radius_km = 6371.0088
    return earth_radius_km * c


def load_flight_plan(csv_path: str) -> list[Dict[str, Optional[str]]]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Flight definition CSV '{csv_path}' not found.")

    df = pd.read_csv(csv_path)
    df.columns = [col.strip().lower() for col in df.columns]

    rename_map = {
        "rufzeichen": "callsign",
        "flugzeug": "aircraft",
        "flugzeugnummer": "aircraft_hex",
    }
    df = df.rename(columns=rename_map)

    required = {"url", "callsign", "aircraft", "aircraft_hex"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Flight definition CSV is missing required columns: {', '.join(sorted(missing))}"
        )

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


def load_download_log(path: str) -> Dict[str, str]:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            return {str(key): str(value) for key, value in data.items()}
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_download_log(path: str, payload: Dict[str, str]) -> None:
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def ensure_html(url: str, downloads: Dict[str, str]) -> Optional[str]:
    existing_path = downloads.get(url)
    if existing_path and os.path.exists(existing_path):
        return existing_path

    ensure_dir(CACHE_DIR)
    target_path = os.path.join(CACHE_DIR, f"{slug_from_url(url)}.html")
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    if resp.status_code != 200:
        print(f"Fehler {resp.status_code} bei {url}")
        return None
    with open(target_path, "w", encoding="utf-8") as handle:
        handle.write(resp.text)
    downloads[url] = target_path
    save_download_log(DOWNLOAD_LOG_PATH, downloads)
    return target_path


def lookup_airport(code: str) -> Optional[Dict[str, Any]]:
    if not code:
        return None
    code_upper = code.upper()
    return AIRPORTS_ICAO.get(code_upper) or AIRPORTS_IATA.get(code_upper)


def normalize_airport_record(record: Optional[Dict[str, Any]], code: str) -> Dict[str, Any]:
    record = record or {}
    code_upper = code.upper()
    result = {
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
    return result


def extract_airport_from_facility(facility: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    if not facility:
        return None, None

    match = re.search(r"\(([^)]+)\)", facility)
    if not match:
        return None, None

    raw = match.group(1)
    candidates = [
        re.sub(r"\s+", "", candidate.upper())
        for candidate in re.split(r"[\\/|]", raw)
        if candidate.strip()
    ]
    for candidate in candidates:
        record = lookup_airport(candidate)
        if record:
            return normalize_airport_record(record, candidate), candidate

    if candidates:
        fallback = candidates[0]
        return normalize_airport_record(None, fallback), fallback

    return None, None


def select_display_code(info: Optional[Dict[str, Any]], fallback: Optional[str]) -> str:
    if info and info.get("iata"):
        return re.sub(r"[^0-9A-Z]", "", info["iata"].upper()) or "UNK"
    if info and info.get("icao"):
        return re.sub(r"[^0-9A-Z]", "", info["icao"].upper()) or "UNK"
    if fallback:
        return re.sub(r"[^0-9A-Z]", "", fallback.upper()) or "UNK"
    return "UNK"


def compute_meta(df: pd.DataFrame, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Meta-Statistiken aus dem DataFrame berechnen."""
    meta: Dict[str, Any] = {}

    time_col = next((col for col in df.columns if col.startswith("time_")), None)
    if time_col:
        timestamps = pd.to_datetime(df[time_col], format="%d.%m.%Y %H:%M:%S", errors="coerce")
        valid = timestamps.dropna()
        if not valid.empty:
            meta["start_time_berlin"] = valid.iloc[0].strftime("%d.%m.%Y %H:%M:%S")
            meta["end_time_berlin"] = valid.iloc[-1].strftime("%d.%m.%Y %H:%M:%S")
            meta["duration_seconds"] = int((valid.iloc[-1] - valid.iloc[0]).total_seconds())
        else:
            meta["start_time_berlin"] = meta["end_time_berlin"] = None
            meta["duration_seconds"] = None

    try:
        lats = df["latitude"].astype(float).tolist()
        lons = df["longitude"].astype(float).tolist()
        if len(lats) > 1:
            segments = [
                haversine_km(lats[i], lons[i], lats[i + 1], lons[i + 1]) for i in range(len(lats) - 1)
            ]
        else:
            segments = []
        meta["track_length_km"] = round(sum(segments), 3)
        if lats and lons:
            meta["bbox"] = {
                "min_lat": round(min(lats), 6),
                "min_lon": round(min(lons), 6),
                "max_lat": round(max(lats), 6),
                "max_lon": round(max(lons), 6),
            }
    except Exception:
        meta["track_length_km"] = None

    def _safe_num(series, caster=float):
        values = []
        for item in series.fillna("").tolist():
            try:
                values.append(caster(str(item)))
            except Exception:
                continue
        return values

    if "speed_kts" in df.columns:
        speed = _safe_num(df["speed_kts"], int)
        if speed:
            meta["speed_kts_min"] = int(min(speed))
            meta["speed_kts_max"] = int(max(speed))
            meta["speed_kts_avg"] = round(sum(speed) / len(speed), 1)

    if "speed_mph" in df.columns:
        speed = _safe_num(df["speed_mph"], int)
        if speed:
            meta["speed_mph_min"] = int(min(speed))
            meta["speed_mph_max"] = int(max(speed))
            meta["speed_mph_avg"] = round(sum(speed) / len(speed), 1)

    if "altitude_ft" in df.columns:
        altitude = _safe_num(df["altitude_ft"], int)
        if altitude:
            meta["altitude_ft_min"] = int(min(altitude))
            meta["altitude_ft_max"] = int(max(altitude))
            meta["altitude_ft_avg"] = int(round(sum(altitude) / len(altitude)))

    if "vertical_rate_fpm" in df.columns:
        rate = _safe_num(df["vertical_rate_fpm"], float)
        if rate:
            meta["vertical_rate_fpm_min"] = round(min(rate), 1)
            meta["vertical_rate_fpm_max"] = round(max(rate), 1)
            meta["vertical_rate_fpm_avg"] = round(sum(rate) / len(rate), 1)

    meta["points"] = int(len(df))

    if extra:
        meta.update(extra)

    return meta


def df_to_geojson(df: pd.DataFrame) -> dict:
    """
    GeoJSON-Feature mit LineString erzeugen.
    - geometry: LineString (lon/lat)
    - properties: Arrays aller übrigen Spalten (z. B. Zeit, Höhe, Speed, Course ...)
    """
    coords = []
    lats = df["latitude"].tolist()
    lons = df["longitude"].tolist()
    for lat, lon in zip(lats, lons):
        try:
            coords.append([float(lon), float(lat)])
        except Exception:
            continue

    props = {col: df[col].tolist() for col in df.columns if col not in ("latitude", "longitude")}

    feature = {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": props,
    }
    return {"type": "FeatureCollection", "features": [feature]}


def main() -> None:
    ensure_dir(EXPORT_BASE)
    flights = load_flight_plan(URLS_CSV)
    downloads = load_download_log(DOWNLOAD_LOG_PATH)

    for flight in flights:
        url = flight.get("url")
        if not url:
            print("Überspringe Eintrag ohne URL.")
            continue

        html_path = ensure_html(url, downloads)
        if not html_path:
            continue

        with open(html_path, "r", encoding="utf-8") as handle:
            html_content = handle.read()

        soup = BeautifulSoup(html_content, "html.parser")
        table = soup.find("table", id="tracklogTable")
        if not table:
            print(f"Warnung: Keine Tabelle gefunden für {url}")
            continue

        header_row = table.find("tr")
        raw_headers = [visible_text(th) for th in header_row.find_all("th")] if header_row else []
        if not raw_headers:
            print(f"Warnung: Kein Header gefunden für {url}")
            continue

        src_tz = resolve_source_tz_from_header(raw_headers)
        cols = rename_headers(raw_headers)

        time_index = find_col(raw_headers, "Time")
        course_index = find_col(raw_headers, "Course")
        feet_index = find_col(raw_headers, "feet")
        rate_index = find_col(raw_headers, "Rate")
        kts_index = find_col(raw_headers, "kts")
        mph_index = find_col(raw_headers, "mph")

        date_from_url = parse_url_date(url)
        records = []

        for row in table.find_all("tr"):
            if "flight_event" in row.get("class", []):
                continue
            cells = row.find_all("td")
            if not cells:
                continue

            values = [visible_text(td) for td in cells]
            if len(values) != len(raw_headers):
                continue

            cleaned = values[:]

            if time_index is not None:
                try:
                    naive = datetime.strptime(cleaned[time_index], "%a %I:%M:%S %p")
                    source_time = datetime(
                        date_from_url.year,
                        date_from_url.month,
                        date_from_url.day,
                        naive.hour,
                        naive.minute,
                        naive.second,
                        tzinfo=src_tz,
                    )
                    local_time = source_time.astimezone(TARGET_TZ)
                    cleaned[time_index] = local_time.strftime("%d.%m.%Y %H:%M:%S")
                except Exception:
                    pass

            if course_index is not None:
                cleaned[course_index] = clean_course(cleaned[course_index])

            if feet_index is not None:
                cleaned[feet_index] = clean_integer_like(cleaned[feet_index])
            for idx in (kts_index, mph_index):
                if idx is not None:
                    cleaned[idx] = clean_integer_like(cleaned[idx])

            if rate_index is not None:
                cleaned[rate_index] = clean_rate(cleaned[rate_index])

            records.append(dict(zip(cols, cleaned)))

        if not records:
            print(f"Warnung: Keine Datenzeilen für {url}")
            continue

        df = pd.DataFrame.from_records(records)
        time_col = next((col for col in df.columns if col.startswith("time_")), None)
        if time_col:
            order = pd.to_datetime(df[time_col], format="%d.%m.%Y %H:%M:%S", errors="coerce")
            df = df.loc[order.sort_values().index].reset_index(drop=True)

        facilities = []
        if "reporting_facility" in df.columns:
            for value in df["reporting_facility"].tolist():
                if isinstance(value, str) and value and "surface" not in value.lower():
                    facilities.append(value)
        departure_facility = facilities[0] if facilities else None
        arrival_facility = facilities[-1] if facilities else None

        departure_airport, departure_code = extract_airport_from_facility(departure_facility)
        arrival_airport, arrival_code = extract_airport_from_facility(arrival_facility)

        date_label = date_from_url.strftime("%d%m%Y")
        callsign = (flight.get("callsign") or slug_from_url(url).split("_")[0] or "UNKNOWN").upper()
        aircraft = flight.get("aircraft")
        aircraft_hex = flight.get("aircraft_hex")

        dep_code_for_dir = select_display_code(departure_airport, departure_code)
        arr_code_for_dir = select_display_code(arrival_airport, arrival_code)

        base_name = f"{callsign}_{date_label}_{dep_code_for_dir}_{arr_code_for_dir}"
        flight_dir = os.path.join(EXPORT_BASE, base_name)
        ensure_dir(flight_dir)

        final_html_path = os.path.join(flight_dir, f"{base_name}.html")
        if os.path.abspath(html_path) != os.path.abspath(final_html_path):
            shutil.copyfile(html_path, final_html_path)
            html_abs = os.path.abspath(html_path)
            cache_abs = os.path.abspath(CACHE_DIR)
            if os.path.exists(html_path) and os.path.commonpath([html_abs, cache_abs]) == cache_abs:
                os.remove(html_path)
            downloads[url] = final_html_path
        else:
            downloads[url] = final_html_path
        save_download_log(DOWNLOAD_LOG_PATH, downloads)

        csv_path = os.path.join(flight_dir, f"{base_name}.csv")
        df.to_csv(csv_path, sep=";", index=False, encoding="utf-8")

        geojson_obj = df_to_geojson(df)
        geojson_path = os.path.join(flight_dir, f"{base_name}.geojson")
        with open(geojson_path, "w", encoding="utf-8") as handle:
            json.dump(geojson_obj, handle, ensure_ascii=False, indent=2)

        extra_meta = {
            "callsign": flight.get("callsign") or callsign,
            "aircraft_registration": aircraft,
            "aircraft_hex": aircraft_hex,
            "source_url": url,
            "reporting_facility_departure": departure_facility,
            "reporting_facility_arrival": arrival_facility,
            "departure_airport": departure_airport,
            "arrival_airport": arrival_airport,
        }

        meta = compute_meta(df, extra=extra_meta)
        meta_path = os.path.join(flight_dir, f"{base_name}.meta.json")
        with open(meta_path, "w", encoding="utf-8") as handle:
            json.dump(meta, handle, ensure_ascii=False, indent=2)

        print(f"✅ Export für {url}")
        print(f"   Ordner: {flight_dir}")
        print(f"   HTML:   {final_html_path}")
        print(f"   CSV:    {csv_path}")
        print(f"   GEOJSON:{geojson_path}")
        print(f"   META:   {meta_path}")


if __name__ == "__main__":
    main()
