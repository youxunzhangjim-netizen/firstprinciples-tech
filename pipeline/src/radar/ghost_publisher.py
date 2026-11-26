from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx

from .brief_builder import markdown_to_ghost_lexical


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def mint_ghost_admin_jwt(admin_api_key: str, now_ts: int | None = None) -> str:
    """
    Mints a 5-minute HS256 JWT for the Ghost Admin API using Python stdlib crypto only.
    Admin API Key format: `{key_id}:{hex_secret}`
    """
    if ":" not in admin_api_key:
        raise ValueError("Ghost Admin API key must be formatted as '<key_id>:<hex_secret>'.")
    key_id, secret_hex = admin_api_key.split(":", 1)
    secret_bytes = bytes.fromhex(secret_hex)

    iat = int(now_ts if now_ts is not None else time.time())
    header = {"alg": "HS256", "typ": "JWT", "kid": key_id}
    payload = {"iat": iat, "exp": iat + 300, "aud": "/admin/"}

    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = hmac.new(secret_bytes, signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url(sig)}"


class GhostDraftPublisher:
    """
    Publishes structured research digests to Ghost Admin API strictly as `status: "draft"`.
    Structural safety lock refuses non-draft statuses to prevent unreviewed auto-publishing.
    """

    def __init__(
        self,
        ghost_url: str | None = None,
        admin_api_key: str | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.ghost_url = (ghost_url or os.environ.get("GHOST_API_URL", "")).rstrip("/")
        self.admin_api_key = admin_api_key or os.environ.get("GHOST_ADMIN_API_KEY", "")
        self._owns_client = http_client is None
        self.client = http_client or httpx.Client(timeout=30.0)

    def create_draft_post(
        self,
        title: str,
        markdown_body: str,
        tags: list[str] | None = None,
        status: str = "draft",
    ) -> dict[str, Any]:
        if status != "draft":
            raise PermissionError(
                "Safety guardrail: FirstPrinciples Radar strictly enforces status='draft' for Ghost posts. Human editorial review is mandatory."
            )
        if not self.ghost_url or not self.admin_api_key:
            raise ValueError("GHOST_API_URL and GHOST_ADMIN_API_KEY must be configured.")

        token = mint_ghost_admin_jwt(self.admin_api_key)
        endpoint = f"{self.ghost_url}/ghost/api/admin/posts/"
        headers = {
            "Authorization": f"Ghost {token}",
            "Content-Type": "application/json",
            "Accept-Version": "v5.0",
        }
        body = {
            "posts": [
                {
                    "title": title,
                    "lexical": markdown_to_ghost_lexical(markdown_body),
                    "status": "draft",
                    "tags": [{"name": t} for t in (tags or ["Radar", "FirstPrinciples"])],
                }
            ]
        }
        resp = self.client.post(endpoint, headers=headers, json=body)
        resp.raise_for_status()
        return resp.json()

    def close(self) -> None:
        if self._owns_client:
            self.client.close()
