from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class ArxivPaper(BaseModel):
    arxiv_id: str
    version: str = "v1"
    title: str
    summary: str
    authors: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    published: str
    updated: str
    link: str
    raw_xml_sha256: str


class PatentRecord(BaseModel):
    application_number: str
    patent_number: str | None = None
    title: str
    assignee: str = "Unknown"
    cpc_codes: list[str] = Field(default_factory=list)
    filing_date: str = ""
    abstract: str = ""
    raw_json_sha256: str


class ScoredItem(BaseModel):
    source: str  # "arxiv" | "uspto"
    item_id: str
    title: str
    url: str
    published: str
    score: float
    matched_signals: list[str] = Field(default_factory=list)
    hype_flags: list[str] = Field(default_factory=list)
    summary_excerpt: str


class RadarStore:
    """Idempotent SQLite persistence keyed by (arxiv_id, version) and USPTO application_number."""

    def __init__(self, db_path: str | Path = "radar_state.sqlite3") -> None:
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS arxiv_papers (
                arxiv_id TEXT NOT NULL,
                version TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                authors_json TEXT NOT NULL,
                categories_json TEXT NOT NULL,
                published TEXT NOT NULL,
                updated TEXT NOT NULL,
                link TEXT NOT NULL,
                raw_xml_sha256 TEXT NOT NULL,
                ingested_at TEXT NOT NULL,
                PRIMARY KEY (arxiv_id, version)
            );

            CREATE TABLE IF NOT EXISTS uspto_patents (
                application_number TEXT PRIMARY KEY,
                patent_number TEXT,
                title TEXT NOT NULL,
                assignee TEXT NOT NULL,
                cpc_json TEXT NOT NULL,
                filing_date TEXT NOT NULL,
                abstract TEXT NOT NULL,
                raw_json_sha256 TEXT NOT NULL,
                ingested_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS http_cache (
                url TEXT PRIMARY KEY,
                etag TEXT,
                last_modified TEXT,
                updated_at TEXT NOT NULL
            );
            """
        )
        self.conn.commit()

    def upsert_arxiv_paper(self, paper: ArxivPaper) -> bool:
        """Inserts or updates paper idempotently; returns True if newly inserted."""
        cur = self.conn.execute(
            "SELECT raw_xml_sha256 FROM arxiv_papers WHERE arxiv_id = ? AND version = ?",
            (paper.arxiv_id, paper.version),
        )
        existing = cur.fetchone()
        now = datetime.now(timezone.utc).isoformat()
        if existing and existing["raw_xml_sha256"] == paper.raw_xml_sha256:
            return False

        self.conn.execute(
            """
            INSERT OR REPLACE INTO arxiv_papers
            (arxiv_id, version, title, summary, authors_json, categories_json,
             published, updated, link, raw_xml_sha256, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                paper.arxiv_id,
                paper.version,
                paper.title,
                paper.summary,
                json.dumps(paper.authors),
                json.dumps(paper.categories),
                paper.published,
                paper.updated,
                paper.link,
                paper.raw_xml_sha256,
                now,
            ),
        )
        self.conn.commit()
        return existing is None

    def upsert_patent(self, patent: PatentRecord) -> bool:
        cur = self.conn.execute(
            "SELECT raw_json_sha256 FROM uspto_patents WHERE application_number = ?",
            (patent.application_number,),
        )
        existing = cur.fetchone()
        now = datetime.now(timezone.utc).isoformat()
        if existing and existing["raw_json_sha256"] == patent.raw_json_sha256:
            return False

        self.conn.execute(
            """
            INSERT OR REPLACE INTO uspto_patents
            (application_number, patent_number, title, assignee, cpc_json,
             filing_date, abstract, raw_json_sha256, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patent.application_number,
                patent.patent_number,
                patent.title,
                patent.assignee,
                json.dumps(patent.cpc_codes),
                patent.filing_date,
                patent.abstract,
                patent.raw_json_sha256,
                now,
            ),
        )
        self.conn.commit()
        return existing is None

    def get_cache_headers(self, url: str) -> dict[str, str]:
        row = self.conn.execute("SELECT etag, last_modified FROM http_cache WHERE url = ?", (url,)).fetchone()
        headers: dict[str, str] = {}
        if row:
            if row["etag"]:
                headers["If-None-Match"] = row["etag"]
            if row["last_modified"]:
                headers["If-Modified-Since"] = row["last_modified"]
        return headers

    def save_cache_headers(self, url: str, etag: str | None, last_modified: str | None) -> None:
        if not etag and not last_modified:
            return
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            "INSERT OR REPLACE INTO http_cache (url, etag, last_modified, updated_at) VALUES (?, ?, ?, ?)",
            (url, etag, last_modified, now),
        )
        self.conn.commit()

    def list_papers(self) -> list[ArxivPaper]:
        rows = self.conn.execute("SELECT * FROM arxiv_papers ORDER BY published DESC").fetchall()
        return [
            ArxivPaper(
                arxiv_id=r["arxiv_id"],
                version=r["version"],
                title=r["title"],
                summary=r["summary"],
                authors=json.loads(r["authors_json"]),
                categories=json.loads(r["categories_json"]),
                published=r["published"],
                updated=r["updated"],
                link=r["link"],
                raw_xml_sha256=r["raw_xml_sha256"],
            )
            for r in rows
        ]

    def list_patents(self) -> list[PatentRecord]:
        rows = self.conn.execute("SELECT * FROM uspto_patents ORDER BY filing_date DESC").fetchall()
        return [
            PatentRecord(
                application_number=r["application_number"],
                patent_number=r["patent_number"],
                title=r["title"],
                assignee=r["assignee"],
                cpc_codes=json.loads(r["cpc_json"]),
                filing_date=r["filing_date"],
                abstract=r["abstract"],
                raw_json_sha256=r["raw_json_sha256"],
            )
            for r in rows
        ]

    def close(self) -> None:
        self.conn.close()


def sha256_text(payload: str | dict[str, Any]) -> str:
    raw = payload if isinstance(payload, str) else json.dumps(payload, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
