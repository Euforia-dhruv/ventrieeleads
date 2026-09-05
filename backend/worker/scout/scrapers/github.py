"""GitHub Profile Scraper — adapted from Scout."""
import requests
from typing import Dict, Optional
import logging

from worker.scout.scrapers.stealth import get_requests_proxies, random_user_agent
from worker.scout.scrapers.utils import extract_email

logger = logging.getLogger(__name__)


def scrape_profile(username: str) -> Optional[Dict]:
    url = f'https://api.github.com/users/{username}'
    headers = {'Accept': 'application/vnd.github.v3+json', 'User-Agent': random_user_agent()}

    try:
        r = requests.get(url, headers=headers, timeout=15, proxies=get_requests_proxies())
        if r.status_code in (404, 403):
            return None
        if r.status_code != 200:
            return None

        data = r.json()
        bio = data.get('bio') or ''
        if not any([data.get('name'), data.get('bio'), data.get('email'), data.get('blog'), data.get('company')]):
            return None

        return {
            'username': data.get('login', username),
            'full_name': data.get('name') or '',
            'bio': bio,
            'email': data.get('email') or extract_email(bio),
            'company': (data.get('company') or '').lstrip('@'),
            'location': data.get('location') or '',
            'website': data.get('blog') or '',
            'follower_count': data.get('followers', 0),
            'following_count': data.get('following', 0),
            'public_repos': data.get('public_repos', 0),
            'platform': 'github',
            'profile_url': data.get('html_url', f'https://github.com/{username}'),
        }
    except requests.exceptions.RequestException:
        return None
