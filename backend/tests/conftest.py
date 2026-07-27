import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://test:test@localhost:5432/test_leads')

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

@pytest.fixture(scope='session')
def event_loop():
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope='session')
async def async_session():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session_factory() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def client():
    from src.main import app
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

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
        "address": "Dubai Marina, Dubai, UAE"
    }