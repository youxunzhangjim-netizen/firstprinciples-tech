from __future__ import annotations

import os
from typing import Any

import httpx

from .storage import PatentRecord, RadarStore, sha256_text

# Post-March 2026 USPTO Open Data Portal (ODP) Patent Search Endpoint
USPTO_ODP_SEARCH_URL = "https://api.uspto.gov/api/v1/patent/applications/search"


def build_odp_query(cpc_codes: list[str], assignees: list[str] | None = None) -> str:
    clauses: list[str] = []
    if cpc_codes:
        cpc_expr = " OR ".join(f'cpcClassificationBag:"{c}"' for c in cpc_codes)
        clauses.append(f"({cpc_expr})")
    if assignees:
        asg_expr = " OR ".join(f'applicantName:"{a}"' for a in assignees)
        clauses.append(f"({asg_expr})")
    return " AND ".join(clauses) if clauses else "applicationTypeLabelName:Utility"


class UsptoOdpClient:
    """
    Client for the post-March 2026 USPTO Open Data Portal (ODP) API.
    Requires `USPTO_ODP_API_KEY` header via `X-API-KEY`.
    """

    def __init__(
        self,
        store: RadarStore,
        api_key: str | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.store = store
        self.api_key = api_key if api_key is not None else os.environ.get("USPTO_ODP_API_KEY", "")
        self._owns_client = http_client is None
        self.client = http_client or httpx.Client(timeout=30.0)

    def search_patents(
        self,
        cpc_codes: list[str],
        assignees: list[str] | None = None,
        limit: int = 20,
    ) -> list[PatentRecord]:
        if not self.api_key:
            raise ValueError(
                "USPTO_ODP_API_KEY is not configured. Register a free key at https://data.uspto.gov/ (ID.me verified)."
            )

        payload: dict[str, Any] = {
            "q": build_odp_query(cpc_codes, assignees),
            "pagination": {"offset": 0, "limit": limit},
        }
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        resp = self.client.post(USPTO_ODP_SEARCH_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

        raw_items = (
            data.get("patentFileWrapperDataBag")
            or data.get("results")
            or data.get("applications")
            or []
        )
        records: list[PatentRecord] = []
        for raw in raw_items:
            meta = raw.get("applicationMetaData", raw)
            app_num = str(raw.get("applicationNumberText") or meta.get("applicationNumberText") or "")
            if not app_num:
                continue
            rec = PatentRecord(
                application_number=app_num,
                patent_number=meta.get("patentNumber"),
                title=str(meta.get("inventionTitle") or "Untitled Patent Application").strip(),
                assignee=str(
                    meta.get("firstApplicantName")
                    or meta.get("assigneeName")
                    or "Unspecified Assignee"
                ).strip(),
                cpc_codes=list(meta.get("cpcClassificationBag") or []),
                filing_date=str(meta.get("filingDate") or ""),
                abstract=str(meta.get("abstractText") or meta.get("inventionTitle") or ""),
                raw_json_sha256=sha256_text(raw),
            )
            self.store.upsert_patent(rec)
            records.append(rec)
        return records

    def close(self) -> None:
        if self._owns_client:
            self.client.close()
