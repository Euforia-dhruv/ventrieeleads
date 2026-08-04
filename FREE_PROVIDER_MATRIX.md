# Free Provider Matrix

## Overview
All providers are free or have free tiers. No paid subscriptions required.

## Tier 1: Free Scraping (No API Key)
| Provider | Source | Method | Rate Limit |
|----------|--------|--------|------------|
| Google Maps | Google Places | Playwright | 100/day |
| Clutch | clutch.co | HTTP scrape | 50/day |
| Contra | contra.com | HTTP scrape | 50/day |
| PeoplePerHour | peopleperhour.com | HTTP scrape | 50/day |
| Dubai Directory | dubai-businessdirectory.com | HTTP scrape | 50/day |
| Yello UAE | yello.ae | HTTP scrape | 50/day |
| DesignRush | designrush.com | HTTP scrape | 50/day |
| GoodFirms | goodfirms.com | HTTP scrape | 50/day |
| Crunchbase | crunchbase.com | Playwright | 30/day |
| Instagram | instagram.com | Playwright | 30/day |
| Scrapling | Any website | Python library | Unlimited |

## Tier 2: Free API (Sign up, no credit card)
| Provider | Free Allowance | Sign Up |
|----------|----------------|---------|
| Outscraper | 100 credits | outscraper.com |
| Apollo | 50 credits/mo | apollo.io |
| Hunter | 25 searches/mo | hunter.io |
| Apify | $5/mo credit | apify.com |
| BuiltWith | Basic free | builtwith.com |
| Wappalyzer | 50 lookups/mo | wappalyzer.com |
| Calendly | Free tier | calendly.com |
| Loom | Free tier | loom.com |

## Tier 3: Optional Paid (Enable only if you have keys)
| Provider | Cost | Notes |
|----------|------|-------|
| Phantombuster | $69/mo | Cloud automation |
| Instantly | $30/mo | Cold email |
| SmartLead | $39/mo | Cold email |
| HeyReach | $49/mo | LinkedIn |
| GoHighLevel | $97/mo | CRM |
| Clay | $149/mo | Data orchestration |

## Browser Fallback Chain
```
Lightpanda (free, fast)
  → Playwright (free, full-featured)
    → HTTP fetch (free, lightweight)
```

## Configuration
Add API keys to `.env`:
```bash
# Only if you sign up
OUTSCRAPER_API_KEY=your_key
APOLLO_API_KEY=your_key
HUNTER_API_KEY=your_key
APIFY_API_TOKEN=your_key
```
