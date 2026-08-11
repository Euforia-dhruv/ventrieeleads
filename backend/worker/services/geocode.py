"""Lightweight reverse-geocoder so map coordinates can be turned into a text
location for directory-style providers that search by city/area name.

Uses OpenStreetMap Nominatim by default (free, no key). Falls back gracefully to
a static nearest-city lookup when the network is unavailable, so map searches
never hard-fail. Results are cached in-memory to respect Nominatim usage policy.
"""
import logging
import time
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"

# Static gazetteer used as an offline fallback when Nominatim is unreachable.
_CITIES: List[Dict] = [
    # UAE
    {"name": "Dubai", "country": "AE", "lat": 25.2048, "lng": 55.2708},
    {"name": "Abu Dhabi", "country": "AE", "lat": 24.4539, "lng": 54.3773},
    {"name": "Sharjah", "country": "AE", "lat": 25.3463, "lng": 55.4209},
    {"name": "Ajman", "country": "AE", "lat": 25.4052, "lng": 55.5136},
    {"name": "Ras Al Khaimah", "country": "AE", "lat": 25.8007, "lng": 55.9762},
    {"name": "Fujairah", "country": "AE", "lat": 25.1288, "lng": 56.3264},
    {"name": "Umm Al Quwain", "country": "AE", "lat": 25.5643, "lng": 55.5528},
    # GCC
    {"name": "Riyadh", "country": "SA", "lat": 24.7136, "lng": 46.6753},
    {"name": "Jeddah", "country": "SA", "lat": 21.4858, "lng": 39.1925},
    {"name": "Doha", "country": "QA", "lat": 25.2854, "lng": 51.531},
    {"name": "Kuwait City", "country": "KW", "lat": 29.3759, "lng": 47.9774},
    # International
    {"name": "London", "country": "GB", "lat": 51.5074, "lng": -0.1278},
    {"name": "Manchester", "country": "GB", "lat": 53.4808, "lng": -2.2426},
    {"name": "Paris", "country": "FR", "lat": 48.8566, "lng": 2.3522},
    {"name": "Berlin", "country": "DE", "lat": 52.52, "lng": 13.405},
    {"name": "New York", "country": "US", "lat": 40.7128, "lng": -74.006},
    {"name": "Los Angeles", "country": "US", "lat": 34.0522, "lng": -118.2437},
    {"name": "Chicago", "country": "US", "lat": 41.8781, "lng": -87.6298},
    {"name": "Toronto", "country": "CA", "lat": 43.6532, "lng": -79.3832},
    {"name": "Mumbai", "country": "IN", "lat": 19.076, "lng": 72.8777},
    {"name": "Singapore", "country": "SG", "lat": 1.3521, "lng": 103.8198},
    {"name": "Tokyo", "country": "JP", "lat": 35.6762, "lng": 139.6503},
    {"name": "Sydney", "country": "AU", "lat": -33.8688, "lng": 151.2093},
]


