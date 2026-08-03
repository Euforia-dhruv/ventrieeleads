# API Documentation

## Base URL

```
https://ventrieeleads.qd.je/api
```

## Authentication

### Register

```
POST /api/auth/register
```

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword123",
  "workspace_name": "My Workspace"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "John Doe", "role": "owner", "workspace_id": "uuid" },
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "workspace": { "id": "uuid", "name": "My Workspace", "slug": "my-workspace" }
  }
}
```

**Validation:**
- Email must be valid format
- Password minimum 8 characters
- Email must be unique

### Login

```
POST /api/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "remember_me": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "John Doe", "role": "owner", "workspace_id": "uuid" },
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Logout

```
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "success": true, "message": "Logged out successfully" }
```

### Logout All Devices

```
POST /api/auth/logout-all
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "success": true, "message": "Logged out from all devices" }
```

### Refresh Token

```
POST /api/auth/refresh
```

**Request:**
```json
{ "refreshToken": "jwt_refresh_token" }
```

**Response (200):**
```json
{
  "success": true,
  "data": { "token": "new_jwt_token", "refreshToken": "new_refresh_token" }
}
```

### Forgot Password

```
POST /api/auth/forgot-password
```

**Request:**
```json
{ "email": "user@example.com" }
```

**Response (200):**
```json
{ "success": true, "message": "If the email exists, a reset link has been sent" }
```

### Reset Password

```
POST /api/auth/reset-password
```

**Request:**
```json
{ "token": "reset_token", "password": "newpassword123" }
```

**Response (200):**
```json
{ "success": true, "message": "Password reset successful" }
```

### Change Password

```
POST /api/auth/change-password
Authorization: Bearer <token>
```

**Request:**
```json
{ "current_password": "oldpassword", "new_password": "newpassword123" }
```

**Response (200):**
```json
{ "success": true, "message": "Password changed successfully" }
```

### Verify Email

```
POST /api/auth/verify-email
```

**Request:**
```json
{ "token": "verification_token" }
```

**Response (200):**
```json
{ "success": true, "message": "Email verified successfully" }
```

### Send Verification Email

```
POST /api/auth/send-verification
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "success": true, "message": "Verification email sent" }
```

### Request Magic Link

```
POST /api/auth/magic-link
```

**Request:**
```json
{ "email": "user@example.com" }
```

**Response (200):**
```json
{ "success": true, "message": "If the email exists, a magic link has been sent" }
```

### Verify Magic Link

```
POST /api/auth/magic-link/verify
```

**Request:**
```json
{ "token": "magic_link_token" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "John Doe", "role": "owner", "workspace_id": "uuid" },
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### OAuth Callback

```
POST /api/auth/oauth/callback
```

**Request:**
```json
{
  "provider": "google",
  "provider_user_id": "123456789",
  "email": "user@gmail.com",
  "name": "John Doe",
  "avatar_url": "https://...",
  "access_token": "...",
  "refresh_token": "..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@gmail.com", "name": "John Doe", "role": "owner", "workspace_id": "uuid" },
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Get Current User

```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "owner",
    "workspace_id": "uuid",
    "is_active": true,
    "email_verified": true,
    "avatar_url": null,
    "created_at": "2024-01-01T00:00:00Z",
    "last_login_at": "2024-01-15T10:30:00Z",
    "workspace": { "id": "uuid", "name": "My Workspace", "slug": "my-workspace", "plan": "free" },
    "sessions": [...]
  }
}
```

### Update Profile

```
PUT /api/auth/profile
Authorization: Bearer <token>
```

