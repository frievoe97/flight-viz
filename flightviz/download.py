"""Downloading helpers for tracklog HTML pages."""

from __future__ import annotations

import logging
import os
import re
from typing import Optional, Tuple
from urllib.parse import unquote, urlparse

import requests
from os import fspath
from pathlib import Path

from .cache import ensure_dir, load_cache, save_cache
from .config import random_headers

log = logging.getLogger(__name__)

SECRET_PATTERNS = (
    re.compile(r'("(?:STADIA_MAPS_API_KEY|MAPBOX_API_TOKEN)"\s*:\s*")[^"]*(")'),
    re.compile(r"('(?:STADIA_MAPS_API_KEY|MAPBOX_API_TOKEN)'\s*:\s*')[^']*(')"),
    re.compile(r'(\b(?:STADIA_MAPS_API_KEY|MAPBOX_API_TOKEN)\b\s*=\s*")[^"]*(")'),
    re.compile(r"(\b(?:STADIA_MAPS_API_KEY|MAPBOX_API_TOKEN)\b\s*=\s*')[^']*(')"),
)


def sanitize_html_secrets(html: str) -> tuple[str, int]:
    """Blank known map API keys from HTML before persisting to disk."""
    sanitized = html
    replacements = 0

    for pattern in SECRET_PATTERNS:
        sanitized, count = pattern.subn(r"\1\2", sanitized)
        replacements += count

    return sanitized, replacements


def sanitize_cached_file(path: os.PathLike[str] | str) -> bool:
    """Sanitize an already cached HTML file in place."""
    file_path = Path(path)
    try:
        raw_html = file_path.read_text(encoding="utf-8")
    except OSError as exc:
        log.warning("Could not read cached file for sanitizing %s: %s", file_path, exc)
        return False

    sanitized_html, replacements = sanitize_html_secrets(raw_html)
    if replacements == 0 or sanitized_html == raw_html:
        return False

    try:
        file_path.write_text(sanitized_html, encoding="utf-8")
    except OSError as exc:
        log.warning("Could not write sanitized cache file %s: %s", file_path, exc)
        return False

    return True


def slug_from_url(url: str) -> str:
    """Return a filesystem-friendly slug for ``url``."""
    path = unquote(urlparse(url).path)
    safe = re.sub(r"[^0-9A-Za-z._/-]+", "_", path).strip("_").replace("/", "_")
    return (safe or "index").strip("_")


def download_if_needed(
    url: str,
    target_dir: os.PathLike[str] | str,
    cache_json_path: os.PathLike[str] | str,
) -> Tuple[Optional[str], str]:
    """
    Download ``url`` into ``target_dir`` unless the cache already holds it.

    Returns ``(local_path, status)`` where status is one of ``cache`` (already
    present), ``download`` (freshly fetched) or ``error``.
    """
    target_dir_fs = fspath(target_dir)
    cache_json_fs = fspath(cache_json_path)

    ensure_dir(target_dir_fs)
    cache = load_cache(cache_json_fs)

    existing = cache.get(url)
    if existing and os.path.exists(existing):
        if sanitize_cached_file(existing):
            log.info("Sanitized cached HTML secrets in %s", existing)
        log.info("Cache hit for %s -> %s", url, existing)
        return existing, "cache"

    filename = slug_from_url(url) + ".html"
    dest = Path(target_dir_fs) / filename

    try:
        response = requests.get(url, headers=random_headers(), timeout=30)
    except Exception as exc:
        log.error("Request failed for %s: %s", url, exc)
        return None, "error"

    if response.status_code != 200:
        log.error("Unexpected status %s for %s", response.status_code, url)
        return None, "error"

    sanitized_html, replacements = sanitize_html_secrets(response.text)
    with open(dest, "w", encoding="utf-8") as handle:
        handle.write(sanitized_html)

    cache[url] = str(dest)
    save_cache(cache_json_fs, cache)
    if replacements:
        log.info("Removed %d secret values while caching %s", replacements, dest)
    log.info("Downloaded %s -> %s", url, dest)
    return str(dest), "download"


def aircraft_page_from_flight_url(flight_url: str) -> str:
    """
    Strip history segments from a flight URL to obtain the aircraft page.
    """
    return flight_url.split("/history", 1)[0]
