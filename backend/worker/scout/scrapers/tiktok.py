"""TikTok Profile Scraper — adapted from Scout."""
import json
import logging
import re
from typing import Dict, Optional

import httpx

from worker.scout.scrapers.stealth import random_user_agent, get_httpx_proxy
from worker.scout.scrapers.utils import extract_email

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        proxy = get_httpx_proxy()
        _client = httpx.Client(follow_redirects=True, timeout=20, proxy=proxy)
    return _client


def scrape_tiktok_profile(username: str) -> Optional[Dict]:
    url = f'https://www.tiktok.com/@{username}'

    try:
        client = _get_client()
        resp = client.get(url, headers={
            'User-Agent': random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        resp.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError):
        return None

    match = re.search(
        r'<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
        resp.text, re.DOTALL,
    )
    if not match:
        return None

    try:
        data = json.loads(match.group(1))
        user_info = data['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo']
        user = user_info.get('user', {})
        stats = user_info.get('stats', {})
    except (KeyError, TypeError, json.JSONDecodeError):
        return None

    bio = user.get('signature', '')
    return {
        'platform': 'tiktok',
        'username': user.get('uniqueId', username),
        'full_name': user.get('nickname', ''),
        'bio': bio,
        'email': extract_email(bio),
        'profile_url': url,
        'is_verified': user.get('verified', False),
        'follower_count': stats.get('followerCount', 0),
        'following_count': stats.get('followingCount', 0),
        'likes_count': stats.get('heartCount', 0),
    }
