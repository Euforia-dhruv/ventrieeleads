"""Twitch Profile Scraper — adapted from Scout."""
import requests
from typing import Dict, Optional
import logging

from worker.scout.scrapers.stealth import random_user_agent, get_requests_proxies
from worker.scout.scrapers.utils import extract_email

logger = logging.getLogger(__name__)

CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'


def scrape_profile(username: str) -> Optional[Dict]:
    username = username.lower().strip()
    headers = {'Client-ID': CLIENT_ID, 'User-Agent': random_user_agent(), 'Accept': 'application/json'}
    query = """query { user(login: "%s") { id login displayName description followers { totalCount } roles { isPartner isAffiliate } channel { socialMedias { name url } } } }""" % username

    try:
        proxies = get_requests_proxies()
        try:
            r = requests.post('https://gql.twitch.tv/gql', headers=headers, json={'query': query}, timeout=20, proxies=proxies)
        except (requests.exceptions.ProxyError, requests.exceptions.ConnectionError):
            if proxies:
                r = requests.post('https://gql.twitch.tv/gql', headers=headers, json={'query': query}, timeout=20)
            else:
                raise

        if r.status_code != 200:
            return None

        data = r.json()
        user_data = data.get('data', {}).get('user')
        if not user_data:
            return None

        bio = user_data.get('description', '') or ''
        followers = user_data.get('followers', {})
        roles = user_data.get('roles', {}) or {}
        links = [s.get('url', '') for s in (user_data.get('channel', {}) or {}).get('socialMedias', []) if s.get('url')]

        return {
            'username': user_data.get('login', username),
            'full_name': user_data.get('displayName', ''),
            'bio': bio,
            'email': extract_email(bio),
            'follower_count': followers.get('totalCount', 0) if followers else 0,
            'is_partner': roles.get('isPartner', False),
            'is_affiliate': roles.get('isAffiliate', False),
            'links': links[:5],
            'website': links[0] if links else '',
            'platform': 'twitch',
            'profile_url': f'https://twitch.tv/{user_data.get("login", username)}',
        }
    except Exception:
        return None