class ReverseGeocoder:
    """Reverse-geocode lat/lng into a "City, CountryCode" text location."""

    def __init__(self, ttl_seconds: int = 3600):
        self._cache: Dict[tuple, Dict] = {}
        self._ttl = ttl_seconds

    def _cached(self, lat: float, lng: float) -> Optional[Dict]:
        entry = self._cache.get((lat, lng))
        if entry and time.time() - entry["ts"] < self._ttl:
            return entry["data"]
        return None

    def _nearest_city(self, lat: float, lng: float) -> Dict:
        """Offline nearest-city approximation using haversine distance."""
        best, best_d = None, float("inf")
        for c in _CITIES:
            d = self._haversine(lat, lng, c["lat"], c["lng"])
            if d < best_d:
                best, best_d = c, d
        return best or {"name": "", "country": "", "lat": lat, "lng": lng}

    @staticmethod
    def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        import math
        R = 6371.0
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lng2 - lng1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    async def reverse(self, lat: float, lng: float, max_distance_km: float = 80.0) -> Optional[Dict]:
        """Resolve coords to {name, country} or None if no nearby known place."""
        cached = self._cached(lat, lng)
        if cached:
            return cached

        result = await self._reverse_online(lat, lng)
        if not result:
            near = self._nearest_city(lat, lng)
            if near.get("name") and self._haversine(lat, lng, near["lat"], near["lng"]) <= max_distance_km:
                result = {"name": near["name"], "country": near["country"]}

        if result:
            self._cache[(lat, lng)] = {"ts": time.time(), "data": result}
        return result

    async def forward(self, query: str, limit: int = 5) -> List[Dict]:
        """Resolve a place name to a list of candidate locations.

        Returns entries with: name, display_name, latitude, longitude, country,
        location_type. Empty list when nothing resolvable (network down / no match).
        """
        if not query or len(query.strip()) < 2:
            return []

        try:
            import httpx
            async with httpx.AsyncClient(timeout=6, headers={
                "User-Agent": "leads-platform/1.0 (lead-discovery)",
            }) as client:
                resp = await client.get(
                    NOMINATIM_SEARCH_URL,
                    params={
                        "q": query,
                        "format": "jsonv2",
                        "limit": limit,
                        "addressdetails": 1,
                    },
                )
                if resp.status_code != 200:
                    return []
                data = resp.json()
                if not isinstance(data, list):
                    return []

                results = []
                for item in data:
                    addr = item.get("address", {}) or {}
                    country = addr.get("country_code", "").upper()
                    place_type = item.get("type", "city")
                    results.append({
                        "name": item.get("name", ""),
                        "display_name": item.get("display_name", ""),
                        "latitude": float(item.get("lat", 0) or 0),
                        "longitude": float(item.get("lon", 0) or 0),
                        "country": country,
                        "country_name": addr.get("country", ""),
                        "location_type": place_type,
                    })
                return results
        except Exception as e:
            logger.debug(f"Nominatim forward geocode failed for {query!r}: {e}")
            return []

    async def _reverse_online(self, lat: float, lng: float) -> Optional[Dict]:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=6, headers={
                "User-Agent": "leads-platform/1.0 (lead-discovery)",
            }) as client:
                resp = await client.get(
                    NOMINATIM_URL,
                    params={
                        "lat": lat, "lon": lng,
                        "format": "jsonv2",
                        "zoom": 10,
                        "addressdetails": 1,
                    },
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if not data:
                    return None
                addr = data.get("address", {})
                name = (addr.get("city") or addr.get("town") or addr.get("village")
                        or addr.get("state") or "")
                country = addr.get("country_code", "").upper()
                if not name:
                    return None
                return {"name": name, "country": country}
        except Exception as e:
            logger.debug(f"Nominatim reverse geocode failed ({lat},{lng}): {e}")
            return None

    def location_text(self, lat: float, lng: float, radius_km: float = 10.0) -> str:
        """Build a text location string for directory providers: 'City, CountryCode'."""
        result = self._cached(lat, lng)
        if not result:
            return ""
        name = result.get("name", "")
        country = result.get("country", "")
        if name and country:
            return f"{name}, {country}"
        return name


reverse_geocoder = ReverseGeocoder()


async def geocode_to_location(lat: float, lng: float, radius_km: float = 10.0) -> str:
    """Async helper returning a text location for a map point ('' if unresolved)."""
    await reverse_geocoder.reverse(lat, lng)
    return reverse_geocoder.location_text(lat, lng, radius_km)


async def geocode_place(query: str, limit: int = 5) -> List[Dict]:
    """Async helper returning candidate locations for a place name ([] if none)."""
    return await reverse_geocoder.forward(query, limit=limit)


def geocode_sync(query: str) -> Optional[Dict]:
    """Synchronous forward geocode for use in Celery tasks. Returns first match or None."""
    import httpx
    try:
        resp = httpx.get(
            NOMINATIM_SEARCH_URL,
            params={"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": "leads-platform/1.0 (lead-discovery)"},
            timeout=6,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data:
            return None
        item = data[0]
        addr = item.get("address", {}) or {}
        return {
            "latitude": float(item.get("lat", 0) or 0),
            "longitude": float(item.get("lon", 0) or 0),
            "city": addr.get("city") or addr.get("town") or addr.get("village") or "",
            "country": addr.get("country_code", "").upper(),
        }
    except Exception:
        return None
