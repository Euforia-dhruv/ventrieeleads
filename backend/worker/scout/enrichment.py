"""Lead enrichment — adapted from Scout. SMTP email verification and company domain detection."""
import re
import dns.resolver
import smtplib
import socket
import logging
import os
from typing import Optional, Dict, List
from urllib.parse import urlparse

import httpx

from worker.scout.scrapers.stealth import random_user_agent, random_delay

logger = logging.getLogger(__name__)

EMAIL_RE = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
EMAIL_BLACKLIST = {'example.com', 'test.com', 'email.com', 'sentry.io', 'w3.org', 'schema.org', 'googleapis.com'}


class LeadEnricher:
    def __init__(self, hunter_api_key: Optional[str] = None):
        self.hunter_api_key = hunter_api_key

    def enrich_lead(self, lead_data: Dict) -> Dict:
        enriched = lead_data.copy()
        email_candidates = []

        bio = lead_data.get('bio', '')
        bio_email = self._extract_email_from_text(bio)
        if bio_email:
            email_candidates.append((bio_email, 'bio'))

        phone = self._extract_phone_from_text(bio)
        if phone:
            enriched['phone'] = phone

        website = lead_data.get('website', '')
        useless = ['youtube.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
                    'facebook.com', 'linktr.ee', 'stan.store', 'beacons.ai']
        if website and not any(d in website.lower() for d in useless):
            site_info = self._scrape_website(website)
            if site_info['email']:
                email_candidates.append((site_info['email'], 'website'))
            if site_info['phone'] and not enriched.get('phone'):
                enriched['phone'] = site_info['phone']

        if email_candidates:
            best = max(email_candidates, key=lambda x: 90 if x[1] == 'bio' else 70)
            enriched['email'] = best[0]
            enriched['email_source'] = best[1]

        enriched['lead_score'] = self._calculate_lead_score(enriched)
        return enriched

    def _extract_email_from_text(self, text: str) -> str:
        if not text:
            return ''
        for e in re.findall(EMAIL_RE, text):
            if not any(b in e.lower() for b in EMAIL_BLACKLIST):
                return e
        return ''

    def _extract_phone_from_text(self, text: str) -> Optional[str]:
        if not text:
            return None
        for tel in re.findall(r'href=["\']tel:([+\d\s\-().]+)', text):
            clean = re.sub(r'[^\d+]', '', tel)
            if 10 <= len(clean) <= 15:
                return tel.strip()
        for num in re.findall(r'(?:wa\.me|api\.whatsapp\.com/send\?phone=)(\d+)', text):
            if 10 <= len(num) <= 15:
                return '+' + num
        return None

    def _scrape_website(self, website: str) -> Dict:
        result = {'email': None, 'phone': None}
        if not website.startswith('http'):
            website = 'https://' + website
        for path in ['', '/contact', '/contact-us', '/about']:
            try:
                url = website.rstrip('/') + path
                resp = httpx.get(url, timeout=10, headers={'User-Agent': random_user_agent()}, follow_redirects=True)
                if resp.status_code != 200:
                    continue
                html = resp.text
                if not result['email']:
                    for e in re.findall(EMAIL_RE, html):
                        if not any(b in e.lower() for b in EMAIL_BLACKLIST):
                            result['email'] = e
                            break
                if not result['phone']:
                    phone = self._extract_phone_from_text(html)
                    if phone:
                        result['phone'] = phone
                if result['email'] and result['phone']:
                    break
                random_delay(0.3, 0.8)
            except Exception:
                continue
        return result

    def _calculate_lead_score(self, lead: Dict) -> int:
        score = 0
        if lead.get('email'):
            score += 30
        if lead.get('phone'):
            score += 30
        followers = lead.get('follower_count', 0)
        if 5000 <= followers <= 50000:
            score += 15
        elif 1000 <= followers <= 100000:
            score += 10
        elif followers > 0:
            score += 5
        if lead.get('website'):
            score += 10
        bio = (lead.get('bio') or '').lower()
        if any(k in bio for k in ['coach', 'consultant', 'ceo', 'founder', 'entrepreneur', 'agency', 'owner']):
            score += 5
        return min(score, 100)
