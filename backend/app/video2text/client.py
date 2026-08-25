"""GitHub API client.

Thin async wrapper around the GitHub REST API built on ``httpx``. Results are
cached in-process for a short TTL to avoid hammering the (tight) unauthenticated
rate limit and to keep the public endpoint snappy.
"""
from __future__ import annotations

import time
from typing import Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("video2text.github")

GITHUB_API_BASE = "https://api.github.com"

# In-process cache: key -> (timestamp, star_count). Single worker only.
_cache: dict[str, tuple[float, int]] = {}
_CACHE_TTL_SECONDS = float(settings.github_cache_ttl_seconds)


def _parse_last_page(link_header: Optional[str]) -> Optional[int]:
    """Extract the page number from a ``Link`` header's ``rel="last"`` entry.

    GitHub's stargazers endpoint does not return a total count directly, so we
    request a single page and read the last page number from the ``Link``
    header, which equals the total number of stars.
    """
    if not link_header:
        return None
    for part in link_header.split(","):
        segments = part.split(";")
        if len(segments) < 2:
            continue
        url = segments[0].strip().strip("<>")
        rels = [s.strip() for s in segments[1:]]
        if any(r.endswith('"last"') or r == 'rel="last"' for r in rels):
            # url like ...?page=123
            if "page=" in url:
                try:
                    return int(url.rsplit("page=", 1)[1].split("&")[0])
                except ValueError:
                    return None
    return None


async def get_star_count(
    owner: str,
    repo: str,
    *,
    token: Optional[str] = None,
    bypass_cache: bool = False,
) -> int:
    """Return the number of GitHub stars for ``owner/repo``.

    Uses ``GET /repos/{owner}/{repo}/stargazers`` with ``per_page=1`` and reads
    the total from the ``Link`` header's ``rel="last"`` page.
    """
    cache_key = f"{owner}/{repo}"
    now = time.monotonic()

    if not bypass_cache and cache_key in _cache:
        ts, count = _cache[cache_key]
        if now - ts < _CACHE_TTL_SECONDS:
            return count

    auth_token = token or settings.github_token
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "video2text-backend",
    }
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/stargazers"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers, params={"per_page": 1})
        resp.raise_for_status()

        last_page = _parse_last_page(resp.headers.get("link"))
        if last_page is not None:
            count = last_page
        else:
            # No pagination link: count is the number of items on this page.
            body = resp.json()
            count = len(body) if isinstance(body, list) else 0

    _cache[cache_key] = (now, count)
    return count


# In-process cache for the full stargazer list. Single worker only.
_list_cache: dict[str, tuple[float, list[dict]]] = {}


async def get_stargazers(
    owner: str,
    repo: str,
    *,
    token: Optional[str] = None,
    per_page: int = 100,
    max_pages: int = 100,
    bypass_cache: bool = False,
) -> list[dict]:
    """Return the list of users who starred ``owner/repo``.

    Calls ``GET /repos/{owner}/{repo}/stargazers`` across all pages (each user
    object carries ``login`` and ``id``). ``per_page`` is capped at 100 (GitHub
    max) and ``max_pages`` guards against runaway pagination. The result is
    cached in-process for the same TTL as the count.
    """
    cache_key = f"{owner}/{repo}:stargazers"
    now = time.monotonic()

    if not bypass_cache and cache_key in _list_cache:
        ts, users = _list_cache[cache_key]
        if now - ts < _CACHE_TTL_SECONDS:
            return users

    auth_token = token or settings.github_token
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "video2text-backend",
    }
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/stargazers"
    per_page = max(1, min(per_page, 100))
    users: list[dict] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for page in range(1, max_pages + 1):
            resp = await client.get(
                url, headers=headers, params={"per_page": per_page, "page": page}
            )
            resp.raise_for_status()
            items = resp.json()
            if not isinstance(items, list) or not items:
                break
            users.extend(items)
            # Stop when there is no next page.
            link = resp.headers.get("link", "")
            if not link or 'rel="next"' not in link:
                break

    _list_cache[cache_key] = (now, users)
    return users


def _public_stargazer(user: dict) -> dict:
    """Project a GitHub user object to the safe fields we expose."""
    return {
        "login": user.get("login"),
        "id": user.get("id"),
        "avatar_url": user.get("avatar_url"),
        "html_url": user.get("html_url"),
        "type": user.get("type"),
    }
