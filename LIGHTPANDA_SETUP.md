# Lightpanda Browser Setup

## Overview
Lightpanda is a Zig-based headless browser designed for web scraping.
It's faster and lighter than Playwright for simple page fetching.

## Docker Setup

### Add to docker-compose.yml
```yaml
services:
  lightpanda:
    image: lightpanda/browser:nightly
    ports:
      - "8080:8080"
      - "9222:9222"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Environment Variables
```bash
LIGHTPANDA_URL=http://lightpanda:8080
LIGHTPANDA_CDP_URL=ws://lightpanda:9222
BROWSER_FALLBACK_CHAIN=lightpanda,playwright,http
```

## Browser Fallback Chain
The system automatically falls back:
1. **Lightpanda** - Try first (fastest)
2. **Playwright** - If Lightpanda fails (full JS)
3. **HTTP** - Final fallback (no JS)

## Usage in Code
```python
from worker.browser import get_browser_manager

manager = await get_browser_manager()
result = await manager.fetch("https://example.com")
# Automatically uses best available browser
```

## CDP (Chrome DevTools Protocol)
For JavaScript-rendered pages:
```python
result = await manager.fetch_with_javascript(
    "https://spa-website.com",
    wait_for=".content"
)
```

## Health Checks
```python
health = await manager.health_check()
# {"lightpanda": true, "playwright": true, "http": true}
```

## Performance
- Lightpanda: ~50ms per page
- Playwright: ~200ms per page
- HTTP: ~100ms per page (no JS)

## Troubleshooting
- If Lightpanda fails, system auto-falls back to Playwright
- Check logs: `docker compose logs lightpanda`
- Test connection: `curl http://localhost:8080`
