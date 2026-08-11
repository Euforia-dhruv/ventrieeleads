import pytest
from worker.services.smart_query import SmartQueryParser


@pytest.fixture
def parser():
    return SmartQueryParser()


class TestSmartQueryParser:
    def test_near_intent(self, parser):
        parsed = parser.parse("dentists near London")
        assert parsed.map_intent is True
        assert parsed.location == "london"
        assert parsed.industry == "dentists"
        assert parsed.city == "london"
        assert parsed.country == "GB"

    def test_in_pattern(self, parser):
        parsed = parser.parse("hotels in Dubai Marina")
        assert parsed.area == "dubai marina"
        assert parsed.city == "dubai"
        assert parsed.country == "AE"
        assert "hotels" in parsed.industry

    def test_city_tail(self, parser):
        parsed = parser.parse("construction companies in Sydney")
        assert parsed.city == "sydney"
        assert parsed.country == "AU"

    def test_gcc_detection(self, parser):
        parsed = parser.parse("restaurants in Abu Dhabi")
        assert parsed.area == "abu dhabi" or parsed.city == "abu dhabi"
        assert parsed.country == "AE"

    def test_provider_hint_map_intent(self, parser):
        parsed = parser.parse("cafes near Eiffel Tower")
        assert parsed.map_intent
        assert parser.provider_hint(parsed) == "google_maps"

    def test_empty_query(self, parser):
        parsed = parser.parse("")
        assert parsed.industry == ""
        assert parsed.confidence == 0.0