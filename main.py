import os
import re
import json
from math import radians, sin, cos, asin, sqrt
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse, unquote

import requests
from bs4 import BeautifulSoup
import pandas as pd
from dateutil import tz


# ===================== Konfiguration =====================
urls = ['https://www.flightaware.com/live/flight/UNI132/history/20251029/1752Z/EGCC/EGGW/tracklog', "https://www.flightaware.com/live/flight/UNI132/history/20251027/0942Z/EDDK/L%2038.21436%2013.20616/tracklog"]



TARGET_TZ = ZoneInfo("Europe/Berlin")  # Ziel: Berliner Zeit
EXPORT_BASE = "./export"

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
    "Z":   "UTC",
}


# ===================== Hilfsfunktionen =====================
def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def visible_text(cell) -> str:
    """Bevorzuge sichtbare Spans (show-for-*), sonst gesamter Text. Immer als String."""
    show_span = cell.select_one('span[class*="show-for-"]')
    return show_span.get_text(strip=True) if show_span else cell.get_text(" ", strip=True)


def parse_url_date(url: str) -> datetime:
    """YYYYMMDD aus der URL (/history/20251027/...) extrahieren; Fallback: UTC-heute."""
    m = re.search(r"/history/(\d{8})/", url)
    return datetime.strptime(m.group(1), "%Y%m%d") if m else datetime.utcnow()


def find_col(raw_headers, prefix: str) -> int | None:
    """Index der ersten Header-Spalte, deren Text mit prefix beginnt (z. B. 'Time')."""
    for i, h in enumerate(raw_headers):
        if h.strip().startswith(prefix):
            return i
    return None


def resolve_source_tz_from_header(raw_headers):
    """Liest 'Time (XXX)' aus den rohen Headern und liefert passende Zeitzone (dateutil)."""
    label = None
    for h in raw_headers:
        if h.strip().startswith("Time"):
            m = re.search(r"\(([^)]+)\)", h)
            if m:
                label = m.group(1).strip().upper()
            break
    name = ABBR_TO_IANA.get(label, "UTC")
    return tz.gettz(name)


def clean_course(value: str) -> str:
    """Nur Gradzahl: '↙ 222°' -> '222'."""
    m = re.search(r"(-?\d+)\s*°", value)
    return m.group(1) if m else value.strip()


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
    v = value.strip()
    if not v:
        return v
    if v.count(",") == 1 and re.search(r",\d{3}$", v):
        return v.replace(",", "")
    v = v.replace(".", "")
    v = v.replace(",", ".")
    return v


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
    out = []
    for h in raw_headers:
        base = h.split("(")[0].strip() if "(" in h and ")" in h else h.strip()
        out.append(mapping.get(base, re.sub(r"\W+", "_", base.lower()).strip("_")))
    return out


