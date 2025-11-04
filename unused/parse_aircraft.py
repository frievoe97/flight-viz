import logging
import re
from typing import Dict, Optional

from bs4 import BeautifulSoup

log = logging.getLogger(__name__)


def _normalize(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.replace("\xa0", " ").strip())


def _meta_text_candidates(soup: BeautifulSoup) -> list[str]:
    texts: list[str] = []
    if soup.title:
        texts.append(_normalize(soup.title.get_text()))
    for selector in (
        {"property": "og:title"},
        {"name": "title"},
        {"name": "twitter:description"},
    ):
        node = soup.find("meta", attrs=selector)
        if node and node.get("content"):
            texts.append(_normalize(node["content"]))
    return texts


def _operator_from_meta_titles(soup: BeautifulSoup) -> Optional[str]:
    for payload in _meta_text_candidates(soup):
        match = re.search(
            r"^[A-Z0-9\-]+?\s+([A-Za-z][A-Za-z0-9 \-']+?)\s+Flight Tracking",
            payload,
        )
        if match:
            return _normalize(match.group(1))
    for payload in _meta_text_candidates(soup):
        match = re.search(r"Track\s+([A-Za-z][A-Za-z0-9 \-']+?)\s+#?\d+", payload)
        if match:
            return _normalize(match.group(1))
    return None


def _aircraft_type_from_meta(soup: BeautifulSoup) -> Optional[str]:
    node = soup.find("meta", attrs={"name": "aircrafttype"})
    if node and node.get("content"):
        return _normalize(node["content"])
    return None


def extract_aircraft_info(html: str) -> Dict[str, Optional[str]]:
    soup = BeautifulSoup(html or "", "html.parser")
    ac_type = _aircraft_type_from_meta(soup)
    operator = _operator_from_meta_titles(soup)

    log.info(
        "aircraft info extracted type_source=meta_aircrafttype operator_source=meta_title type=%s operator=%s",
        ac_type,
        operator,
    )

    if ac_type is None:
        log.warning("Aircraft-Parser: 'Aircraft Type' nicht extrahierbar.")
    if operator is None:
        log.warning("Aircraft-Parser: 'Operator' nicht extrahierbar.")

    return {"aircraft_type": ac_type, "operator": operator}
