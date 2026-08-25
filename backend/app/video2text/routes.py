"""video2text API routes."""
from __future__ import annotations

from fastapi import APIRouter

from app.video2text.client import _public_stargazer, get_star_count, get_stargazers

# Fixed repository for the video2text project.
STARS_OWNER = "fuyouling"
STARS_REPO = "video2text"

router = APIRouter(prefix="/video2text", tags=["video2text"])


@router.get("/stars")
async def repo_star_count() -> dict:
    """Return the GitHub star count for the video2text project.

    Owner/repo are fixed to fuyouling/video2text and the GitHub token is read
    from the server-side config (``GITHUB_TOKEN``), so no client token or query
    parameters are required and no secret is ever exposed in the URL.
    """
    stars = await get_star_count(STARS_OWNER, STARS_REPO)
    return {"owner": STARS_OWNER, "repo": STARS_REPO, "stars": stars}


@router.get("/stargazers")
async def repo_stargazers() -> dict:
    """Return the list of GitHub users who starred the video2text project.

    Owner/repo are fixed to fuyouling/video2text and the GitHub token is read
    from the server-side config (``GITHUB_TOKEN``); no client token or query
    parameters are required and no secret is exposed in the URL.
    """
    users = await get_stargazers(STARS_OWNER, STARS_REPO)
    return {
        "owner": STARS_OWNER,
        "repo": STARS_REPO,
        "count": len(users),
        "stargazers": [_public_stargazer(u) for u in users],
    }
