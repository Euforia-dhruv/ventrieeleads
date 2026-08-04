# Provider Status

## Active Providers (19 total)

### Free Scraping (No API Key)
| Provider | Status | Method | Rate Limit |
|----------|--------|--------|------------|
| google_maps | ✅ Active | Playwright | 100/day |
| clutch | ✅ Active | HTTP | 50/day |
| contra | ✅ Active | HTTP | 50/day |
| peopleperhour | ✅ Active | HTTP | 50/day |
| dubai_directory | ✅ Active | HTTP | 50/day |
| yello_uae | ✅ Active | HTTP | 50/day |
| designrush | ✅ Active | HTTP | 50/day |
| goodfirms | ✅ Active | HTTP | 50/day |
| crunchbase | ✅ Active | Playwright | 30/day |
| instagram | ✅ Active | Playwright | 30/day |
| scrapling | ✅ Active | Python | Unlimited |

### Free API (Need keys)
| Provider | Status | API Key | Free Tier |
|----------|--------|---------|-----------|
| outscraper | ⏳ Pending | OUTSCRAPER_API_KEY | 100 credits |
| apollo | ⏳ Pending | APOLLO_API_KEY | 50/mo |
| hunter | ⏳ Pending | HUNTER_API_KEY | 25/mo |
| apify | ⏳ Pending | APIFY_API_TOKEN | $5/mo |
| builtwith | ⏳ Pending | BUILTWITH_API_KEY | Basic |
| wappalyzer | ⏳ Pending | WAPPALYZER_API_KEY | 50/mo |
| calendly | ⏳ Pending | CALENDLY_API_KEY | Free |
| loom | ⏳ Pending | LOOM_API_KEY | Free |

## Health Monitoring

### Auto-Disable Rules
- Provider disabled if success rate < 30% over 24 hours
- Auto-re-enable after 24 hours of no failures
- Manual override via admin API

### Metrics Tracked
- Success rate per country
- Average latency
- Results per request
- Duplicate rate
- Error messages
- Cost estimates

### Health Check Schedule
- Every hour: Check all provider health
- Every 2 hours: Auto-disable failing providers
- Daily: Cleanup old metrics (90 days)

## Provider Selection Logic
1. Check enabled providers from DB config
2. Rank by success rate × latency score
3. Filter by country support
4. Select top N based on concurrency
5. Fall back to next provider on failure

## Configuration
Enable/disable providers via admin settings:
```json
{
  "key": "enabled_providers",
  "value": ["google_maps", "clutch", "contra"]
}
```