**Request:**
```json
{ "name": "New Name", "avatar_url": "https://..." }
```

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "email": "...", "name": "New Name", "role": "...", "workspace_id": "uuid", "avatar_url": "https://..." } }
```

### Get Sessions

```
GET /api/auth/sessions
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "device_name": "Chrome", "device_type": "desktop", "ip_address": "1.2.3.4", "created_at": "...", "expires_at": "..." }
  ]
}
```

### Revoke Session

```
DELETE /api/auth/sessions/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "success": true, "message": "Session revoked" }
```

---

## API Keys

### List API Keys

```
GET /api/api-keys
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Production Key", "key_prefix": "sk-abc1", "permissions": [], "is_active": true, "last_used_at": "...", "expires_at": null, "created_at": "..." }
  ]
}
```

### Create API Key

```
POST /api/api-keys
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Production Key",
  "permissions": ["leads.read", "leads.create"],
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Production Key",
    "key": "sk-abc1234567890...",
    "key_prefix": "sk-abc1",
    "permissions": ["leads.read", "leads.create"],
    "expires_at": "2025-12-31T23:59:59Z",
    "created_at": "..."
  }
}
```

> **Note:** The full API key is only shown once on creation.

### Revoke API Key

```
DELETE /api/api-keys/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "success": true, "message": "API key revoked" }
```

---

## Dashboard

### Get Stats

```
GET /api/dashboard/stats
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_leads": 1250,
    "new_leads": 45,
    "qualified_leads": 120,
    "conversion_rate": 12.5,
    "total_campaigns": 8,
    "active_campaigns": 3,
    "total_companies": 500,
    "recent_activity": [...]
  }
}
```

---

## Leads

### List Leads

```
GET /api/leads?page=1&limit=20&status=new&score_min=50&industry=hotels&location=dubai
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `status` | string | Filter by status |
| `score_min` | number | Minimum score |
| `score_max` | number | Maximum score |
| `industry` | string | Filter by industry |
| `location` | string | Filter by location |
| `source` | string | Filter by source |
| `assigned_to` | string | Filter by assigned user |
| `search` | string | Full-text search |
| `sort` | string | Sort field |
| `order` | string | Sort direction (asc/desc) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "company_id": "uuid",
      "status": "new",
      "score": 85,
      "score_label": "hot",
      "source": "google_maps",
      "assigned_to": null,
      "notes": null,
      "is_deleted": false,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1250,
  "page": 1,
  "limit": 20
}
```

### Get Lead

```
GET /api/leads/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", "workspace_id": "uuid", "company_id": "uuid", "status": "new", "score": 85, ... } }
```

### Create Lead

```
POST /api/leads
Authorization: Bearer <token>
```

**Request:**
```json
{
  "company_id": "uuid",
  "status": "new",
  "score": 85,
  "source": "manual",
  "notes": "Interested in website redesign"
}
```

**Response (201):**
```json
{ "success": true, "data": { "id": "uuid", ... } }
```

### Update Lead

```
PUT /api/leads/:id
Authorization: Bearer <token>
```

**Request:**
```json
{ "status": "contacted", "score": 90, "assigned_to": "user-uuid" }
```

**Response (200):**
```json
{ "success": true, "data": { "id": "uuid", ... } }
```

### Delete Lead

```
DELETE /api/leads/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{ "success": true, "message": "Lead deleted" }
```

---

## CRM

### Get Lead Timeline

```
GET /api/leads/:id/timeline
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "type": "created", "timestamp": "...", "details": "Lead created from Google Maps" },
    { "type": "status_changed", "timestamp": "...", "details": "Status changed from new to contacted" }
  ]
}
```

### Get Lead Tasks

```
GET /api/leads/:id/tasks
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "title": "Follow up call", "status": "pending", "due_date": "...", "assigned_to": "..." }
  ]
}
```

### Create Lead Task

```
POST /api/leads/:id/tasks
Authorization: Bearer <token>
```

**Request:**
```json
{ "title": "Follow up call", "due_date": "2024-01-20T10:00:00Z", "assigned_to": "user-uuid" }
```

**Response (201):**
```json
{ "success": true, "data": { "id": "uuid", "title": "Follow up call", ... } }
```

### Update Lead Task

```
PUT /api/leads/:id/tasks/:taskId
Authorization: Bearer <token>
```

**Request:**
```json
{ "status": "completed" }
```

### Add Lead Note

```
POST /api/leads/:id/notes
Authorization: Bearer <token>
```

**Request:**
```json
{ "content": "Spoke with CEO, interested in Q2 proposal" }
```

---

## Campaigns

### List Campaigns

```
GET /api/campaigns
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Dubai Hotels Q1", "status": "active", "industry_filter": ["hotels"], "location_filter": ["dubai"], "lead_score_min": 50, "lead_score_max": 100, "created_at": "..." }
  ]
}
```

### Create Campaign

```
POST /api/campaigns
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Abu Dhabi Restaurants",
  "industry_filter": ["restaurants", "cafes"],
  "location_filter": ["abu_dhabi"],
  "lead_score_min": 60,
  "lead_score_max": 100
}
```

### Update Campaign

```
PUT /api/campaigns/:id
Authorization: Bearer <token>
```

### Delete Campaign

```
DELETE /api/campaigns/:id
Authorization: Bearer <token>
```

### Get Campaign Leads

```
GET /api/campaigns/:id/leads
Authorization: Bearer <token>
```

### Add Lead to Campaign

```
POST /api/campaigns/:id/leads
Authorization: Bearer <token>
```

**Request:**
```json
{ "lead_id": "uuid" }
```

### Remove Lead from Campaign

```
DELETE /api/campaigns/:id/leads/:leadId
Authorization: Bearer <token>
```

---

## Search

### Create Search Job

```
POST /api/search
Authorization: Bearer <token>
```

**Request:**
```json
{
  "query": "hotels",
  "location": "Dubai Marina",
  "city": "Dubai",
  "country": "AE",
  "industry": "Hotels",
  "maxResults": 50,
  "source": "google_maps"
}
```

**Response (201):**
```json
{ "success": true, "data": { "id": "uuid", "status": "queued", "query": "hotels", "location": "Dubai Marina" } }
```

### List Search Jobs

```
GET /api/search/jobs
Authorization: Bearer <token>
```

### Get Search Job

```
GET /api/search/jobs/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "completed",
    "query": "hotels",
    "results_count": 45,
    "results": [...],
    "created_at": "...",
    "completed_at": "..."
  }
}
```

### Cancel Search Job

```
POST /api/search/jobs/:id/cancel
Authorization: Bearer <token>
```

---

## Companies

### List Companies

```
GET /api/companies
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Company discovery service",
    "sources": ["Google Maps", "Clutch", "GoodFirms", "DesignRush"],
    "availableIndustries": ["Hotels", "Restaurants", ...],
    "availableLocations": {}
  }
}
```

### Get Company Detail

```
GET /api/companies/:id
Authorization: Bearer <token>
```

### Get Company Contacts

```
GET /api/companies/:id/contacts
Authorization: Bearer <token>
```

### Get Company Technologies

```
GET /api/companies/:id/technologies
Authorization: Bearer <token>
```

### Get Company Audit

```
GET /api/companies/:id/audit
Authorization: Bearer <token>
```

### Enrich Company

```
POST /api/companies/:id/enrich
Authorization: Bearer <token>
```

### Get Company Timeline

```
GET /api/companies/:id/timeline
Authorization: Bearer <token>
```

### Get Sales Playbook

```
GET /api/companies/:id/playbook
Authorization: Bearer <token>
```

---

## Research

### Get Provider List

```
GET /api/providers
Authorization: Bearer <token>
```

### Trigger Research

```
POST /api/companies/:id/research
Authorization: Bearer <token>
```

### Get Research

```
GET /api/companies/:id/research
Authorization: Bearer <token>
```

### Trigger Competitor Analysis

```
POST /api/companies/:id/competitors
Authorization: Bearer <token>
```

### Get Competitor Analysis

```
GET /api/companies/:id/competitors
Authorization: Bearer <token>
```

---

## Monitoring

### Get Monitoring Schedule

```
GET /api/companies/:id/monitoring
Authorization: Bearer <token>
```

### Update Monitoring Schedule

```
PUT /api/companies/:id/monitoring
Authorization: Bearer <token>
```

### Trigger Monitoring Check

```
POST /api/companies/:id/monitoring/check
Authorization: Bearer <token>
```

### Get Monitoring History

```
GET /api/companies/:id/monitoring/history
Authorization: Bearer <token>
```

---

## Export

### Export Leads

```
GET /api/export/leads?format=csv&status=new&industry=hotels
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `csv` or `excel` |
| `status` | string | Filter by status |
| `industry` | string | Filter by industry |
| `location` | string | Filter by location |
| `score_min` | number | Minimum score |

