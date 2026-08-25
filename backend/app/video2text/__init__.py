"""video2text integration module.

Standalone package that talks to external services used by the video2text
project. The first feature is querying the GitHub stargazer (star) count for a
repository. The module is wired into the FastAPI app via ``app.video2text.routes``
and reads its token from config.
"""
from __future__ import annotations

from app.video2text.client import get_star_count
from app.video2text.routes import router

__all__ = ["router", "get_star_count"]
