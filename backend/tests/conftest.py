import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


@pytest.fixture
def sample_lead_data():
    return {
        "company_name": "Test Company LLC",
        "company_website": "https://testcompany.ae",
        "location": "Dubai Marina",
        "city": "Dubai",
        "country": "AE",
        "industry": "IT Companies",
        "phone": "+971 4 123 4567",
        "email": "info@testcompany.ae",
        "address": "Dubai Marina, Dubai, UAE",
    }