### Get Export History

```
GET /api/export/history
Authorization: Bearer <token>
```

---

## Scheduled Searches

### List Scheduled Searches

```
GET /api/scheduled-searches
Authorization: Bearer <token>
```

### Create Scheduled Search

```
POST /api/scheduled-searches
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Daily Dubai Hotels",
  "query": "hotels",
  "location": "Dubai",
  "industry": "Hotels",
  "frequency": "daily",
  "time": "09:00",
  "timezone": "Asia/Dubai"
}
```

### Update Scheduled Search

```
PUT /api/scheduled-searches/:id
Authorization: Bearer <token>
```

### Delete Scheduled Search

```
DELETE /api/scheduled-searches/:id
Authorization: Bearer <token>
```

### Run Scheduled Search Now

```
POST /api/scheduled-searches/:id/run
Authorization: Bearer <token>
```

---

## Notifications

### List Notifications

```
GET /api/notifications
Authorization: Bearer <token>
```

### Mark All Notifications Read

```
POST /api/notifications/read-all
Authorization: Bearer <token>
```

### Mark Notification Read

```
PUT /api/notifications/:id/read
Authorization: Bearer <token>
```

### Delete Notification

```
DELETE /api/notifications/:id
Authorization: Bearer <token>
```

---

## Presets

