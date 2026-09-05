"""Pinterest Profile Scraper — adapted from Scout."""
import requests
from typing import Dict, Optional
import logging
import re
import json

from worker.scout.scrapers.stealth import random_user_agent, get_requests_proxies
from worker.scout.scrapers.utils import extract_email

logger = logging.getLogger(__name__)


def scrape_profile(username: str) -> Optional[Dict]:
    username = username.strip().lower()
    url = f'https://www.pinterest.com/{username}/'
    headers = {'User-Agent': random_user_agent(), 'Accept': 'text/html,application/xhtml+xml'}

    try:
        r = requests.get(url, headers=headers, timeout=20, proxies=get_requests_proxies())
        if r.status_code != 200:
            return None
        if 'User not found' in r.text:
            return None
        return _extract_profile_data(r.text, username)
    except requests.exceptions.RequestException:
        return None


def _extract_profile_data(html: str, username: str) -> Optional[Dict]:
    results = {}

    pws_match = re.search(r'<script[^>]*id="__PWS_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if pws_match:
        try:
            pws_data = json.loads(pws_match.group(1))
            user_data = _find_user_in_pws(pws_data, username)
            if user_data:
                results.update(user_data)
        except json.JSONDecodeError:
            pass

    if 'full_name' not in results:
        m = re.search(r'"full_name":"([^"]+)"', html)
        if m:
            results['full_name'] = m.group(1)

    if 'follower_count' not in results:
        m = re.search(r'"follower_count":(\d+)', html)
        if m:
            results['follower_count'] = int(m.group(1))

    if 'bio' not in results:
        m = re.search(r'"about":"([^"]*)"', html)
        if m:
            results['bio'] = m.group(1)

    if 'website' not in results:
        m = re.search(r'"website_url":"([^"]+)"', html)
        if m:
            results['website'] = m.group(1).replace('\\/', '/')

    if 'full_name' not in results and 'follower_count' not in results:
        return None

    bio = results.get('bio', '')
    return {
        'username': username,
        'full_name': results.get('full_name', ''),
        'bio': bio,
        'email': extract_email(bio),
        'website': results.get('website', ''),
        'follower_count': results.get('follower_count', 0),
        'platform': 'pinterest',
        'profile_url': f'https://pinterest.com/{username}/',
    }


def _find_user_in_pws(data, username: str, depth: int = 0) -> Optional[Dict]:
    if depth > 15:
        return None
    if isinstance(data, dict):
        if data.get('username', '').lower() == username.lower() and 'follower_count' in data:
            return {
                'full_name': data.get('full_name', ''),
                'bio': data.get('about', ''),
                'follower_count': data.get('follower_count', 0),
                'website': data.get('website_url', ''),
            }
        for v in data.values():
            result = _find_user_in_pws(v, username, depth + 1)
            if result:
                return result
    elif isinstance(data, list):
        for item in data:
            result = _find_user_in_pws(item, username, depth + 1)
            if result:
                return result
    return None
