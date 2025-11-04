"""Parsing helpers for aircraft detail pages."""

from __future__ import annotations

import json
import logging
import re
from typing import Dict, Optional, Tuple

from bs4 import BeautifulSoup

TRACKPOLL_PATTERN = re.compile(r"var trackpollBootstrap = (\{.*?\});", re.DOTALL)

log = logging.getLogger(__name__)


def parse_aircraft_details(html: str) -> Dict[str, Optional[str]]:
    """Extract aircraft type and operator information from the aircraft page."""
    aircraft_type, aircraft_type_source = _extract_aircraft_type(html)
    operator, operator_source = _extract_operator(html)

    payload = {
        "aircraft_type": aircraft_type,
        "aircraft_type_source": aircraft_type_source,
        "operator": operator,
        "operator_source": operator_source,
    }
    log.debug("Aircraft detail parse result: %s", payload)
    return payload


def _extract_aircraft_type(html: str) -> Tuple[Optional[str], Optional[str]]:
    match = TRACKPOLL_PATTERN.search(html)
    if match:
        payload = match.group(1)
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            pass
        else:
            flights = data.get("flights", {}) or {}
            for entry in flights.values():
                aircraft = entry.get("aircraft") or {}
                friendly = (aircraft.get("friendlyType") or "").strip()
                if friendly:
                    return friendly, "trackpollBootstrap"

    regex_match = re.search(r'friendlyType":"([^"]+)"', html)
    if regex_match:
        friendly = regex_match.group(1).strip()
        if friendly:
            return friendly, "regex_friendlyType"

    return None, None


def _extract_operator(html: str) -> Tuple[Optional[str], Optional[str]]:
    soup = BeautifulSoup(html, "html.parser")

    candidates = [
        (_meta_content(soup, "title"), "meta_title"),
        (_meta_property(soup, "og:title"), "meta_og_title"),
        (_element_text(soup.title), "title_tag"),
    ]

    for value, source in candidates:
        operator = _parse_operator_from_title(value)
        if operator:
            return operator, source

    return None, None


def _meta_content(soup: BeautifulSoup, name: str) -> Optional[str]:
    tag = soup.find("meta", attrs={"name": name})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return None


def _meta_property(soup: BeautifulSoup, prop: str) -> Optional[str]:
    tag = soup.find("meta", attrs={"property": prop})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return None


def _element_text(element) -> Optional[str]:
    if element and element.string:
        text = element.string.strip()
        if text:
            return text
    return None


def _parse_operator_from_title(text: Optional[str]) -> Optional[str]:
    if not text:
        return None

    # Expect format like "UNI133 UNICAIR Flight Tracking and History - FlightAware"
    prefix, _, _ = text.partition(" Flight")
    prefix = prefix.strip()
    if not prefix:
        return None

    parts = prefix.split(" ", 1)
    if len(parts) < 2:
        return None

    operator = parts[1].strip(" -")
    return operator or None
