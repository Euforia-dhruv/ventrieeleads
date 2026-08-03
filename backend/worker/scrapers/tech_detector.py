"""Technology detection for websites."""
import re
import logging
from typing import List, Dict
import httpx

logger = logging.getLogger(__name__)


class TechDetector:
    """Detect technologies used by a website."""

    def __init__(self):
        self.timeout = 15
        self.headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }

    async def detect(self, url: str) -> List[Dict]:
        """Detect technologies used by a website."""
        logger.info(f"Detecting technologies for: {url}")

        technologies = []

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers=self.headers,
                verify=False
            ) as client:
                response = await client.get(url)
                html = response.text
                headers = dict(response.headers)

                technologies.extend(self._detect_from_html(html))
                technologies.extend(self._detect_from_headers(headers))
                technologies.extend(self._detect_from_meta(html))

        except Exception as e:
            logger.error(f"Technology detection failed for {url}: {e}")

        seen = set()
        unique_techs = []
        for tech in technologies:
            key = f"{tech['name']}:{tech['category']}"
            if key not in seen:
                seen.add(key)
                unique_techs.append(tech)

        logger.info(f"Detected {len(unique_techs)} technologies for {url}")
        return unique_techs

    def _detect_from_html(self, html: str) -> List[Dict]:
        """Detect technologies from HTML content."""
        techs = []

        frameworks = [
            (r'wp-content|wp-json|wordpress', "WordPress", "cms"),
            (r'__NEXT_DATA__|nextjs|_next', "Next.js", "framework"),
            (r'react\.production|react-dom|reactroot', "React", "framework"),
            (r'vue\.js|vuejs|vue\.min\.js|__vue__', "Vue.js", "framework"),
            (r'angular|ng-version|ng-app', "Angular", "framework"),
            (r'svelte|svelte-', "Svelte", "framework"),
            (r'nuxt|__nuxt', "Nuxt.js", "framework"),
            (r'gatsby', "Gatsby", "framework"),
            (r'astro', "Astro", "framework"),
            (r'remix|__remix', "Remix", "framework"),
        ]

        ecommerce = [
            (r'shopify|shopify-', "Shopify", "ecommerce"),
            (r'woocommerce|woocommerce-', "WooCommerce", "ecommerce"),
            (r'magento|Mage\.Cookies', "Magento", "ecommerce"),
            (r'bigcommerce', "BigCommerce", "ecommerce"),
            (r'squarespace', "Squarespace", "cms"),
            (r'wix\.com|wixstatic|parastorage', "Wix", "cms"),
            (r'webflow', "Webflow", "cms"),
            (r'strapi', "Strapi", "cms"),
            (r'contentful', "Contentful", "cms"),
            (r'sanity\.io', "Sanity", "cms"),
        ]

        analytics = [
            (r'google-analytics\.com|gtag|ga\(', "Google Analytics", "analytics"),
            (r'googletagmanager\.com|gtm\.js', "Google Tag Manager", "analytics"),
            (r'facebook\.net|fbpx|fbevents\.js', "Meta Pixel", "analytics"),
            (r'hotjar\.com|hotjar\.js', "Hotjar", "analytics"),
            (r'mixpanel\.com|mixpanel\.min\.js', "Mixpanel", "analytics"),
            (r'amplitude\.com|amplitude\.min\.js', "Amplitude", "analytics"),
            (r'segment\.com|analytics\.js', "Segment", "analytics"),
            (r'plausible\.io', "Plausible", "analytics"),
            (r'matomo|piwik', "Matomo", "analytics"),
            (r'clarity\.ms', "Microsoft Clarity", "analytics"),
        ]

        cdn = [
            (r'cloudflare|cf-ray|cf-', "Cloudflare", "cdn"),
            (r'akamai|akamai-', "Akamai", "cdn"),
            (r'fastly\.com|x-fastly', "Fastly", "cdn"),
            (r'cloudfront|cloudfront\.net', "CloudFront", "cdn"),
            (r'cdn\.shopify', "Shopify CDN", "cdn"),
            (r'jsdelivr\.net', "jsDelivr", "cdn"),
            (r'unpkg\.com', "unpkg", "cdn"),
            (r'cdnjs\.cloudflare', "cdnjs", "cdn"),
        ]

        hosting = [
            (r'vercel|vercel-', "Vercel", "hosting"),
            (r'netlify|netlify-', "Netlify", "hosting"),
            (r'heroku', "Heroku", "hosting"),
            (r'firebase|firebaseapp', "Firebase", "hosting"),
            (r'github\.io', "GitHub Pages", "hosting"),
            (r'azure|azurewebsites', "Azure", "hosting"),
            (r'aws|amazonaws', "AWS", "hosting"),
            (r'google cloud|googleapis', "Google Cloud", "hosting"),
        ]

        booking = [
            (r'calendly', "Calendly", "booking"),
            (r'booking\.com|booking\.js', "Booking.com Widget", "booking"),
            (r'opentable', "OpenTable", "booking"),
            (r'reservio', "Reservio", "booking"),
            (r'tappointments', "Tapointments", "booking"),
            (r'mindbody', "Mindbody", "booking"),
        ]

        chat = [
            (r'intercom|intercom-', "Intercom", "chat"),
            (r'zendesk|zdassets', "Zendesk", "chat"),
            (r'crisp\.chat', "Crisp", "chat"),
            (r'livechat', "LiveChat", "chat"),
            (r'tawk\.to', "tawk.to", "chat"),
            (r'hubspot|hs-', "HubSpot", "chat"),
            (r'tidio', "Tidio", "chat"),
            (r'drift', "Drift", "chat"),
            (r'freshdesk|freshchat', "Freshdesk", "chat"),
            (r'whatsapp\.com/send|wa\.me', "WhatsApp Widget", "chat"),
        ]

        forms = [
            (r'typeform', "Typeform", "forms"),
            (r'google\.com/recaptcha', "reCAPTCHA", "forms"),
            (r'jotform', "JotForm", "forms"),
            (r'gravityforms', "Gravity Forms", "forms"),
            (r'wpforms', "WPForms", "forms"),
            (r'formstack', "Formstack", "forms"),
        ]

        all_patterns = frameworks + ecommerce + analytics + cdn + hosting + booking + chat + forms

        for pattern, name, category in all_patterns:
            if re.search(pattern, html, re.I):
                techs.append({
                    "name": name,
                    "category": category,
                    "confidence": 0.9
                })

        return techs

    def _detect_from_headers(self, headers: Dict) -> List[Dict]:
        """Detect technologies from HTTP headers."""
        techs = []

        if "cf-ray" in headers:
            techs.append({"name": "Cloudflare", "category": "cdn", "confidence": 1.0})
        if "x-powered-by" in headers:
            powered = headers["x-powered-by"]
            techs.append({"name": powered, "category": "server", "confidence": 1.0})
        if "server" in headers:
            server = headers["server"]
            if "nginx" in server.lower():
                techs.append({"name": "Nginx", "category": "server", "confidence": 1.0})
            elif "apache" in server.lower():
                techs.append({"name": "Apache", "category": "server", "confidence": 1.0})
            elif "cloudflare" in server.lower():
                techs.append({"name": "Cloudflare", "category": "cdn", "confidence": 1.0})

        return techs

    def _detect_from_meta(self, html: str) -> List[Dict]:
        """Detect technologies from meta tags."""
        techs = []

        generator_match = re.search(r'<meta\s+name=["\']generator["\']\s+content=["\']([^"\']+)', html, re.I)
        if generator_match:
            techs.append({"name": generator_match.group(1), "category": "generator", "confidence": 1.0})

        og_platform = re.search(r'<meta\s+property=["\']og:site_name["\']\s+content=["\']([^"\']+)', html, re.I)
        if og_platform:
            techs.append({"name": og_platform.group(1), "category": "platform", "confidence": 0.8})

        return techs


tech_detector = TechDetector()
