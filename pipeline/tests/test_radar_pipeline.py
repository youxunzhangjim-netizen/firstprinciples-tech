from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from radar.arxiv_client import ArxivClient, reset_rate_limiter_for_tests
from radar.brief_builder import (
    build_weekly_brief_markdown,
    deduplicate_scored_items,
    export_bibtex_entries,
    load_rubric,
    rank_research_items,
)
from radar.ghost_publisher import GhostDraftPublisher, mint_ghost_admin_jwt
from radar.storage import RadarStore
from radar.uspto_odp_client import UsptoOdpClient

SAMPLE_ATOM_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2604.01922v2</id>
    <updated>2026-04-12T18:00:00Z</updated>
    <published>2026-04-10T14:00:00Z</published>
    <title>Below-Threshold Surface Code Decoding at 99.65% Two-Qubit Gate Fidelity</title>
    <summary>We report a distance-7 surface code logical qubit operating below threshold with T1 coherence time of 180 microseconds and 99.65% two-qubit gate fidelity.</summary>
    <author><name>A. Physicist</name></author>
    <category term="quant-ph"/>
  </entry>
</feed>
"""


def test_arxiv_rate_limit_backoff_and_idempotent_storage(tmp_path: Path) -> None:
    reset_rate_limiter_for_tests()
    db_path = tmp_path / "test_radar.sqlite3"
    store = RadarStore(db_path)

    attempts = {"count": 0}
    sleeps: list[float] = []
    fake_clock = {"t": 100.0}

    def fake_sleep(dt: float) -> None:
        sleeps.append(dt)
        fake_clock["t"] += dt

    def fake_monotonic() -> float:
        return fake_clock["t"]

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["count"] += 1
        assert "FirstPrinciplesRadar/1.0" in request.headers["User-Agent"]
        if attempts["count"] <= 2:
            return httpx.Response(429, text="Too Many Requests")
        return httpx.Response(200, text=SAMPLE_ATOM_XML, headers={"ETag": '"v2-etag"'})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as http_client:
        client = ArxivClient(
            store=store,
            min_interval_sec=3.5,
            http_client=http_client,
            sleep_fn=fake_sleep,
            monotonic_fn=fake_monotonic,
            rng_fn=lambda a, b: 1.0,
        )
        papers = client.fetch_category("quant-ph", max_results=5)
        assert len(papers) == 1
        assert papers[0].arxiv_id == "2604.01922"
        assert papers[0].version == "v2"
        assert attempts["count"] == 3
        # Backoff + >=3.5s rate limit waits must occur
        assert any(s >= 3.5 for s in sleeps)

        # Idempotent re-upsert returns False when SHA256 unchanged
        assert store.upsert_arxiv_paper(papers[0]) is False

        # Second call sends conditional If-None-Match header
        cached_headers = store.get_cache_headers(
            "https://export.arxiv.org/api/query?search_query=cat%3Aquant-ph&sortBy=submittedDate&sortOrder=descending&max_results=5"
        )
        assert cached_headers.get("If-None-Match") == '"v2-etag"'

    store.close()


def test_arxiv_rejects_unsafe_rate_limit_interval(tmp_path: Path) -> None:
    store = RadarStore(tmp_path / "bad.sqlite3")
    with pytest.raises(ValueError):
        ArxivClient(store=store, min_interval_sec=1.0)
    store.close()


def test_uspto_odp_client_and_rubric_ranking(tmp_path: Path) -> None:
    store = RadarStore(tmp_path / "uspto.sqlite3")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-KEY"] == "test-odp-key"
        assert request.url.path == "/api/v1/patent/applications/search"
        payload = {
            "patentFileWrapperDataBag": [
                {
                    "applicationNumberText": "18999123",
                    "applicationMetaData": {
                        "inventionTitle": "HBM4 2nm CoWoS Interposer at 8 TB/s and 700 W Liquid Cooling",
                        "firstApplicantName": "Taiwan Semiconductor",
                        "cpcClassificationBag": ["H01L25/065"],
                        "filingDate": "2026-06-01",
                    },
                }
            ]
        }
        return httpx.Response(200, json=payload)

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as http_client:
        uspto = UsptoOdpClient(store=store, api_key="test-odp-key", http_client=http_client)
        patents = uspto.search_patents(["H01L"], ["Taiwan Semiconductor"])
        assert len(patents) == 1
        assert patents[0].application_number == "18999123"

    rubric = load_rubric(Path(__file__).resolve().parents[1] / "config" / "rubric.json")
    ranked = rank_research_items([], store.list_patents(), rubric)
    assert len(ranked) == 1
    assert ranked[0].score >= 55.0
    title, md = build_weekly_brief_markdown(ranked, week_label="2026-W47")
    assert "Draft" in title
    assert "HBM4 2nm CoWoS" in md
    assert "| Total Ranked |" in md
    bibtex = export_bibtex_entries(ranked)
    assert "@patent{fp_18999123," in bibtex
    # Deduplication skips already-seen canonical IDs
    assert len(deduplicate_scored_items(ranked, seen_ids={"18999123"})) == 0
    store.close()


def test_ghost_draft_publisher_enforces_draft_only_and_hs256_jwt() -> None:
    key = "66aa11bb22cc33dd44ee55ff:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    jwt = mint_ghost_admin_jwt(key, now_ts=1760000000)
    assert len(jwt.split(".")) == 3

    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"].startswith("Ghost ")
        body = json.loads(request.content.decode("utf-8"))
        captured["status"] = body["posts"][0]["status"]
        return httpx.Response(201, json={"posts": [{"id": "draft-123", "status": "draft"}]})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as http_client:
        pub = GhostDraftPublisher(
            ghost_url="https://firstprinciples.example",
            admin_api_key=key,
            http_client=http_client,
        )
        # Safety guardrail must block auto-publish
        with pytest.raises(PermissionError):
            pub.create_draft_post("Bad", "body", status="published")

        res = pub.create_draft_post("Weekly Radar", "# Hello", status="draft")
        assert res["posts"][0]["id"] == "draft-123"
        assert captured["status"] == "draft"
