"""YouTube Channel Scraper — adapted from Scout."""
import requests
from typing import Dict, Optional
import logging
import re

from worker.scout.scrapers.stealth import random_user_agent, get_requests_proxies
from worker.scout.scrapers.utils import extract_email, parse_abbreviated_number

logger = logging.getLogger(__name__)


def scrape_channel(channel_identifier: str) -> Optional[Dict]:
    if channel_identifier.startswith('@'):
        url = f'https://www.youtube.com/{channel_identifier}'
    elif channel_identifier.startswith('UC') and len(channel_identifier) == 24:
        url = f'https://www.youtube.com/channel/{channel_identifier}'
    else:
        url = f'https://www.youtube.com/@{channel_identifier}'

    headers = {
        'User-Agent': random_user_agent(),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
    }
    cookies = {'CONSENT': 'PENDING+999'}

    try:
        r = requests.get(url, headers=headers, cookies=cookies, timeout=20, proxies=get_requests_proxies())
        if r.status_code != 200:
            return None
        return _extract_channel_data(r.text, channel_identifier)
    except requests.exceptions.RequestException:
        return None


def _extract_channel_data(html: str, identifier: str) -> Optional[Dict]:
    results = {}

    name_match = re.search(r'"channelMetadataRenderer":\{"title":"([^"]+)"', html)
    if name_match:
        results['channel_name'] = name_match.group(1)

    desc_match = re.search(r'"description":"([^"]*)"', html)
    if desc_match:
        try:
            results['description'] = desc_match.group(1).encode('utf-8').decode('unicode_escape')
        except (UnicodeDecodeError, UnicodeEncodeError):
            results['description'] = desc_match.group(1)

    for pattern in [
        r'"subscriberCountText":\{"simpleText":"([\d.,]+[KMB]?) subscribers?"',
        r'"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([\d.,]+[KMB]?) subscribers?"',
    ]:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            results['subscriber_count'] = parse_abbreviated_number(match.group(1))
            break

    handle_match = re.search(r'"canonicalChannelUrl":"https://www\.youtube\.com/@([^"]+)"', html)
    if handle_match:
        results['handle'] = handle_match.group(1)

    channel_id_match = re.search(r'"channelId":"(UC[a-zA-Z0-9_-]{22})"', html)
    if channel_id_match:
        results['channel_id'] = channel_id_match.group(1)

    desc = results.get('description', '')
    results['business_email'] = extract_email(desc)

    links = []
    for match in re.finditer(r'"urlEndpoint":\{"url":"(https?://[^"]+)"', html):
        link = match.group(1)
        if 'youtube.com' not in link and 'google.com' not in link:
            if 'youtube.com/redirect' in link:
                q = re.search(r'[?&]q=([^&]+)', link)
                if q:
                    from urllib.parse import unquote
                    link = unquote(q.group(1))
            if link not in links:
                links.append(link)
    results['links'] = links[:5]

    if 'channel_name' not in results:
        return None

    handle = results.get('handle', identifier.lstrip('@'))
    return {
        'username': handle,
        'full_name': results.get('channel_name', ''),
        'bio': results.get('description', ''),
        'email': results.get('business_email', ''),
        'follower_count': results.get('subscriber_count', 0),
        'website': results['links'][0] if results.get('links') else '',
        'links': results.get('links', []),
        'platform': 'youtube',
        'profile_url': f'https://www.youtube.com/@{handle}',
    }
