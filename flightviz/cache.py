"""Utilities for managing on-disk caches and directories."""

from __future__ import annotations

import errno
import json
import logging
import os
from typing import Dict

log = logging.getLogger(__name__)


def ensure_dir(path: os.PathLike[str] | str) -> None:
    """Create ``path`` recursively, ignoring if it already exists."""
    fs_path = os.fspath(path)
    try:
        os.makedirs(fs_path, exist_ok=True)
    except OSError as exc:
        if exc.errno != errno.EEXIST:
            log.error("Failed to create directory %s: %s", fs_path, exc)
            raise


def load_cache(path: os.PathLike[str] | str) -> Dict[str, str]:
    """Load a JSON cache mapping URLs to local file paths."""
    fs_path = os.fspath(path)
    if not os.path.exists(fs_path):
        log.debug("Cache %s missing; starting fresh", fs_path)
        return {}

    try:
        with open(fs_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception as exc:
        log.warning("Failed to read cache %s: %s", fs_path, exc)
        return {}

    cache = {str(key): str(value) for key, value in data.items()}
    log.debug("Loaded %d cache entries from %s", len(cache), fs_path)
    return cache


def save_cache(path: os.PathLike[str] | str, payload: Dict[str, str]) -> None:
    """Persist the cache mapping to ``path``."""
    fs_path = os.fspath(path)
    ensure_dir(os.path.dirname(fs_path))
    with open(fs_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    log.debug("Wrote %d cache entries to %s", len(payload), fs_path)
