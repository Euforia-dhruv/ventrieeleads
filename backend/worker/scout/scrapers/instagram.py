"""Instagram Profile Scraper — adapted from Scout."""
import requests
from typing import Dict, Optional
import logging
import re
import random
import time

from worker.scout.scrapers.stealth import get_requests_proxies, random_delay
from worker.scout.scrapers.utils import extract_email, extract_phone, parse_abbreviated_number

logger = logging.getLogger(__name__)

MOBILE_USER_AGENTS = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
]


def scrape_profile_no_login(username: str, max_retries: int = 3) -> Optional[Dict]:
    url = f'https://www.instagram.com/{username}/'

    for attempt in range(max_retries):
        proxies = get_requests_proxies()
        headers = {
            'User-Agent': random.choice(MOBILE_USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }

        try:
            r = requests.get(url, headers=headers, proxies=proxies, timeout=20)
            if r.status_code == 404:
                return None
            if r.status_code == 429:
                raise RuntimeError("Rate limited by Instagram (429).")
            if r.status_code != 200:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                return None

            html = r.text
            if any(s in html[:10000] for s in ["Page Not Found", "Sorry, this page isn", "Profile isn\\'t available"]):
                return None
            if '/accounts/login' in r.url:
                return None

            data = _extract_profile_from_html(html, username)
            if data:
                return data
            if attempt < max_retries - 1:
                time.sleep(1.0)
                continue
            return None

        except RuntimeError:
            raise
        except Exception as e:
            if '429' in str(e):
                raise RuntimeError("Rate limited by Instagram (429).")
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            return None

    return None


def _extract_profile_from_html(html: str, username: str) -> Optional[Dict]:
    results = {}

    for pattern in [r'"username":"([^"]+)"', r'"owner":\{"username":"([^"]+)"']:
        match = re.search(pattern, html)
        if match and match.group(1).lower() == username.lower():
            results['username'] = match.group(1)
            break

    for pattern in [r'"full_name":"([^"]*)"', r'"name":"([^"]*)"']:
        match = re.search(pattern, html, re.IGNORECASE)
        if match and 'full_name' not in results:
            results['full_name'] = match.group(1).strip()
            break

    for pattern in [r'"biography":"([^"]*)"', r'"bio":"([^"]*)"']:
        match = re.search(pattern, html)
        if match and 'biography' not in results:
            try:
                decoded = match.group(1).encode('utf-8').decode('unicode_escape')
                results['biography'] = decoded.encode('utf-16', 'surrogatepass').decode('utf-16')
            except (UnicodeDecodeError, UnicodeEncodeError):
                results['biography'] = match.group(1).replace('\\u', '')
            break

    for pattern in [r'"follower_count":(\d+)', r'"edge_followed_by":\{"count":(\d+)\}']:
        match = re.search(pattern, html)
        if match and 'follower_count' not in results:
            results['follower_count'] = int(match.group(1))
            break

    for pattern in [r'"following_count":(\d+)', r'"edge_follow":\{"count":(\d+)\}']:
        match = re.search(pattern, html)
        if match and 'following_count' not in results:
            results['following_count'] = int(match.group(1))
            break

    match = re.search(r'"is_verified":(true|false)', html)
    if match:
        results['is_verified'] = match.group(1) == 'true'

    match = re.search(r'"is_business_account":(true|false)', html)
    if match:
        results['is_business'] = match.group(1) == 'true'

    for pattern in [r'"external_url":"([^"]+)"', r'"website":"([^"]+)"']:
        match = re.search(pattern, html)
        if match and 'external_url' not in results:
            try:
                decoded = match.group(1).replace('\\/', '/').encode('utf-8').decode('unicode_escape')
                results['external_url'] = decoded.encode('utf-16', 'surrogatepass').decode('utf-16')
            except (UnicodeDecodeError, UnicodeEncodeError):
                results['external_url'] = match.group(1).replace('\\/', '/')
            break

    if 'follower_count' not in results or results.get('follower_count', 0) == 0:
        return None

    bio = results.get('biography', '')
    return {
        'username': results.get('username', username),
        'full_name': results.get('full_name', ''),
        'bio': bio,
        'follower_count': results.get('follower_count', 0),
        'following_count': results.get('following_count', 0),
        'is_verified': results.get('is_verified', False),
        'is_business': results.get('is_business', False),
        'website': results.get('external_url', ''),
        'email': extract_email(bio),
        'phone': extract_phone(bio),
        'platform': 'instagram',
        'profile_url': f'https://www.instagram.com/{username}/',
    }
