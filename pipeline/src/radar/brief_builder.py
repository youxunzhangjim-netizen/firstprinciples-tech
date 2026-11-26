from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .storage import ArxivPaper, PatentRecord, ScoredItem


def load_rubric(rubric_path: str | Path) -> dict[str, Any]:
    return json.loads(Path(rubric_path).read_text(encoding="utf-8"))


def score_text_against_rubric(text: str, rubric: dict[str, Any]) -> tuple[float, list[str], list[str]]:
    score = 0.0
    signals: list[str] = []
    hype_flags: list[str] = []

    for rule in rubric.get("signal_rules", []):
        if re.search(rule["pattern"], text, flags=re.IGNORECASE):
            score += float(rule["weight"])
            signals.append(str(rule["label"]))

    for penalty in rubric.get("hype_penalty_rules", []):
        if re.search(penalty["pattern"], text, flags=re.IGNORECASE):
            score += float(penalty["weight"])
            hype_flags.append(str(penalty["label"]))

    return round(score, 2), signals, hype_flags


def rank_research_items(
    papers: list[ArxivPaper],
    patents: list[PatentRecord],
    rubric: dict[str, Any],
    top_n: int = 12,
) -> list[ScoredItem]:
    items: list[ScoredItem] = []
    for p in papers:
        blob = f"{p.title}\n{p.summary}"
        sc, sigs, hype = score_text_against_rubric(blob, rubric)
        items.append(
            ScoredItem(
                source="arxiv",
                item_id=f"{p.arxiv_id}{p.version}",
                title=p.title,
                url=p.link,
                published=p.published,
                score=sc,
                matched_signals=sigs,
                hype_flags=hype,
                summary_excerpt=p.summary[:240] + ("..." if len(p.summary) > 240 else ""),
            )
        )

    for pat in patents:
        blob = f"{pat.title}\n{pat.abstract}\n{pat.assignee}\n{' '.join(pat.cpc_codes)}"
        sc, sigs, hype = score_text_against_rubric(blob, rubric)
        items.append(
            ScoredItem(
                source="uspto",
                item_id=pat.application_number,
                title=f"[{pat.assignee}] {pat.title}",
                url=f"https://data.uspto.gov/patent-file-wrapper/details/{pat.application_number}",
                published=pat.filing_date,
                score=sc,
                matched_signals=sigs,
                hype_flags=hype,
                summary_excerpt=pat.abstract[:240] + ("..." if len(pat.abstract) > 240 else ""),
            )
        )

    items.sort(key=lambda x: x.score, reverse=True)
    return deduplicate_scored_items(items)[:top_n]


def deduplicate_scored_items(items: list[ScoredItem], seen_ids: set[str] | None = None) -> list[ScoredItem]:
    """Deduplicates arXiv version bumps (e.g. 2604.01922v1 vs v2) and previously published IDs."""
    seen: set[str] = set(seen_ids or set())
    unique: list[ScoredItem] = []
    for item in items:
        canonical = re.sub(r"v\d+$", "", item.item_id) if item.source == "arxiv" else item.item_id
        if canonical in seen or item.item_id in seen:
            continue
        seen.add(canonical)
        seen.add(item.item_id)
        unique.append(item)
    return unique


def export_bibtex_entries(items: list[ScoredItem]) -> str:
    """Exports ranked arXiv & USPTO ODP items as clean BibTeX entries for Zotero / LaTeX."""
    blocks: list[str] = []
    for item in items:
        safe_key = re.sub(r"[^a-zA-Z0-9]+", "_", item.item_id).strip("_")
        year = (item.published or "2026")[:4]
        entry_type = "misc" if item.source == "arxiv" else "patent"
        clean_title = item.title.replace("{", "").replace("}", "")
        blocks.append(
            f"@{entry_type}{{fp_{safe_key},\n"
            f"  title = {{{clean_title}}},\n"
            f"  year = {{{year}}},\n"
            f"  howpublished = {{{item.url}}},\n"
            f"  note = {{FirstPrinciples Radar Score: {item.score}}}\n"
            f"}}"
        )
    return "\n\n".join(blocks)


def build_weekly_brief_markdown(items: list[ScoredItem], week_label: str | None = None) -> tuple[str, str]:
    label = week_label or datetime.now(timezone.utc).strftime("%Y-W%W")
    title = f"FirstPrinciples Hardware & Quantum Radar — {label} (Draft)"
    arxiv_count = sum(1 for i in items if i.source == "arxiv")
    uspto_count = sum(1 for i in items if i.source == "uspto")
    hype_count = sum(1 for i in items if i.hype_flags)
    lines = [
        f"# {title}",
        "",
        "> **Human Editorial Gate Required**: Auto-ingested from arXiv & USPTO ODP. Verify physical scaling claims before moving from `draft` to `published`.",
        "",
        f"| Total Ranked | arXiv Papers | USPTO Patents | De-Hype Flagged | Top Score |",
        f"|---:|---:|---:|---:|---:|",
        f"| {len(items)} | {arxiv_count} | {uspto_count} | {hype_count} | {items[0].score if items else 0} |",
        "",
    ]

    for idx, item in enumerate(items, start=1):
        badge = "arXiv" if item.source == "arxiv" else "USPTO ODP"
        lines.append(f"## {idx}. [{badge}] {item.title}")
        lines.append(f"- **ID**: `{item.item_id}` | **Score**: `{item.score}` | **Date**: `{item.published}`")
        lines.append(f"- **Link**: {item.url}")
        if item.matched_signals:
            lines.append(f"- **Quantitative Signals**: {', '.join(item.matched_signals)}")
        if item.hype_flags:
            lines.append(f"- **De-Hype Flags**: {', '.join(item.hype_flags)}")
        lines.append(f"- **Abstract Excerpt**: {item.summary_excerpt}")
        lines.append("")

    return title, "\n".join(lines)


def markdown_to_ghost_lexical(markdown_text: str) -> str:
    """Wraps markdown cleanly into Ghost's native Lexical Markdown card node."""
    lexical_doc = {
        "root": {
            "children": [
                {
                    "type": "markdown",
                    "version": 1,
                    "markdown": markdown_text,
                }
            ],
            "direction": None,
            "format": "",
            "indent": 0,
            "type": "root",
            "version": 1,
        }
    }
    return json.dumps(lexical_doc)
