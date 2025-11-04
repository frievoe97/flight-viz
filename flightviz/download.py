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

    with open(dest, "w", encoding="utf-8") as handle:
        handle.write(response.text)

    cache[url] = str(dest)
    save_cache(cache_json_fs, cache)
    log.info("Downloaded %s -> %s", url, dest)
    return str(dest), "download"


def aircraft_page_from_flight_url(flight_url: str) -> str:
    """
    Strip history segments from a flight URL to obtain the aircraft page.
    """
    return flight_url.split("/history", 1)[0]
