"""LinkedIn Profile Scraper — adapted from Scout. Requires LINKEDIN_COOKIE env var."""
import json
import logging
import os
import re
from typing import Dict, Optional

import httpx

from worker.scout.scrapers.stealth import random_user_agent, get_httpx_proxy
from worker.scout.scrapers.utils import extract_email

logger = logging.getLogger(__name__)

_session_cache = {'client': None, 'csrf': None}


def _get_li_cookie() -> Optional[str]:
    cookie = os.environ.get('LINKEDIN_COOKIE', '').strip()
    return cookie if cookie and len(cookie) >= 50 else None


def _get_session():
    if _session_cache['client'] and _session_cache['csrf']:
        return _session_cache['client'], _session_cache['csrf']
    cookie = _get_li_cookie()
    if not cookie:
        return None, None
    client = httpx.Client(follow_redirects=True, timeout=20)
    client.cookies.set('li_at', cookie, domain='.linkedin.com')
    resp = client.get('https://www.linkedin.com/feed/')
    csrf = None
    for c in client.cookies.jar:
        if c.name == 'JSESSIONID':
            csrf = c.value.strip('"')
            break
    if not csrf:
        return None, None
    _session_cache['client'] = client
    _session_cache['csrf'] = csrf
    return client, csrf


def scrape_linkedin_profile(username: str) -> Optional[Dict]:
    if not _get_li_cookie():
        return None
    client, csrf = _get_session()
    if not client or not csrf:
        return None

    headers = {
        'csrf-token': csrf,
        'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
    }
    url = f'https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity={username}'

    try:
        resp = client.get(url, headers=headers)
    except httpx.RequestError:
        return None

    if resp.status_code in (403, 401):
        _session_cache.update({'client': None, 'csrf': None})
        return None
    if resp.status_code != 200:
        return None

    try:
        data = resp.json()
    except json.JSONDecodeError:
        return None

    profile_data = None
    for item in data.get('included', []):
        if 'firstName' in item and 'lastName' in item:
            profile_data = item
            break
    if not profile_data:
        return None

    summary = profile_data.get('summary', '')
    if not summary:
        multi = profile_data.get('multiLocaleSummary', {})
        summary = multi.get('en_US', '') if isinstance(multi, dict) else ''

    websites = [w['url'] for w in profile_data.get('websites', []) if isinstance(w, dict) and w.get('url')]

    return {
        'platform': 'linkedin',
        'username': profile_data.get('publicIdentifier', username),
        'full_name': f"{profile_data.get('firstName', '')} {profile_data.get('lastName', '')}".strip(),
        'headline': profile_data.get('headline', ''),
        'bio': summary,
        'profile_url': f"https://www.linkedin.com/in/{profile_data.get('publicIdentifier', username)}/",
        'website': websites[0] if websites else '',
        'email': extract_email(summary),
    }
