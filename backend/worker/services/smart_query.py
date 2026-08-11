"""Smart query parsing - turns natural-language search strings into structured provider intents.

Example inputs:
  "dentists near London"         -> industry=dentists, location=London, map_intent=true
  "hotels in Dubai Marina"       -> industry=hotels, area=Dubai Marina, country=UAE hint
  "restaurants near Eiffel Tower"-> industry=restaurants, poi=, map_intent=true
  "construction companies in Sydney" -> industry=construction companies, city=Sydney

Pure Python (regex + keyword tables), no external NLP deps, runs in a fraction of a ms
so it can be applied per-job without a model call. If nothing matches it falls back to
treating the whole query as the industry search term.
"""
import re
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Location keywords that trigger a map/coordinate intent (radius around a point).
NEAR_KEYWORDS = ["near", "around", "close to", "nearby", "next to"]

# Common filler words stripped from the industry phrase.
STOPWORDS = {
    "a", "an", "the", "of", "in", "at", "on", "for", "with", "and", "or",
    "companies", "company", "businesses", "business", "firms", "agency", "agencies",
    "providers", "services", "service", "best", "top", "good", "affordable", "cheap",
    "please", "find", "search", "list", "me", "us", "some", "any",
}

# Province/city suffix matching for country inference.
GCC_CITIES = {
    "dubai", "abu dhabi", "sharjah", "ajman", "ras al khaimah", "umm al quwain",
    "al ain", "fujairah", "doha", "riyadh", "jeddah", "mecca", "medina", "khobar",
    "dammam", "kuwait city", "muscat", "manama", "salmiya",
}
UAE_AREAS = {
    "downtown dubai", "business bay", "dubai marina", "jlt", "jumeirah",
    "jumeirah lake towers", "jumeirah beach residence", "palm jumeirah",
    "deira", "bur dubai", "al barsha", "al quoz", "internet city", "media city",
    "dubai silicon oasis", "dubai south", "al reem island", "yas island",
    "saadiyat island", "al nahda", "al majaz", "corniche", "downtown abu dhabi",
}
WORLD_CITIES = {
    "london", "paris", "new york", "sydney", "toronto", "berlin", "mumbai",
    "bangalore", "delhi", "singapore", "hong kong", "tokyo", "dubai", "madrid",
    "barcelona", "rome", "amsterdam", "berlin", "stockholm", "moscow", "istanbul",
    "los angeles", "chicago", "san francisco", "miami", "houston", "seattle",
    "austin", "melbourne", "brisbane", "perth", "auckland", "wellington",
    "johannesburg", "cairo", "nairobi", "lagos", "casablanca", "shanghai",
    "beijing", "seoul", "bangkok", "kuala lumpur", "jakarta", "manila",
}


class SmartQuery:
    """Structured intent extracted from a natural-language search string."""

    __slots__ = (
        "raw", "industry", "location", "city", "area", "country",
        "map_intent", "query_hint", "confidence",
    )

    def __init__(self):
        self.raw: str = ""
        self.industry: str = ""
        self.location: str = ""
        self.city: str = ""
        self.area: str = ""
        self.country: str = ""
        self.map_intent: bool = False
        self.query_hint: str = ""
        self.confidence: float = 0.0

    def to_dict(self) -> Dict:
        return {
            "raw": self.raw,
            "industry": self.industry,
            "location": self.location,
            "city": self.city,
            "area": self.area,
            "country": self.country,
            "map_intent": self.map_intent,
            "query_hint": self.query_hint,
            "confidence": round(self.confidence, 2),
        }


class SmartQueryParser:
    """Parse natural-language queries into structured intents."""

    def parse(self, query: str) -> SmartQuery:
        q = SmartQuery()
        q.raw = query or ""
        text = (query or "").strip().lower()
        if not text:
            return q

        # 1. Split into <industry> + <location> around a location keyword.
        location_part = ""
        industry_part = text
        for kw in NEAR_KEYWORDS:
            idx = text.find(kw)
            if idx >= 0:
                industry_part = text[:idx].strip(" ,-")
                location_part = text[idx + len(kw):].strip(" ,-")
                q.map_intent = True
                q.query_hint = "near"
                break
        if not location_part:
            # "X in Y" pattern
            m = re.search(r'\bin\s+(.+)$', text)
            if m:
                industry_part = text[: m.start(1)].strip(" ,-")
                location_part = m.group(1).strip()
                q.query_hint = "in"

        if not location_part:
            # "X Y" where last token is a known city
            tokens = text.split()
            for i in range(len(tokens) - 1, -1, -1):
                candidate = " ".join(tokens[i:])
                if candidate in WORLD_CITIES or candidate in GCC_CITIES:
                    location_part = candidate
                    industry_part = " ".join(tokens[:i]).strip(" ,-")
                    q.query_hint = "city-tail"
                    break

        # 2. Clean industry phrase.
        industry_words = [
            w for w in re.split(r'\s+', industry_part)
            if w and w not in STOPWORDS
        ]
        q.industry = " ".join(industry_words)

        # 3. Classify location into city/area/country.
        if location_part:
            q.location = location_part
            q.city = self._detect_city(location_part)
            q.area = self._detect_area(location_part)
            q.country = self._detect_country(location_part, q.city, q.area)

        # 4. Confidence: near-intent + known location = high.
        if q.map_intent and (q.city or q.area):
            q.confidence = 0.9
        elif q.location and q.industry:
            q.confidence = 0.7
        elif q.industry:
            q.confidence = 0.4

        logger.debug("Smart parse: %s -> %s", text, q.to_dict())
        return q

    def _detect_city(self, location: str) -> str:
        for c in WORLD_CITIES | GCC_CITIES:
            if c in location:
                return c
        return ""

    def _detect_area(self, location: str) -> str:
        for a in UAE_AREAS:
            if a in location:
                return a
        return ""

    def _detect_country(self, location: str, city: str, area: str) -> str:
        if area or city in ("dubai", "abu dhabi", "sharjah", "ajman", "fujairah",
                            "al ain", "ras al khaimah", "umm al quwain"):
            return "AE"
        if city in ("doha",):
            return "QA"
        if city in ("riyadh", "jeddah", "mecca", "medina", "khobar", "dammam"):
            return "SA"
        if city in ("kuwait city",):
            return "KW"
        if city in ("muscat",):
            return "OM"
        if city in ("manama", "salmiya"):
            return "BH"
        if city in ("london",):
            return "GB"
        if city in ("paris",):
            return "FR"
        if city in ("sydney", "melbourne", "brisbane", "perth"):
            return "AU"
        if city in ("toronto",):
            return "CA"
        if city in ("new york", "los angeles", "chicago", "san francisco",
                    "miami", "houston", "seattle", "austin"):
            return "US"
        if city in ("mumbai", "delhi", "bangalore"):
            return "IN"
        return ""

    def provider_hint(self, parsed: SmartQuery) -> Optional[str]:
        """Suggest the best provider slug for this intent."""
        return "google_maps"


smart_query_parser = SmartQueryParser()
