"""Integration test for browser abstraction layer."""
import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_http_browser():
    """Test HTTP browser backend."""
    from worker.browser.http_browser import HTTPBrowser

    browser = HTTPBrowser()
    await browser.initialize()

    result = await browser.fetch("https://httpbin.org/get")
    logger.info(f"HTTP Browser: success={result.success}, status={result.status_code}")

    health = await browser.health_check()
    logger.info(f"HTTP Health: {health}")

    await browser.cleanup()
    return result.success


async def test_browser_pool():
    """Test browser pool."""
    from worker.browser.pool import BrowserPool
    from worker.browser.http_browser import HTTPBrowser

    pool = BrowserPool(max_concurrent=2, max_per_type=2)

    browser = HTTPBrowser()
    await browser.initialize()
    pool.register("http", browser)

    result = await pool.execute("http", lambda b: b.fetch("https://httpbin.org/get"))
    logger.info(f"Pool execute: success={result.success}")

    stats = pool.get_stats()
    logger.info(f"Pool stats: {stats}")

    await pool.cleanup_all()
    return result.success


async def test_browser_manager():
    """Test browser manager with fallback."""
    from worker.browser.manager import BrowserManager

    manager = BrowserManager(fallback_chain=["http"])

    result = await manager.fetch("https://httpbin.org/get")
    logger.info(f"Manager fetch: success={result.success}, type={result.browser_type.value}")

    health = await manager.health_check()
    logger.info(f"Manager health: {health}")

    stats = await manager.get_stats()
    logger.info(f"Manager stats: {stats}")

    await manager.cleanup()
    return result.success


async def main():
    """Run all tests."""
    logger.info("Starting browser integration tests...")

    tests = [
        ("HTTP Browser", test_http_browser),
        ("Browser Pool", test_browser_pool),
        ("Browser Manager", test_browser_manager),
    ]

    results = []
    for name, test_func in tests:
        try:
            logger.info(f"\n--- Testing {name} ---")
            success = await test_func()
            results.append((name, success))
            logger.info(f"{name}: {'PASS' if success else 'FAIL'}")
        except Exception as e:
            logger.error(f"{name} error: {e}")
            results.append((name, False))

    logger.info("\n=== Test Results ===")
    for name, success in results:
        logger.info(f"{name}: {'PASS' if success else 'FAIL'}")

    all_passed = all(success for _, success in results)
    logger.info(f"\nOverall: {'PASS' if all_passed else 'FAIL'}")

    return all_passed


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