### List Presets

```
GET /api/presets
Authorization: Bearer <token>
```

### Create Preset

```
POST /api/presets
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Dubai Luxury Hotels",
  "query": "luxury hotels",
  "location": "Downtown Dubai",
  "industry": "Hotels",
  "maxResults": 50
}
```

### Delete Preset

```
DELETE /api/presets/:id
Authorization: Bearer <token>
```

---

## Opportunities

### Get Opportunity

```
GET /api/opportunities/:leadId
Authorization: Bearer <token>
```

### Estimate Opportunity

```
POST /api/opportunities/:leadId/estimate
Authorization: Bearer <token>
```

---

## Reports

### List Reports

```
GET /api/reports
Authorization: Bearer <token>
```

### Generate Report

```
POST /api/reports
Authorization: Bearer <token>
```

**Request:**
```json
{ "type": "executive", "date_range": "30d", "format": "pdf" }
```

### Get Report

```
GET /api/reports/:id
Authorization: Bearer <token>
```

---

## Proposals

### List Proposals

```
GET /api/proposals
Authorization: Bearer <token>
```

### Generate Proposal

```
POST /api/proposals
Authorization: Bearer <token>
```

**Request:**
```json
{ "company_id": "uuid", "lead_id": "uuid", "scope": "website redesign" }
```

### Get Proposal

```
GET /api/proposals/:id
Authorization: Bearer <token>
```

---

## Copywriter

### Generate Copy

```
POST /api/copywriter
Authorization: Bearer <token>
```

**Request:**
```json
{
  "type": "email",
  "company_name": "Dubai Marina Hotel",
  "industry": "Hotels",
  "context": "Website needs modernization"
}
```

---

## Redesign

### Generate Redesign

```
POST /api/redesign
Authorization: Bearer <token>
```

**Request:**
```json
{ "company_id": "uuid", "style": "modern", "preferences": "Minimalist, luxury feel" }
```

---

## Agents

### List Agents

```
GET /api/agents
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "name": "scout", "description": "Lead discovery agent", "status": "idle", "confidence": 0.85, "total_runs": 150, "successful_runs": 145, "failed_runs": 5 }
  ]
}
```

### Get Agent

```
GET /api/agents/:name
Authorization: Bearer <token>
```

### Run Agent

```
POST /api/agents/:name/run
Authorization: Bearer <token>
```

**Request:**
```json
{ "context": { "industry": "hotels", "location": "Dubai" } }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "agent": "scout",
    "execution_id": "uuid",
    "duration_ms": 12500,
    "items_processed": 45,
    "items_created": 10,
    "items_updated": 35,
    "reasoning": "Discovered 10 new leads from Google Maps",
    "confidence": 0.87
  }
}
```

### Run All Agents

```
POST /api/agents/run-all
Authorization: Bearer <token>
```

