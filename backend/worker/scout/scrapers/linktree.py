"""Link-in-Bio Scraper — adapted from Scout."""
import requests
from typing import Dict, Optional, List
import logging
import re
import json

from worker.scout.scrapers.stealth import random_user_agent
from worker.scout.scrapers.utils import extract_email

logger = logging.getLogger(__name__)

PLATFORMS = {
    'linktree': 'https://linktr.ee/{username}',
    'stan': 'https://stan.store/{username}',
    'linkr': 'https://linkr.bio/{username}',
    'biolink': 'https://bio.link/{username}',
}


def scrape_linktree(username: str) -> Optional[Dict]:
    return _scrape_profile(username, 'linktree')


def scrape_all(username: str) -> Optional[Dict]:
    for platform in PLATFORMS:
        result = _scrape_profile(username, platform)
        if result:
            return result
    return None


def _scrape_profile(username: str, platform: str) -> Optional[Dict]:
    username = username.lstrip('@').strip().lower()
    if platform not in PLATFORMS:
        return None
    url = PLATFORMS[platform].format(username=username)
    headers = {'User-Agent': random_user_agent(), 'Accept': 'text/html,application/xhtml+xml'}

    try:
        r = requests.get(url, headers=headers, timeout=20)
        if r.status_code != 200:
            return None
        if platform == 'linktree':
            return _parse_linktree(r.text, username)
        return _parse_generic(r.text, username, platform)
    except requests.exceptions.RequestException:
        return None


def _parse_linktree(html: str, username: str) -> Optional[Dict]:
    data_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not data_match:
        return _parse_generic(html, username, 'linktree')
    try:
        data = json.loads(data_match.group(1))
        account = data.get('props', {}).get('pageProps', {}).get('account', {})
        if not account:
            return None
        links = [{'title': l.get('title', ''), 'url': l.get('url', '')} for l in account.get('links', []) if l.get('url')]
        bio = account.get('description', '')
        return {
            'username': username,
            'full_name': account.get('pageTitle', ''),
            'bio': bio,
            'email': _extract_email_from_links(links) or extract_email(bio),
            'website': _extract_website(links),
            'links': links,
            'socials': _extract_socials(links),
            'platform': 'linktree',
            'profile_url': f'https://linktr.ee/{username}',
        }
    except json.JSONDecodeError:
        return _parse_generic(html, username, 'linktree')


def _parse_generic(html: str, username: str, platform: str) -> Optional[Dict]:
    links = []
    seen = set()
    for url in re.findall(r'href="(https?://[^"]+)"', html):
        if url not in seen and not any(s in url for s in ['favicon', 'static', 'assets', '.css', '.js']):
            links.append({'title': '', 'url': url})
            seen.add(url)
    title_match = re.search(r'<title>([^<]+)</title>', html)
    full_name = title_match.group(1).strip() if title_match else ''
    if not links:
        return None
    return {
        'username': username,
        'full_name': full_name,
        'bio': '',
        'email': _extract_email_from_links(links),
        'website': _extract_website(links),
        'links': links[:20],
        'socials': _extract_socials(links),
        'platform': platform,
        'profile_url': PLATFORMS.get(platform, '').format(username=username),
    }


def _extract_socials(links: List[Dict]) -> Dict[str, str]:
    socials = {}
    patterns = {
        'instagram': r'instagram\.com/([^/?]+)',
        'twitter': r'(?:twitter|x)\.com/([^/?]+)',
        'tiktok': r'tiktok\.com/@?([^/?]+)',
        'youtube': r'youtube\.com/(?:@|c/|channel/)?([^/?]+)',
        'github': r'github\.com/([^/?]+)',
        'linkedin': r'linkedin\.com/in/([^/?]+)',
    }
    for link in links:
        url = link.get('url', '')
        for platform, pattern in patterns.items():
            if platform not in socials:
                match = re.search(pattern, url, re.IGNORECASE)
                if match:
                    socials[platform] = match.group(1)
    return socials


def _extract_website(links: List[Dict]) -> str:
    social_domains = ['instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com',
                      'twitch.tv', 'github.com', 'linkedin.com', 'facebook.com', 'pinterest.com',
                      'stan.store', 'linktr.ee', 'linkr.bio', 'bio.link']
    for link in links:
        url = link.get('url', '')
        if url.startswith('http') and not any(d in url.lower() for d in social_domains):
            return url
    return ''


def _extract_email_from_links(links: List[Dict]) -> str:
    for link in links:
        url = link.get('url', '')
        if url.startswith('mailto:'):
            return url.replace('mailto:', '').split('?')[0]
    return ''
