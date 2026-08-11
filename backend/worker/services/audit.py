"""AI-powered website audit service."""
import logging
import re
import socket
import ssl as ssl_module
from typing import Dict, List
import httpx

logger = logging.getLogger(__name__)


class AuditService:
    """Generate comprehensive website audits."""

    def __init__(self):
        self.timeout = 15
        self.headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }

    async def perform_audit(self, url: str) -> Dict:
        logger.info(f"Performing audit for: {url}")
        result = {
            "website_score": 0, "seo_score": 0, "performance_score": 0,
            "accessibility_score": 0, "design_score": 0, "branding_score": 0,
            "conversion_score": 0, "copywriting_score": 0, "trust_score": 0,
            "overall_score": 0, "checks": {}, "issues": [], "strengths": [],
            "weaknesses": [], "quick_wins": [], "estimated_redesign_budget": "",
            "recommended_services": [], "raw_data": {}
        }
        try:
            import time
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True, headers=self.headers, verify=False) as client:
                start_time = time.time()
                response = await client.get(url)
                load_time = time.time() - start_time
                html = response.text
                text = re.sub(r'<[^>]+>', ' ', html)
                text = re.sub(r'\s+', ' ', text).strip()

                result["checks"]["ssl"] = url.startswith("https")
                result["checks"]["load_time_seconds"] = round(load_time, 2)
                result["checks"]["html_size_bytes"] = len(html)
                result["checks"]["has_title"] = bool(re.search(r'<title>[^<]+</title>', html, re.I))
                result["checks"]["has_meta_description"] = bool(re.search(r'<meta\s+name=["\']description["\']', html, re.I))
                result["checks"]["has_viewport"] = bool(re.search(r'<meta\s+name=["\']viewport["\']', html, re.I))
                result["checks"]["has_h1"] = bool(re.search(r'<h1[^>]*>', html, re.I))
                result["checks"]["has_analytics"] = bool(re.search(r'google-analytics|googletagmanager|gtag|ga\(', html, re.I))
                result["checks"]["has_meta_pixel"] = bool(re.search(r'facebook\.net|fbpx|fbevents', html, re.I))
                result["checks"]["has_whatsapp"] = bool(re.search(r'whatsapp|wa\.me', html + text, re.I))
                result["checks"]["has_cta"] = bool(re.search(r'contact|book|appointment|quote|get-started|enquire|free consultation', html + text, re.I))
                result["checks"]["has_booking"] = bool(re.search(r'calendly|booking|reservation|appointment', html + text, re.I))
                result["checks"]["has_schema"] = bool(re.search(r'schema\.org|application/ld\+json', html, re.I))
                result["checks"]["has_opengraph"] = bool(re.search(r'og:title|og:description|og:image', html, re.I))
                result["checks"]["has_canonical"] = bool(re.search(r'canonical', html, re.I))
                result["checks"]["has_robots"] = bool(re.search(r'robots', html, re.I))
                result["checks"]["has_sitemap"] = bool(re.search(r'sitemap', html, re.I))
                result["checks"]["has_alt_text"] = html.count('alt=') > 0
                result["checks"]["has_favicon"] = bool(re.search(r'favicon|icon\.(ico|png|svg)', html, re.I))

                result["seo_score"] = self._calc_seo(result["checks"])
                result["performance_score"] = self._calc_perf(load_time, result["checks"])
                result["accessibility_score"] = self._calc_access(result["checks"])
                result["design_score"] = self._calc_design(result["checks"])
                result["branding_score"] = self._calc_brand(result["checks"], text)
                result["conversion_score"] = self._calc_conv(result["checks"])
                result["copywriting_score"] = self._calc_copy(text)
                result["trust_score"] = self._calc_trust(result["checks"], text)
                result["website_score"] = round(
                    result["seo_score"] * 0.3 + result["performance_score"] * 0.25 +
                    result["design_score"] * 0.2 + result["accessibility_score"] * 0.15 +
                    result["branding_score"] * 0.1
                )
                result["issues"] = self._get_issues(result["checks"], load_time)
                result["strengths"] = self._get_strengths(result["checks"])
                result["weaknesses"] = self._get_weaknesses(result["checks"])
                result["quick_wins"] = self._get_quick_wins(result["checks"])
                result["estimated_redesign_budget"] = self._estimate_budget(result["website_score"])
                result["recommended_services"] = self._recommend_services(result)
                result["overall_score"] = round(
                    result["website_score"] * 0.2 + result["seo_score"] * 0.2 +
                    result["performance_score"] * 0.15 + result["design_score"] * 0.15 +
                    result["conversion_score"] * 0.15 + result["trust_score"] * 0.15
                )
                result["raw_data"] = {"url": url, "status_code": response.status_code, "html_size": len(html), "load_time": load_time}

                result["checks"]["dns_ssl"] = self._dns_ssl_profile(url, response)
        except Exception as e:
            logger.error(f"Audit failed for {url}: {e}")
            result["issues"].append({"category": "technical", "severity": "critical", "title": "Website Unreachable", "description": f"Could not access {url}: {str(e)}"})
        logger.info(f"Audit complete for {url}: overall={result['overall_score']}")
        return result

    def _dns_ssl_profile(self, url: str, response: httpx.Response = None) -> Dict:
        """Collect lightweight DNS + TLS profile using only the standard library.

        Gives quick technical enrichment: resolves the host, checks A record,
        verifies the TLS cert chain validity/expiry, and captures the HTTP version.
        Pure-additive: any failure yields empty fields rather than failing the audit.
        """
        host = url.split("://")[-1].split("/")[0].split(":")[0]
        profile: Dict = {}
        try:
            addrs = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
            profile["resolved_ips"] = sorted({a[4][0] for a in addrs if a[0] in (socket.AF_INET, socket.AF_INET6)})[:5]
        except Exception as e:
            profile["dns_error"] = str(e)[:200]

        try:
            ctx = ssl_module.create_default_context()
            with socket.create_connection((host, 443), timeout=10) as sock:
                with ctx.wrap_socket(sock, server_hostname=host) as tls:
                    profile["tls_version"] = tls.version()
                    cert = tls.getpeercert()
                    profile["ssl_valid"] = True
                    profile["ssl_issuer"] = dict(x[0] for x in cert.get("issuer", [])).get("organizationName", "")
                    profile["ssl_subject"] = dict(x[0] for x in cert.get("subject", [])).get("commonName", "")
                    if cert.get("notAfter"):
                        from datetime import datetime
                        try:
                            expires = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
                            days_left = (expires - datetime.utcnow()).days
                            profile["ssl_days_left"] = days_left
                            profile["ssl_expires_soon"] = 0 < days_left <= 30
                        except Exception:
                            pass
        except Exception as e:
            profile["ssl_error"] = str(e)[:200]

        if response is not None:
            profile["http_version"] = getattr(response, "http_version", None)
            profile["server"] = response.headers.get("server", "")

        return profile

    def _calc_seo(self, c: Dict) -> int:
        s = 0
        if c.get("has_title"): s += 15
        if c.get("has_meta_description"): s += 12
        if c.get("has_h1"): s += 10
        if c.get("has_viewport"): s += 10
        if c.get("has_schema"): s += 10
        if c.get("has_opengraph"): s += 8
        if c.get("has_canonical"): s += 5
        if c.get("has_robots"): s += 5
        if c.get("has_sitemap"): s += 5
        if c.get("has_alt_text"): s += 10
        if c.get("ssl"): s += 10
        return min(100, s)

    def _calc_perf(self, lt: float, c: Dict) -> int:
        s = 100
        if lt > 1: s -= 10
        if lt > 2: s -= 15
        if lt > 3: s -= 20
        if lt > 5: s -= 30
        if not c.get("ssl"): s -= 10
        return max(0, min(100, s))

    def _calc_access(self, c: Dict) -> int:
        s = 50
        if c.get("has_viewport"): s += 15
        if c.get("has_alt_text"): s += 15
        if c.get("has_h1"): s += 10
        if c.get("has_title"): s += 10
        return min(100, s)

    def _calc_design(self, c: Dict) -> int:
        s = 40
        if c.get("has_favicon"): s += 10
        if c.get("has_opengraph"): s += 15
        if c.get("has_canonical"): s += 10
        if c.get("ssl"): s += 15
        if c.get("has_schema"): s += 10
        return min(100, s)

    def _calc_brand(self, c: Dict, t: str) -> int:
        s = 30
        if c.get("has_title"): s += 15
        if c.get("has_meta_description"): s += 10
        if c.get("has_opengraph"): s += 15
        if re.search(r'about|our story|who we are|our team', t, re.I): s += 15
        if re.search(r'mission|vision|values', t, re.I): s += 15
        return min(100, s)

    def _calc_conv(self, c: Dict) -> int:
        s = 20
        if c.get("has_cta"): s += 25
        if c.get("has_whatsapp"): s += 15
        if c.get("has_booking"): s += 20
        if c.get("has_analytics"): s += 10
        if c.get("has_meta_pixel"): s += 10
        return min(100, s)

    def _calc_copy(self, t: str) -> int:
        s = 30
        w = len(t.split())
        if w > 300: s += 15
        if w > 1000: s += 10
        if re.search(r'service|offer|solution|expertise', t, re.I): s += 15
        if re.search(r'testimonial|review|client|customer', t, re.I): s += 15
        if re.search(r'contact us|get in touch', t, re.I): s += 15
        return min(100, s)

    def _calc_trust(self, c: Dict, t: str) -> int:
        s = 30
        if c.get("ssl"): s += 20
        if re.search(r'privacy|terms|policy', t, re.I): s += 15
        if re.search(r'certified|accredited|award|partner', t, re.I): s += 15
        if re.search(r'client|customer|testimonial|review', t, re.I): s += 10
        if c.get("has_whatsapp"): s += 10
        return min(100, s)

    def _get_issues(self, c: Dict, lt: float) -> List[Dict]:
        issues = []
        if not c.get("ssl"):
            issues.append({"category": "security", "severity": "critical", "title": "No SSL", "description": "Website does not use HTTPS"})
        if lt > 3:
            issues.append({"category": "performance", "severity": "high", "title": "Slow Loading", "description": f"Page takes {lt:.1f}s to load"})
        if not c.get("has_meta_description"):
            issues.append({"category": "seo", "severity": "high", "title": "Missing Meta Description", "description": "No meta description found"})
        if not c.get("has_title"):
            issues.append({"category": "seo", "severity": "high", "title": "Missing Title Tag", "description": "No title tag found"})
        if not c.get("has_h1"):
            issues.append({"category": "seo", "severity": "medium", "title": "Missing H1 Tag", "description": "No H1 heading found"})
        if not c.get("has_analytics"):
            issues.append({"category": "analytics", "severity": "medium", "title": "No Analytics", "description": "No Google Analytics detected"})
        if not c.get("has_meta_pixel"):
            issues.append({"category": "marketing", "severity": "medium", "title": "No Meta Pixel", "description": "No Meta Pixel detected"})
        if not c.get("has_whatsapp"):
            issues.append({"category": "conversion", "severity": "medium", "title": "No WhatsApp", "description": "No WhatsApp contact found"})
        if not c.get("has_cta"):
            issues.append({"category": "conversion", "severity": "high", "title": "No Clear CTAs", "description": "No call-to-action buttons found"})
        if not c.get("has_schema"):
            issues.append({"category": "seo", "severity": "low", "title": "No Schema Markup", "description": "No structured data found"})
        return issues

    def _get_strengths(self, c: Dict) -> List[str]:
        s = []
        if c.get("ssl"): s.append("SSL certificate installed")
        if c.get("has_analytics"): s.append("Analytics tracking enabled")
        if c.get("has_meta_pixel"): s.append("Meta Pixel installed")
        if c.get("has_whatsapp"): s.append("WhatsApp contact available")
        if c.get("has_cta"): s.append("Clear call-to-action present")
        if c.get("has_booking"): s.append("Booking system integrated")
        if c.get("has_schema"): s.append("Schema markup implemented")
        if c.get("has_opengraph"): s.append("OpenGraph tags present")
        return s

    def _get_weaknesses(self, c: Dict) -> List[str]:
        w = []
        if not c.get("ssl"): w.append("No SSL certificate")
        if not c.get("has_meta_description"): w.append("Missing meta description")
        if not c.get("has_h1"): w.append("No H1 heading")
        if not c.get("has_analytics"): w.append("No analytics tracking")
        if not c.get("has_meta_pixel"): w.append("No Meta Pixel")
        if not c.get("has_whatsapp"): w.append("No WhatsApp integration")
        if not c.get("has_cta"): w.append("No clear CTAs")
        if not c.get("has_booking"): w.append("No booking system")
        return w

    def _get_quick_wins(self, c: Dict) -> List[str]:
        qw = []
        if not c.get("has_meta_description"): qw.append("Add meta description tag")
        if not c.get("has_whatsapp"): qw.append("Add WhatsApp chat button")
        if not c.get("has_analytics"): qw.append("Install Google Analytics")
        if not c.get("has_meta_pixel"): qw.append("Install Meta Pixel")
        if not c.get("has_opengraph"): qw.append("Add OpenGraph tags")
        if not c.get("has_canonical"): qw.append("Add canonical URL tag")
        if not c.get("has_favicon"): qw.append("Add favicon")
        return qw

    def _estimate_budget(self, score: int) -> str:
        if score < 30: return "$15,000 - $30,000"
        if score < 50: return "$30,000 - $50,000"
        if score < 70: return "$50,000 - $75,000"
        if score < 90: return "$75,000 - $100,000"
        return "$100,000 - $150,000+"

    def _recommend_services(self, r: Dict) -> List[str]:
        services = []
        if r["seo_score"] < 60: services.append("SEO Optimization")
        if r["performance_score"] < 60: services.append("Performance Optimization")
        if r["design_score"] < 60: services.append("UI/UX Redesign")
        if r["conversion_score"] < 60: services.append("Conversion Rate Optimization")
        if r["branding_score"] < 60: services.append("Brand Identity Refresh")
        if r["copywriting_score"] < 60: services.append("Copywriting & Content")
        if r["trust_score"] < 60: services.append("Trust & Credibility Enhancement")
        if not services: services.append("Website Maintenance & Growth")
        return services

    async def ai_analysis(self, url: str, html: str, scores: Dict) -> Dict:
        """Add AI-powered analysis to the audit."""
        try:
            from worker.services.ai_client import ai_client

            text_preview = html[:3000] if html else ""

            prompt = f"""Analyze this website for a web development agency audit.

URL: {url}
Scores: {scores}
HTML preview: {text_preview}

Provide:
1. Top 3 UX/design issues with business impact
2. Top 3 conversion blockers
3. Specific recommendations (not generic)
4. Estimated revenue impact of fixes
5. One-paragraph executive summary

Return as JSON:
{{"ux_issues": [{{"issue": "...", "impact": "...", "fix": "..."}}], "conversion_blockers": ["..."], "executive_summary": "...", "estimated_impact": "..."}}"""

            result = await ai_client.generate_json(prompt)
            if result:
                return {"ai_analysis": result}

        except Exception as e:
            logger.warning(f"AI analysis failed: {e}")

        return {"ai_analysis": None}


audit_service = AuditService()