def slug_from_url(url: str) -> str:
    """
    Logischen Basisnamen aus der URL bauen (ohne Erweiterung).
    Beispiele:
      UNI132_20251027_1630Z_EHAM_EDDK
      UNI132_20251027_1250Z
      UNI132_20251027_0942Z_EDDK_L_38.21436_13.20616
    """
    path = unquote(urlparse(url).path)  # dekodiert %20 etc.
    parts = [p for p in path.split("/") if p]

    # flight
    try:
        i_live = parts.index("live")
        flight = parts[i_live + 2] if parts[i_live + 1] == "flight" else "FLIGHT"
    except ValueError:
        flight = "FLIGHT"

    # history block
    try:
        i_hist = parts.index("history")
        date_str = parts[i_hist + 1] if len(parts) > i_hist + 1 else "DATE"
        timez   = parts[i_hist + 2] if len(parts) > i_hist + 2 else "TIMEZ"
        optionals = []
        for p in parts[i_hist + 3:]:
            if p == "tracklog":
                break
            optionals.append(p)
    except ValueError:
        date_str, timez, optionals = "DATE", "TIMEZ", []

    components = [flight, date_str, timez] + optionals
    safe = re.sub(r"[^0-9A-Za-z._-]+", "_", "_".join(components)).strip("_")
    return safe


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Großkreisdistanz zwischen zwei WGS84-Punkten in Kilometern."""
    # Koordinaten in Radiant
    la1, lo1, la2, lo2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = la2 - la1
    dlon = lo2 - lo1
    a = sin(dlat / 2) ** 2 + cos(la1) * cos(la2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    R = 6371.0088  # mittlerer Erdradius in km
    return R * c


def compute_meta(df: pd.DataFrame) -> dict:
    """Meta-Statistiken aus dem DataFrame berechnen."""
    meta = {}

    # Zeitspalte finden und in datetime parsen
    time_col = next((c for c in df.columns if c.startswith("time_")), None)
    if time_col:
        t = pd.to_datetime(df[time_col], format="%d.%m.%Y %H:%M:%S", errors="coerce")
        t_valid = t.dropna()
        if not t_valid.empty:
            meta["start_time_berlin"] = t_valid.iloc[0].strftime("%d.%m.%Y %H:%M:%S")
            meta["end_time_berlin"] = t_valid.iloc[-1].strftime("%d.%m.%Y %H:%M:%S")
            meta["duration_seconds"] = int((t_valid.iloc[-1] - t_valid.iloc[0]).total_seconds())
        else:
            meta["start_time_berlin"] = meta["end_time_berlin"] = None
            meta["duration_seconds"] = None

    # Koordinaten & Länge
    try:
        lats = df["latitude"].astype(float).tolist()
        lons = df["longitude"].astype(float).tolist()
        segs = [
            haversine_km(lats[i], lons[i], lats[i + 1], lons[i + 1])
            for i in range(len(lats) - 1)
        ] if len(lats) > 1 else []
        meta["track_length_km"] = round(sum(segs), 3)
        if lats and lons:
            meta["bbox"] = {
                "min_lat": round(min(lats), 6),
                "min_lon": round(min(lons), 6),
                "max_lat": round(max(lats), 6),
                "max_lon": round(max(lons), 6),
            }
    except Exception:
        meta["track_length_km"] = None

    # Geschwindigkeiten / Höhe / Steigrate
    def _safe_num(series, cast=float):
        vals = []
        for x in series.fillna("").tolist():
            try:
                vals.append(cast(str(x)))
            except Exception:
                pass
        return vals

    if "speed_kts" in df.columns:
        v = _safe_num(df["speed_kts"], int)
        if v:
            meta["speed_kts_min"] = int(min(v))
            meta["speed_kts_max"] = int(max(v))
            meta["speed_kts_avg"] = round(sum(v)/len(v), 1)

    if "speed_mph" in df.columns:
        v = _safe_num(df["speed_mph"], int)
        if v:
            meta["speed_mph_min"] = int(min(v))
            meta["speed_mph_max"] = int(max(v))
            meta["speed_mph_avg"] = round(sum(v)/len(v), 1)

    if "altitude_ft" in df.columns:
        v = _safe_num(df["altitude_ft"], int)
        if v:
            meta["altitude_ft_min"] = int(min(v))
            meta["altitude_ft_max"] = int(max(v))
            meta["altitude_ft_avg"] = int(round(sum(v)/len(v)))

    if "vertical_rate_fpm" in df.columns:
        # Rate ist als String mit Punkt als Dezimaltrennzeichen
        v = _safe_num(df["vertical_rate_fpm"], float)
        if v:
            meta["vertical_rate_fpm_min"] = round(min(v), 1)
            meta["vertical_rate_fpm_max"] = round(max(v), 1)
            meta["vertical_rate_fpm_avg"] = round(sum(v)/len(v), 1)

    meta["points"] = int(len(df))
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
    for la, lo in zip(lats, lons):
        try:
            coords.append([float(lo), float(la)])  # GeoJSON: [lon, lat]
        except Exception:
            pass

    # Properties: alle Spalten als Arrays (Strings bleiben Strings)
    props = {col: df[col].tolist() for col in df.columns if col not in ("latitude", "longitude")}

    feature = {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": props,
    }
    return {"type": "FeatureCollection", "features": [feature]}


# ===================== Hauptlogik =====================
for url in urls:
    # Ordner vorbereiten
    base_name = slug_from_url(url)
    flight_dir = os.path.join(EXPORT_BASE, base_name)
    ensure_dir(flight_dir)

    # HTML laden & speichern
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    if resp.status_code != 200:
        print(f"Fehler {resp.status_code} bei {url}")
        continue
    html_path = os.path.join(flight_dir, f"{base_name}.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(resp.text)

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", id="tracklogTable")
    if not table:
        print(f"Warnung: Keine Tabelle gefunden für {url}")
        continue

    # Header (sichtbar)
    header_row = table.find("tr")
    raw_headers = [visible_text(th) for th in header_row.find_all("th")] if header_row else []
    if not raw_headers:
        print(f"Warnung: Kein Header gefunden für {url}")
        continue

    # Quell-TZ & Spaltennamen
    src_tz = resolve_source_tz_from_header(raw_headers)
    cols = rename_headers(raw_headers)

    # Indizes
    time_i   = find_col(raw_headers, "Time")
    course_i = find_col(raw_headers, "Course")
    feet_i   = find_col(raw_headers, "feet")
    rate_i   = find_col(raw_headers, "Rate")
    kts_i    = find_col(raw_headers, "kts")
    mph_i    = find_col(raw_headers, "mph")

    date_from_url = parse_url_date(url)
    records = []

    # Datenzeilen parsen
    for tr in table.find_all("tr"):
        if "flight_event" in tr.get("class", []):
            continue
        tds = tr.find_all("td")
        if not tds:
            continue

        row = [visible_text(td) for td in tds]
        if len(row) != len(raw_headers):
            continue

        cleaned = row[:]

        # Zeit -> nach Berlin; Format: dd.mm.yyyy HH:MM:SS (24h)
        if time_i is not None:
            try:
                t_naive = datetime.strptime(cleaned[time_i], "%a %I:%M:%S %p")
                t_src = datetime(
                    date_from_url.year, date_from_url.month, date_from_url.day,
                    t_naive.hour, t_naive.minute, t_naive.second,
                    tzinfo=src_tz
                )
                t_local = t_src.astimezone(TARGET_TZ)
                cleaned[time_i] = t_local.strftime("%d.%m.%Y %H:%M:%S")
            except Exception:
                # Rohwert stehen lassen, falls Parsing scheitert
                pass

        # Course: nur Gradzahl
        if course_i is not None:
            cleaned[course_i] = clean_course(cleaned[course_i])

        # feet/kts/mph: nur Ziffern
        if feet_i is not None:
            cleaned[feet_i] = clean_integer_like(cleaned[feet_i])
        for i in (kts_i, mph_i):
            if i is not None:
                cleaned[i] = clean_integer_like(cleaned[i])

        # Rate
        if rate_i is not None:
            cleaned[rate_i] = clean_rate(cleaned[rate_i])

        records.append(dict(zip(cols, cleaned)))

    # === Dateien schreiben ===
    if not records:
        print(f"Warnung: Keine Datenzeilen für {url}")
        continue

    # DataFrame
    df = pd.DataFrame.from_records(records)
    # sortiere nach Zeit (wenn vorhanden)
    time_col = next((c for c in df.columns if c.startswith("time_")), None)
    if time_col:
        order = pd.to_datetime(df[time_col], format="%d.%m.%Y %H:%M:%S", errors="coerce")
        df = df.loc[order.sort_values().index].reset_index(drop=True)

    # 1) CSV (Semikolon)
    csv_path = os.path.join(flight_dir, f"{base_name}.csv")
    df.to_csv(csv_path, sep=";", index=False, encoding="utf-8")

    # 2) GeoJSON (LineString + Properties-Arrays)
    geojson_obj = df_to_geojson(df)
    geojson_path = os.path.join(flight_dir, f"{base_name}.geojson")
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson_obj, f, ensure_ascii=False, indent=2)

    # 3) Meta-JSON
    meta = compute_meta(df)
    meta_path = os.path.join(flight_dir, f"{base_name}.meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"✅ Export für {url}")
    print(f"   HTML:   {html_path}")
    print(f"   CSV:    {csv_path}")
    print(f"   GEOJSON:{geojson_path}")
    print(f"   META:   {meta_path}")
