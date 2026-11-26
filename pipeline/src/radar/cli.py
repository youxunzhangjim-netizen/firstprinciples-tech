from __future__ import annotations

import argparse
import os
from pathlib import Path

from .arxiv_client import ArxivClient
from .brief_builder import build_weekly_brief_markdown, load_rubric, rank_research_items
from .ghost_publisher import GhostDraftPublisher
from .storage import RadarStore
from .uspto_odp_client import UsptoOdpClient


def main() -> None:
    parser = argparse.ArgumentParser(description="FirstPrinciples Tech Daily arXiv/USPTO Radar Runner")
    parser.add_argument("--rubric", default="config/rubric.json")
    parser.add_argument("--db", default="radar_state.sqlite3")
    parser.add_argument("--out-md", default="latest_digest_draft.md")
    parser.add_argument("--push-ghost", action="store_true", help="Push digest as a Ghost DRAFT post")
    parser.add_argument("--dry-run", action="store_true", help="Build digest from existing SQLite state without external API calls")
    args = parser.parse_args()

    rubric = load_rubric(args.rubric)
    store = RadarStore(args.db)

    try:
        if not args.dry_run:
            arxiv = ArxivClient(
                store=store,
                contact_email=os.environ.get("RADAR_CONTACT_EMAIL", "contact@firstprinciplestech.example"),
                min_interval_sec=3.5,
            )
            try:
                for cat in rubric.get("arxiv_categories", []):
                    arxiv.fetch_category(cat, max_results=10)
            finally:
                arxiv.close()

            if os.environ.get("USPTO_ODP_API_KEY"):
                uspto = UsptoOdpClient(store=store)
                try:
                    uspto.search_patents(
                        cpc_codes=rubric.get("uspto_cpc_classes", ["H01L"]),
                        assignees=rubric.get("target_assignees", []),
                        limit=15,
                    )
                finally:
                    uspto.close()

        ranked = rank_research_items(store.list_papers(), store.list_patents(), rubric, top_n=12)
        title, md = build_weekly_brief_markdown(ranked)
        Path(args.out_md).write_text(md, encoding="utf-8")
        print(f"[FirstPrinciples Radar] Wrote draft digest ({len(ranked)} items) to {args.out_md}")

        if args.push_ghost:
            publisher = GhostDraftPublisher()
            try:
                result = publisher.create_draft_post(title=title, markdown_body=md, status="draft")
                post_id = (result.get("posts") or [{}])[0].get("id", "unknown")
                print(f"[FirstPrinciples Radar] Pushed Ghost DRAFT id={post_id}")
            finally:
                publisher.close()
    finally:
        store.close()


if __name__ == "__main__":
    main()