### Get Agent Executions

```
GET /api/agents/:name/executions
Authorization: Bearer <token>
```

### Get Agent Memory

```
GET /api/agents/:name/memory
Authorization: Bearer <token>
```

### Get Agent Health Summary

```
GET /api/agents/health
Authorization: Bearer <token>
```

### Get Agent Events

```
GET /api/agents/events
Authorization: Bearer <token>
```

### Get Quality Metrics

```
GET /api/agents/quality-metrics
Authorization: Bearer <token>
```

---

## Knowledge Graph

### Get Knowledge Graph

```
GET /api/knowledge
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `entity_type` | string | Filter by entity type |
| `entity_id` | string | Filter by entity ID |
| `relationship` | string | Filter by relationship type |

---

## Executive Briefings

### Get Executive Briefings

```
GET /api/briefings
Authorization: Bearer <token>
```

### Generate Briefing

```
POST /api/briefings/generate
Authorization: Bearer <token>
```

---

## Intelligent Search (Natural Language)

### Search

```
POST /api/intelligence/search
Authorization: Bearer <token>
```

**Request:**
```json
{ "query": "Find luxury hotels in Dubai with outdated websites" }
```

---

## Locations

### List Locations

```
GET /api/locations
Authorization: Bearer <token>
```

### Get Location Tree

```
GET /api/locations/tree
Authorization: Bearer <token>
```

### Get Locations by Country

```
GET /api/locations/country/:countryCode
Authorization: Bearer <token>
```

### Create Location

```
POST /api/locations
Authorization: Bearer <token>
```

**Request:**
```json
{ "name": "Dubai Marina", "country_code": "AE", "parent_id": null }
```

### Update Location

```
PUT /api/locations/:id
Authorization: Bearer <token>
```

### Delete Location

```
DELETE /api/locations/:id
Authorization: Bearer <token>
```

---

## Industries

### List Industries

```
GET /api/industries
Authorization: Bearer <token>
```

### Get Industry Tree

```
GET /api/industries/tree
Authorization: Bearer <token>
```

### Create Industry

```
POST /api/industries
Authorization: Bearer <token>
```

**Request:**
```json
{ "name": "Hotels", "parent_id": null, "icon": "hotel" }
```

### Update Industry

```
PUT /api/industries/:id
Authorization: Bearer <token>
```

### Delete Industry

```
DELETE /api/industries/:id
Authorization: Bearer <token>
```

---

## Discovery Campaigns

### List Discovery Campaigns

```
GET /api/discovery-campaigns
Authorization: Bearer <token>
```

### Create Discovery Campaign

```
POST /api/discovery-campaigns
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Q1 Dubai Discovery",
  "industries": ["hotels", "restaurants"],
  "locations": ["dubai", "abu_dhabi"],
  "sources": ["google_maps", "clutch"],
  "max_leads_per_source": 100
}
```

### Get Discovery Campaign

```
GET /api/discovery-campaigns/:id
Authorization: Bearer <token>
```

### Update Discovery Campaign

```
PUT /api/discovery-campaigns/:id
Authorization: Bearer <token>
```

### Delete Discovery Campaign

```
DELETE /api/discovery-campaigns/:id
Authorization: Bearer <token>
```

### Activate Discovery Campaign

```
POST /api/discovery-campaigns/:id/activate
Authorization: Bearer <token>
```

### Pause Discovery Campaign

```
POST /api/discovery-campaigns/:id/pause
Authorization: Bearer <token>
```

### Get Campaign Jobs

```
GET /api/discovery-campaigns/:id/jobs
Authorization: Bearer <token>
```

### Retry Campaign Jobs

```
POST /api/discovery-campaigns/:id/retry
Authorization: Bearer <token>
```

---

## Discovery Coverage

### Get Coverage Stats

```
GET /api/discovery/coverage
Authorization: Bearer <token>
```

### Get Country Coverage

```
GET /api/discovery/coverage/countries
Authorization: Bearer <token>
```

### Get Industry Coverage

```
GET /api/discovery/coverage/industries
Authorization: Bearer <token>
```

---

## Discovery Health

### Get Discovery Health

```
GET /api/discovery/health
Authorization: Bearer <token>
```

### Get Provider Health

```
GET /api/discovery/health/providers
Authorization: Bearer <token>
```

---

## Discovery Cost

### Get Cost Stats

```
GET /api/discovery/costs
Authorization: Bearer <token>
```

---

## Intelligence Center

### Get Discovery Intelligence

```
GET /api/intelligence-center/discovery
Authorization: Bearer <token>
```

### Get Provider Intelligence

```
GET /api/intelligence-center/providers
Authorization: Bearer <token>
```

### Get Market Intelligence

```
GET /api/intelligence-center/market
Authorization: Bearer <token>
```

### Get Opportunity Intelligence

```
GET /api/intelligence-center/opportunities
Authorization: Bearer <token>
```

### Get Heatmap Data

```
GET /api/intelligence-center/heatmap
Authorization: Bearer <token>
```

### Get Predictive Discovery

```
GET /api/intelligence-center/predictive
Authorization: Bearer <token>
```

### Get Pipeline Optimizations

```
GET /api/intelligence-center/pipeline
Authorization: Bearer <token>
```

### Get Economics Data

```
GET /api/intelligence-center/economics
Authorization: Bearer <token>
```

### Get Benchmarks

```
GET /api/intelligence-center/benchmarks
Authorization: Bearer <token>
```

### Get Executive Report

```
GET /api/intelligence-center/executive
Authorization: Bearer <token>
```

### Generate Executive Report

```
POST /api/intelligence-center/executive/generate
Authorization: Bearer <token>
```

---

## AI Sales Pipeline

### Get Pipeline Stages

```
GET /api/pipeline/stages
Authorization: Bearer <token>
```

### Get Pipeline Overview

```
GET /api/pipeline/overview
Authorization: Bearer <token>
```

### Get Pipeline Stats

```
GET /api/pipeline/stats
Authorization: Bearer <token>
```

### Get Lead Pipeline

```
GET /api/pipeline/leads/:leadId
Authorization: Bearer <token>
```

### Transition Lead Pipeline

```
POST /api/pipeline/leads/:leadId/transition
Authorization: Bearer <token>
```

**Request:**
```json
{ "to_stage": "proposal", "notes": "Ready for proposal" }
```

---

## Client Readiness

### Get Top Prospects

```
GET /api/readiness/top
Authorization: Bearer <token>
```

### Get Client Readiness

```
GET /api/readiness/:companyId
Authorization: Bearer <token>
```

### Compute Client Readiness

```
POST /api/readiness/compute
Authorization: Bearer <token>
```

---

## AI Negotiation

### Get Negotiation Profile

```
GET /api/negotiation/:companyId
Authorization: Bearer <token>
```

### Generate Negotiation Profile

```
POST /api/negotiation/generate
Authorization: Bearer <token>
```

---

## Learning Engine

### Get Learning Signals

```
GET /api/learning/signals
Authorization: Bearer <token>
```

### Get Learning Performance

```
GET /api/learning/performance
Authorization: Bearer <token>
```

### Record Learning Signal

```
POST /api/learning/signals
Authorization: Bearer <token>
```

**Request:**
```json
{ "signal_type": "outcome", "entity_type": "lead", "entity_id": "uuid", "value": 1.0, "context": "Lead converted to customer" }
```

---

## Intelligent Automation

### List Automation Rules

```
GET /api/automation/rules
Authorization: Bearer <token>
```

### Create Automation Rule

```
POST /api/automation/rules
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Auto-qualify hot leads",
  "trigger": { "type": "score_above", "value": 80 },
  "action": { "type": "set_status", "value": "qualified" },
  "is_active": true
}
```

### Toggle Automation Rule

```
PUT /api/automation/rules/:id/toggle
Authorization: Bearer <token>
```

### Delete Automation Rule

```
DELETE /api/automation/rules/:id
Authorization: Bearer <token>
```

### Get Automation Executions

```
GET /api/automation/executions
Authorization: Bearer <token>
```

### Get Automation Stats

```
GET /api/automation/stats
Authorization: Bearer <token>
```

---

## Autonomous Improvement

### Get Improvement Reports

```
GET /api/improvement/reports
Authorization: Bearer <token>
```

---

## Executive OS

### Get Morning Briefing

```
GET /api/executive/morning
Authorization: Bearer <token>
```

### Trigger Morning Briefing

```
POST /api/executive/morning/generate
Authorization: Bearer <token>
```

### Get Executive Stats

```
GET /api/executive/stats
Authorization: Bearer <token>
```

---

## Observability

### Get System Overview

```
GET /api/observability/overview
Authorization: Bearer <token>
```

### Get Metrics History

```
GET /api/observability/metrics
Authorization: Bearer <token>
```

---

## WebSocket Protocol

### Connection

```
ws://ventrieeleads.qd.je/ws?token=<jwt_token>
```

Or with `Authorization: Bearer <token>` header.

### Client → Server Messages

**Subscribe to channel:**
```json
{ "type": "subscribe", "channel": "leads" }
```

**Unsubscribe from channel:**
```json
{ "type": "unsubscribe", "channel": "leads" }
```

**Ping (keepalive):**
```json
{ "type": "ping" }
```

### Server → Client Messages

**Connection confirmed:**
```json
{ "type": "connected", "data": { "userId": "uuid", "workspaceId": "uuid" } }
```

**Anonymous connection:**
```json
{ "type": "connected", "data": { "anonymous": true } }
```

**Subscription confirmed:**
```json
{ "type": "subscribed", "channel": "leads" }
```

**Broadcast (workspace-scoped):**
```json
{ "type": "broadcast", "channel": "leads", "data": { "event": "lead_created", "lead": {...} }, "timestamp": 1234567890 }
```

**Direct message:**
```json
{ "type": "message", "channel": "leads", "data": {...}, "timestamp": 1234567890 }
```

**Pong response:**
```json
{ "type": "pong", "timestamp": 1234567890 }
```

**Error:**
```json
{ "type": "error", "data": { "message": "Invalid token" } }
```

### Available Channels

| Channel | Description |
|---------|-------------|
| `leads` | Lead creation, updates, scoring |
| `campaigns` | Campaign status changes |
| `search` | Search job progress, completion |
| `agents` | Agent execution events |
| `notifications` | New notifications |
| `audit` | Audit completion events |
| `pipeline` | Pipeline stage transitions |
| `discovery` | Discovery campaign updates |
| `system` | System health, maintenance |

---

## API Key Authentication

### Usage

Include the API key in the `X-API-Key` header:

```
GET /api/leads
X-API-Key: sk-abc1234567890...
```

### Key Format

- Prefix: `sk-` followed by 8 characters
- Full key: `sk-` + 32 random characters
- Stored as bcrypt hash in database

### Permissions

API keys can be scoped to specific permissions:

```json
{ "name": "Read-only key", "permissions": ["leads.read", "companies.read"] }
```

### Rate Limits

API keys share the same rate limits as JWT tokens (per IP address).

---

## Rate Limiting

### Application Level (express-rate-limit)

| Endpoint | Window | Max Requests | Response |
|----------|--------|--------------|----------|
| `/api/*` | 1 min | 100 | `429 Too Many Requests` |
| `/api/search` | 1 min | 10 | `429 Search rate limit exceeded` |
| `/api/audit` | 1 min | 5 | `429 Audit rate limit exceeded` |

### Nginx Level

| Location | Rate | Burst | Response |
|----------|------|-------|----------|
| `/` | 20 req/s | 10 | `503 Service Temporarily Unavailable` |
| `/api/` | 20 req/s | 20 | `503 Service Temporarily Unavailable` |
| `/api/search` | 5 req/s | 5 | `503 Service Temporarily Unavailable` |
| `/api/audit` | 2 req/s | 3 | `503 Service Temporarily Unavailable` |

### Rate Limit Headers

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1705312800
```

---

## Error Response Format

### Standard Error

```json
{
  "success": false,
  "message": "Error description"
}
```

### Validation Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Authentication Required / Invalid Token |
| 403 | Forbidden / Insufficient Permissions |
| 404 | Resource Not Found |
| 409 | Conflict (e.g., duplicate email) |
| 413 | Request Body Too Large |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable / Maintenance Mode |
