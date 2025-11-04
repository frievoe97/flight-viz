from pathlib import Path
import requests
from typing import Optional, Tuple
from urllib.parse import urlparse, unquote
import re

from config import random_headers, CACHE_BASE
from io_utils import read_json, write_json

def slug_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    safe = re.sub(r"[^0-9A-Za-z._/-]+", "_", path).strip("_").replace("/", "_")
    return safe or "index"

def get_cached(url: str, index_path: Path, target_dir: Path) -> Tuple[Optional[Path], str]:
    """
    Liefert (pfad, status) mit status in {"cache","download","error"}.
    Speichert Pfad in index.json.
    """
    index = read_json(index_path)
    existing = index.get(url)
    if existing and Path(existing).exists():
        return Path(existing), "cache"

    target_dir.mkdir(parents=True, exist_ok=True)
    dest = target_dir / f"{slug_from_url(url)}.html"
    try:
        resp = requests.get(url, headers=random_headers(), timeout=30)
        if resp.status_code != 200:
            return None, "error"
        dest.write_text(resp.text, encoding="utf-8")
        index[url] = str(dest)
        write_json(index_path, index)
        return dest, "download"
    except Exception:
        return None, "error"
