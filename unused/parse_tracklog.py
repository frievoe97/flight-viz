import logging
import re
from datetime import datetime
from typing import Any, Dict, Optional, Tuple, List

import pandas as pd
from bs4 import BeautifulSoup
from dateutil import tz

from config import TARGET_TZ, ABBR_TO_IANA

log = logging.getLogger(__name__)

def visible_text(cell) -> str:
    show_span = cell.select_one('span[class*="show-for-"]')
    return show_span.get_text(strip=True) if show_span else cell.get_text(" ", strip=True)

def parse_url_date(url: str) -> datetime:
    match = re.search(r"/history/(\d{8})/", url)
    return datetime.strptime(match.group(1), "%Y%m%d") if match else datetime.utcnow()


def extract_event_airports(html: str) -> Dict[str, list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    events: Dict[str, list[str]] = {}
    for row in soup.find_all("tr", class_="flight_event"):
        first_td = row.find("td")
        if not first_td:
            continue
        div = first_td.find("div")
        if not div:
            continue
        strong = div.find("strong")
        if not strong:
            continue
        text = strong.get_text(" ", strip=True)
        match = re.search(r"(Departure|Arrival)\s*\(([^)]+)\)", text, re.IGNORECASE)
        if not match:
            continue
        kind = match.group(1).lower()
        codes_segment = match.group(2)
        candidates = []
        for part in re.split(r"[\\/|]", codes_segment):
            token = re.sub(r"\s+", "", part.upper())
            if not token:
                continue
            if re.fullmatch(r"[A-Z0-9]{3,4}", token):
                candidates.append(token)
        if not candidates:
            continue
        if candidates:
            events[kind] = candidates
    return events

def find_col(raw_headers, prefix: str) -> Optional[int]:
    for i, header in enumerate(raw_headers):
        if header.strip().startswith(prefix):
            return i
    return None

def resolve_source_tz_from_header(raw_headers):
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
    match = re.search(r"(-?\d+)\s*°", value)
    return match.group(1) if match else value.strip()

def clean_integer_like(value: str) -> str:
    return re.sub(r"[^\d\-]", "", value)

def clean_rate(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        return cleaned
    if cleaned.count(",") == 1 and re.search(r",\d{3}$", cleaned):
        return cleaned.replace(",", "")
    cleaned = cleaned.replace(".", "")
    cleaned = cleaned.replace(",", ".")
    return cleaned

def rename_headers(raw_headers: List[str]) -> List[str]:
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

def parse_tracklog_table(html: str, url: str) -> pd.DataFrame:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id="tracklogTable")
    if not table:
        raise ValueError("tracklogTable nicht gefunden")

    header_row = table.find("tr")
    raw_headers = [visible_text(th) for th in header_row.find_all("th")] if header_row else []
    if not raw_headers:
        raise ValueError("Keine Header in Tracklog")

    src_tz = resolve_source_tz_from_header(raw_headers)
    cols = rename_headers(raw_headers)

    # Spaltenindizes
    time_index = find_col(raw_headers, "Time")
    course_index = find_col(raw_headers, "Course")
    feet_index = find_col(raw_headers, "feet")
    rate_index = find_col(raw_headers, "Rate")
    kts_index = find_col(raw_headers, "kts")
    date_from_url = parse_url_date(url)
    records = []
    time_conversion_success = 0

    for row in table.find_all("tr"):
        if "flight_event" in row.get("class", []):
            # print(row)
            continue
        cells = row.find_all("td")
        if not cells:
            continue
        values = [visible_text(td) for td in cells]
        if len(values) != len(raw_headers):
            continue
        cleaned = values[:]

        if time_index is not None:
            converted = False
            try:
                naive = datetime.strptime(cleaned[time_index], "%a %I:%M:%S %p")
                source_time = datetime(
                    date_from_url.year, date_from_url.month, date_from_url.day,
                    naive.hour, naive.minute, naive.second, tzinfo=src_tz,
                )
                local_time = source_time.astimezone(TARGET_TZ)
                cleaned[time_index] = local_time.strftime("%d.%m.%Y %H:%M:%S")
                converted = True
            except Exception:
                pass
            else:
                if converted:
                    time_conversion_success += 1

        if course_index is not None:
            cleaned[course_index] = clean_course(cleaned[course_index])

        if feet_index is not None:
            cleaned[feet_index] = clean_integer_like(cleaned[feet_index])
        if kts_index is not None:
            cleaned[kts_index] = clean_integer_like(cleaned[kts_index])

        if rate_index is not None:
            cleaned[rate_index] = clean_rate(cleaned[rate_index])

        records.append(dict(zip(cols, cleaned)))

    df = pd.DataFrame.from_records(records)
    if df.empty:
        raise ValueError("Keine Datenzeilen in Tracklog")

    # Zeitlich sortieren
    time_col = next((c for c in df.columns if c.startswith("time_")), None)
    if time_col:
        order = pd.to_datetime(df[time_col], format="%d.%m.%Y %H:%M:%S", errors="coerce")
        df = df.loc[order.sort_values().index].reset_index(drop=True)
    keep_columns = [c for c in [
        time_col,
        "latitude",
        "longitude",
        "course_deg_clockwise_from_north",
        "speed_kts",
        "altitude_ft",
        "vertical_rate_fpm",
        "reporting_facility",
    ] if c and c in df.columns]
    if keep_columns:
        df = df[keep_columns]

    log.info(
        "tracklog parsed url=%s columns=%s rows=%d time_converted=%d",
        url,
        ",".join(df.columns),
        len(df),
        time_conversion_success,
    )
    return df
