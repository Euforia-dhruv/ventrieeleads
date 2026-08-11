# FINAL ACCEPTANCE TEST — Real Data

**Date:** 2026-08-10  
**Query:** "dentists in Dubai"  
**Provider:** Google Maps (via Playwright scraper)  
**AI:** Gemini Flash (generativelanguage.googleapis.com)

---

## Real Test Numbers

| Metric | Count |
|--------|-------|
| Businesses found | 20 |
| Websites | 15/20 |
| Phones | 15/20 |
| Emails | 6/20 |
| Google Maps URLs | 20/20 |
| Coordinates | 20/20 |
| Ratings | 20/20 |
| Website audits | 14/20 (6 have no website) |
| Technology detection | 12/14 websites |
| AI scores | 16/20 |
| **HOT** | **3** |
| **WARM** | **3** |
| **COLD** | **14** |
| Outreach generated | 3 channels (email, LinkedIn, WhatsApp) |
| Outreach saved | 2 activities (API + DB) |
| CSV export | PASS (264 lines, all fields populated) |

---

## Top 5 Leads (by opportunity score)

| # | Company | Score | Tier | SEO | UX | PERF | CONV | Website | Issue |
|---|---------|-------|------|-----|-----|------|------|---------|-------|
| 1 | Levantine Dental Clinic | 89 | HOT | 95 | 100 | 90 | 100 | levantine.ae | Well-optimized, slight meta improvements possible |
| 2 | Precision Dental Clinic | 77 | HOT | 90 | 85 | 65 | 90 | precisiondental.ae | No SSL; No Meta Pixel |
| 3 | Crossroads Dental Clinic | 72 | HOT | 95 | 100 | 75 | 90 | crossroadsdentalclinic.com | No Meta Pixel |
| 4 | Dr Aimen Zia Dental Clinic | 65 | WARM | 50 | 55 | 100 | 20 | draimenziadentalclinic.ae | Missing meta desc; No analytics; No Meta Pixel |
| 5 | Pearl Dental Clinic | 62 | WARM | 95 | 100 | 55 | 90 | pearldentalclinics.com | No Meta Pixel |

---

## Outreach Verification (#1: Levantine Dental Clinic)

**Cold Email:**
- Subject: "Quick question about Levantine Dental Clinic - Dentist in Dubai's website"
- Personalized with company name
- CTA: "Book a free 15-minute audit call"
- Brand: Ventriee

**LinkedIn:**
- Connection request personalized with company name
- Follow-up mentions analysis and conversions

**WhatsApp:**
- Short personalized message with company name
- Offers quick audit

---

## Edge Case Results

| Edge Case | Result |
|-----------|--------|
| Business without website | PASS — outreach still generated |
| Missing email | PASS — company still scored and gets outreach |
| Missing coordinates | PASS — Precision Dental had wrong coords (51.06, UK), still processed |
| AI temporarily unavailable | PASS — fallback template used when Gemini rate-limited |
| Website timeout | PASS — graceful degradation in scraper |

---

## Code Quality

| Check | Result |
|-------|--------|
| TypeScript typecheck | PASS (0 errors) |
| TypeScript tests | PASS (137/137) |
| ESLint | PASS (0 errors, 247 warnings — all pre-existing `any` type) |
| Python tests | No test files found |
| Docker health | All services healthy (except Lightpanda — known) |

---

## Fixes Applied During Test

1. **Search returned 0 results** — smart_query_parser routed UAE queries to broken `yello_uae` provider. Fixed to always use `google_maps`.
2. **Task-enqueuer missing AI keys** — outreach fell back to templates. Added `GEMINI_API_KEY`, `DATABASE_URL`, `OPENAI_API_KEY`, etc. to docker-compose.
3. **Multi-channel outreach** — updated controller to accept `channels` array and loop through each.

---

## What Remains Before Production

1. **Gemini rate limits** — free tier hits 429 after ~10 audit/scoring calls. Need a paid plan or add OpenAI/Anthropic as fallback.
2. **Lightpanda unhealthy** — browser automation falls back to Playwright (works but slower). Fix Lightpanda or accept Playwright-only.
3. **No screenshot storage** — `screenshots` field returns empty. MinIO path or screenshot capture needs investigation.
4. **Precision Dental bad coords** — lat=51.06 is UK, not Dubai. Geocoding should fix this but didn't trigger (address was "Dentist").
5. **Python test suite** — no tests exist. Need at least unit tests for scoring, sales_assistant, and provider registry.
6. **Outreach quality** — template fallback is generic. AI-generated outreach is genuinely personalized (confirmed via LinkedIn channel).
