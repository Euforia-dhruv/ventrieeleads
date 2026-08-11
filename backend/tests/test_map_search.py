"""Tests for map-search parity: geocoder, base-provider search_by_map delegation,
and registry routing of coordinate searches to search_by_map."""
import pytest
from unittest.mock import AsyncMock, patch

from worker.providers.base import BaseProvider, NormalizedLead
from worker.providers.registry import ProviderRegistry
from worker.services.geocode import ReverseGeocoder, _CITIES


class _TextProvider(BaseProvider):
    """Directory-style provider: only understands text locations."""
    name = "Text Directory"
    slug = "text_dir"
    supports_map_search = True

    def __init__(self, config=None):
        super().__init__(config)
        self.calls = []

    async def search(self, query, location="", max_results=50, min_rating=0,
                     min_reviews=0, **kwargs):
        self.calls.append(("search", query, location))
        return [NormalizedLead(name=f"{query} in {location}", source=self.slug)]


class _MapProvider(_TextProvider):
    """Provider that genuinely supports coordinate search."""
    slug = "map_dir"

    async def search_by_map(self, query, lat, lng, radius_km=10.0, max_results=50,
                            min_rating=0, min_reviews=0, **kwargs):
        self.calls.append(("search_by_map", query, lat, lng, radius_km))
        return [NormalizedLead(name="map hit", source=self.slug)]


class TestReverseGeocoder:
    def test_nearest_city_for_dubai(self):
        geocoder = ReverseGeocoder()
        near = geocoder._nearest_city(25.2048, 55.2708)
        assert near["name"] == "Dubai"

    def test_nearest_city_for_london(self):
        geocoder = ReverseGeocoder()
        near = geocoder._nearest_city(51.5074, -0.1278)
        assert near["name"] == "London"

    def test_haversine_zero_distance(self):
        assert ReverseGeocoder._haversine(25.0, 55.0, 25.0, 55.0) == 0.0

    def test_haversine_reasonable(self):
        d = ReverseGeocoder._haversine(25.2048, 55.2708, 24.4539, 54.3773)
        assert 50 < d < 200  # Dubai to Abu Dhabi ~130km

    @pytest.mark.asyncio
    async def test_reverse_online_failure_falls_back(self):
        with patch("worker.services.geocode.ReverseGeocoder._reverse_online",
                   new=AsyncMock(return_value=None)):
            geocoder = ReverseGeocoder()
            result = await geocoder.reverse(25.2048, 55.2708)
            assert result is not None
            assert result["name"] == "Dubai"

    @pytest.mark.asyncio
    async def test_reverse_far_point_returns_none(self):
        with patch("worker.services.geocode.ReverseGeocoder._reverse_online",
                   new=AsyncMock(return_value=None)):
            geocoder = ReverseGeocoder()
            result = await geocoder.reverse(-60.0, -120.0)
            assert result is None

    @pytest.mark.asyncio
    async def test_geocode_to_location_returns_text(self):
        with patch("worker.services.geocode.ReverseGeocoder._reverse_online",
                   new=AsyncMock(return_value=None)):
            from worker.services.geocode import geocode_to_location
            loc = await geocode_to_location(25.2048, 55.2708)
            assert "Dubai" in loc


class TestBaseProviderMapDelegation:
    @pytest.mark.asyncio
    async def test_search_by_map_delegates_to_search(self):
        provider = _TextProvider()
        with patch("worker.services.geocode.geocode_to_location",
                   new=AsyncMock(return_value="Dubai, AE")):
            results = await provider.search_by_map(
                query="dentists", lat=25.2048, lng=55.2708, radius_km=10
            )
        assert len(results) == 1
        assert provider.calls[0][0] == "search"
        assert provider.calls[0][2] == "Dubai, AE"

    @pytest.mark.asyncio
    async def test_search_by_map_no_location_returns_empty(self):
        provider = _TextProvider()
        with patch("worker.services.geocode.geocode_to_location",
                   new=AsyncMock(return_value="")):
            results = await provider.search_by_map(
                query="dentists", lat=-60.0, lng=-120.0
            )
        assert results == []


class TestRegistryMapRouting:
    @pytest.mark.asyncio
    async def test_search_single_routes_to_search_by_map_when_supported(self):
        registry = ProviderRegistry()
        provider = _MapProvider()
        registry.register(provider)
        provider.initialize = AsyncMock(return_value=True)

        results = await registry.search_single(
            provider_slug="map_dir",
            query="dentists",
            lat=25.2048,
            lng=55.2708,
            radius_km=5,
        )
        assert results and results[0].name == "map hit"
        assert provider.calls[0][0] == "search_by_map"
        assert provider.calls[0][2] == 25.2048
        assert provider.calls[0][3] == 55.2708

    @pytest.mark.asyncio
    async def test_search_single_uses_text_when_no_coords(self):
        registry = ProviderRegistry()
        provider = _MapProvider()
        registry.register(provider)
        provider.initialize = AsyncMock(return_value=True)

        results = await registry.search_single(
            provider_slug="map_dir", query="dentists", location="Dubai"
        )
        assert results and results[0].name == "dentists in Dubai"
        assert provider.calls[0][0] == "search"

    @pytest.mark.asyncio
    async def test_search_all_uses_map_path(self):
        registry = ProviderRegistry()
        provider = _MapProvider()
        registry.register(provider)
        provider.initialize = AsyncMock(return_value=True)

        results = await registry.search_all(
            query="dentists",
            providers=["map_dir"],
            lat=25.2048,
            lng=55.2708,
            radius_km=10,
        )
        assert results and results[0].name == "map hit"

    @pytest.mark.asyncio
    async def test_cache_keys_differ_for_coords(self):
        registry = ProviderRegistry()
        text_key = registry._get_cache_key("single:p", query="q", location="Dubai", max_results=10)
        map_key = registry._get_cache_key(
            "single:p", query="q", location="Dubai", max_results=10,
            lat=25.2, lng=55.3, radius_km=10,
        )
        assert text_key != map_key


def test_gazetteer_has_uae_cities():
    names = {c["name"] for c in _CITIES}
    assert {"Dubai", "Abu Dhabi", "Sharjah"} <= names
