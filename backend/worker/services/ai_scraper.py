"""AI-powered website enrichment using ScrapeGraphAI.

Uses OmniRoute (OpenAI-compatible) to extract structured data from any website.
Describe what you want in natural language → get JSON back.
"""
import os
import json
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "http://host.docker.internal:20128/v1")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "sk-omniroute")
AI_MODEL = os.getenv("AI_MODEL", "auto/best-chat")


class AIScraper:
    """AI-powered website scraper using ScrapeGraphAI or direct LLM extraction."""

    async def extract_contacts(self, url: str) -> Dict:
        """Extract contact information from a website using AI.

        Returns dict with emails, phones, social links, address, description.
        """
        prompt = f"""Visit {url} and extract ALL contact information.

Return a JSON object with these fields:
{{
  "emails": ["list of email addresses found"],
  "phones": ["list of phone numbers found"],
  "whatsapp": "whatsapp number if found",
  "address": "physical address if found",
  "social_links": {{
    "linkedin": "linkedin url",
    "instagram": "instagram url",
    "facebook": "facebook url",
    "twitter": "twitter url"
  }},
  "description": "brief company description (1-2 sentences)",
  "services": ["list of services/products offered"],
  "working_hours": "business hours if found"
}}

Only return valid JSON. If a field is not found, use empty string or empty list."""

        return await self._extract(url, prompt)

    async def extract_tech_stack(self, url: str) -> Dict:
        """Extract technology stack from a website using AI."""
        prompt = f"""Visit {url} and analyze the technology stack.

Return a JSON object:
{{
  "frameworks": ["detected frameworks"],
  "cms": "content management system if detected",
  "analytics": ["analytics tools detected"],
  "hosting": "hosting provider if detectable",
  "ecommerce": "ecommerce platform if detected",
  "chat_widget": "live chat tool if detected",
  "booking": "booking/scheduling tool if detected",
  "forms": "form builder if detected",
  "cdn": "CDN provider if detected",
  "ssl": true/false
}}

Only return valid JSON."""

        return await self._extract(url, prompt)

    async def extract_company_info(self, url: str) -> Dict:
        """Extract comprehensive company information using AI."""
        prompt = f"""Visit {url} and extract all available company information.

Return a JSON object:
{{
  "company_name": "official company name",
  "tagline": "company tagline or slogan",
  "description": "what the company does (2-3 sentences)",
  "founded": "year founded if mentioned",
  "team_size": "number of employees if mentioned",
  "location": "headquarters location",
  "industries": ["industries they serve"],
  "certifications": ["certifications or awards"],
  "clients": ["notable clients if listed"],
  "pricing": "pricing info if available (or 'contact for pricing')",
  "cta": "main call-to-action on the site"
}}

Only return valid JSON."""

        return await self._extract(url, prompt)

    async def _extract(self, url: str, prompt: str) -> Dict:
        """Run AI extraction on a URL.

        Tries ScrapeGraphAI first, falls back to httpx + LLM.
        """
        # Try ScrapeGraphAI if available
        try:
            return await self._scrapegraph_extract(url, prompt)
        except ImportError:
            logger.debug("ScrapeGraphAI not available, using httpx fallback")
        except Exception as e:
            logger.debug(f"ScrapeGraphAI failed: {e}")

        # Fallback: fetch page with httpx, send to LLM
        return await self._httpx_llm_extract(url, prompt)

    async def _scrapegraph_extract(self, url: str, prompt: str) -> Dict:
        """Use ScrapeGraphAI for extraction."""
        from scrapegraphai.graphs import SmartScraperGraph

        graph_config = {
            "llm": {
                "model": AI_MODEL,
                "api_key": OPENAI_API_KEY,
                "base_url": OPENAI_BASE_URL,
            },
            "verbose": False,
            "headless": True,
        }

        smart_scraper = SmartScraperGraph(
            config=graph_config,
            source=url,
            user_prompt=prompt,
        )

        result = smart_scraper.run()
        if isinstance(result, str):
            return self._parse_json(result)
        return result

    async def _httpx_llm_extract(self, url: str, prompt: str) -> Dict:
        """Fetch page with httpx, send HTML to LLM for extraction."""
        import httpx

        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                resp = await client.get(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml",
                    },
                )
                html = resp.text[:15000]  # Truncate for LLM context

                # Send to OmniRoute
                full_prompt = f"""Extract information from this HTML webpage.

URL: {url}

HTML (truncated):
{html}

TASK: {prompt}

Return ONLY valid JSON, no markdown, no explanation."""

                async with httpx.AsyncClient(timeout=60.0) as ai_client:
                    ai_resp = await ai_client.post(
                        f"{OPENAI_BASE_URL}/chat/completions",
                        json={
                            "model": AI_MODEL,
                            "messages": [
                                {"role": "system", "content": "You are a web data extraction assistant. Return only valid JSON."},
                                {"role": "user", "content": full_prompt},
                            ],
                            "temperature": 0.1,
                            "max_tokens": 2000,
                        },
                        headers={
                            "Authorization": f"Bearer {OPENAI_API_KEY}",
                            "Content-Type": "application/json",
                        },
                    )

                    if ai_resp.status_code == 200:
                        content = ai_resp.json()["choices"][0]["message"]["content"]
                        return self._parse_json(content)
                    else:
                        logger.warning(f"AI extraction failed: {ai_resp.status_code}")
                        return {}

        except Exception as e:
            logger.error(f"httpx+LLM extraction failed for {url}: {e}")
            return {}

    def _parse_json(self, text: str) -> Dict:
        """Parse JSON from LLM response, handling markdown wrappers."""
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse AI response as JSON: {cleaned[:200]}")
            return {}


ai_scraper = AIScraper()
