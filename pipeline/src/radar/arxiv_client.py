from __future__ import annotations

import random
import re
import threading
import time
import xml.etree.ElementTree as ET
from typing import Callable
from urllib.parse import urlencode

import httpx

from .storage import ArxivPaper, RadarStore, sha256_text

ARXIV_API_ENDPOINT = "https://export.arxiv.org/api/query"
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}

# Strict process-wide serial lock enforcing arXiv Terms of Use (<= 1 req / 3s across 1 connection)
_SERIAL_LOCK = threading.Lock()
_LAST_REQUEST_TS: float = 0.0


def reset_rate_limiter_for_tests() -> None:
    global _LAST_REQUEST_TS
    with _SERIAL_LOCK:
        _LAST_REQUEST_TS = 0.0


def parse_arxiv_atom_feed(xml_text: str) -> list[ArxivPaper]:
    root = ET.fromstring(xml_text)
    papers: list[ArxivPaper] = []

    for entry in root.findall("atom:entry", ATOM_NS):
        raw_id = (entry.findtext("atom:id", default="", namespaces=ATOM_NS) or "").strip()
        m = re.search(r"/abs/([^/?#]+?)(v\d+)?$", raw_id)
        if m:
            arxiv_id = m.group(1)
            version = m.group(2) or "v1"
        else:
            arxiv_id = raw_id or "unknown"
            version = "v1"

        title = re.sub(r"\s+", " ", (entry.findtext("atom:title", default="", namespaces=ATOM_NS) or "")).strip()
        summary = re.sub(r"\s+", " ", (entry.findtext("atom:summary", default="", namespaces=ATOM_NS) or "")).strip()
        published = (entry.findtext("atom:published", default="", namespaces=ATOM_NS) or "").strip()
        updated = (entry.findtext("atom:updated", default="", namespaces=ATOM_NS) or "").strip()
        authors = [
            (a.findtext("atom:name", default="", namespaces=ATOM_NS) or "").strip()
            for a in entry.findall("atom:author", ATOM_NS)
        ]
        categories = [c.attrib.get("term", "") for c in entry.findall("atom:category", ATOM_NS) if c.attrib.get("term")]

        entry_xml = ET.tostring(entry, encoding="unicode")
        papers.append(
            ArxivPaper(
                arxiv_id=arxiv_id,
                version=version,
                title=title,
                summary=summary,
                authors=[a for a in authors if a],
                categories=categories,
                published=published,
                updated=updated,
                link=raw_id,
                raw_xml_sha256=sha256_text(entry_xml),
            )
        )
    return papers


class ArxivClient:
    """
    arXiv API client strictly compliant with 2026 Terms of Use:
    - Process-wide serial concurrency = 1
    - Minimum >= 3.5s spacing between requests
    - Descriptive User-Agent with contact email
    - Conditional ETag / If-Modified-Since caching
    - Exponential backoff (base 2s, +-30% jitter, cap 600s, max 8 retries) on 429/503
    """

    def __init__(
        self,
        store: RadarStore,
        contact_email: str = "contact@firstprinciplestech.example",
        min_interval_sec: float = 3.5,
        max_retries: int = 8,
        backoff_base_sec: float = 2.0,
        backoff_cap_sec: float = 600.0,
        http_client: httpx.Client | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
        monotonic_fn: Callable[[], float] = time.monotonic,
        rng_fn: Callable[[float, float], float] = random.uniform,
    ) -> None:
        if min_interval_sec < 3.0:
            raise ValueError("arXiv API Terms of Use require >= 3.0 seconds between requests (recommended >= 3.5s).")
        self.store = store
        self.user_agent = f"FirstPrinciplesRadar/1.0 (mailto:{contact_email})"
        self.min_interval_sec = min_interval_sec
        self.max_retries = max_retries
        self.backoff_base_sec = backoff_base_sec
        self.backoff_cap_sec = backoff_cap_sec
        self._owns_client = http_client is None
        self.client = http_client or httpx.Client(timeout=30.0)
        self._sleep = sleep_fn
        self._monotonic = monotonic_fn
        self._rng = rng_fn

    def _wait_rate_limit(self) -> None:
        global _LAST_REQUEST_TS
        now = self._monotonic()
        if _LAST_REQUEST_TS > 0:
            elapsed = now - _LAST_REQUEST_TS
            remaining = self.min_interval_sec - elapsed
            if remaining > 0:
                self._sleep(remaining)
        _LAST_REQUEST_TS = self._monotonic()

    def _compute_backoff(self, attempt: int) -> float:
        raw = min(self.backoff_cap_sec, self.backoff_base_sec * (2**attempt))
        jitter = self._rng(0.7, 1.3)  # +-30% jitter
        return min(self.backoff_cap_sec, max(self.min_interval_sec, raw * jitter))

    def fetch_category(self, category: str, max_results: int = 15) -> list[ArxivPaper]:
        params = {
            "search_query": f"cat:{category}",
            "sortBy": "submittedDate",
            "sortOrder": "descending",
            "max_results": str(max_results),
        }
        url = f"{ARXIV_API_ENDPOINT}?{urlencode(params)}"
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/atom+xml",
            **self.store.get_cache_headers(url),
        }

        with _SERIAL_LOCK:
            for attempt in range(self.max_retries + 1):
                self._wait_rate_limit()
                resp = self.client.get(url, headers=headers)

                if resp.status_code == 304:
                    return []

                if resp.status_code in (429, 503):
                    if attempt >= self.max_retries:
                        raise RuntimeError(
                            f"arXiv API returned HTTP {resp.status_code} after {self.max_retries} retries."
                        )
                    delay = self._compute_backoff(attempt)
                    self._sleep(delay)
                    continue

                resp.raise_for_status()
                self.store.save_cache_headers(
                    url,
                    resp.headers.get("ETag"),
                    resp.headers.get("Last-Modified"),
                )
                papers = parse_arxiv_atom_feed(resp.text)
                for p in papers:
                    self.store.upsert_arxiv_paper(p)
                return papers

        return []

    def close(self) -> None:
        if self._owns_client:
            self.client.close()
