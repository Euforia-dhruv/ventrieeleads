# Google OAuth 2.0 Integration

## Overview

Ventriee Leads supports Google OAuth 2.0 for passwordless sign-in and registration. Users can authenticate with their Google account, which creates a new workspace automatically or links to an existing account.

## Architecture

```
Browser ──GET /api/auth/google──> Backend
  │                                  │
  │  302 Redirect                    │ Generate state, store in Redis
  │  to Google OAuth                 │
  │                                  │
  ▼                                  │
Google Consent Screen                │
  │                                  │
  │  Callback with code + state      │
  │                                  │
  ▼                                  │
Backend ──GET /api/auth/google/callback
  │                                  │
  │  Exchange code for tokens        │
  │  Get user info from Google       │
  │  Create/link user in DB          │
  │  Generate JWT + refresh token    │
  │  Create session                  │
  │                                  │
  │  302 Redirect to frontend        │
  │  ?token=xxx&refreshToken=yyy     │
  │                                  │
  ▼                                  │
Frontend /auth/callback              │
  │                                  │
  │  Store tokens in localStorage    │
  │  Set cookie for SSR              │
  │  Redirect to dashboard           │
```

## Backend Endpoints

### `GET /api/auth/google`

Initiates the Google OAuth flow.

- **Public**: No authentication required
- **Rate Limited**: Subject to general API rate limit
- **Query Params**: `returnTo` (optional) — where to redirect after auth
- **Response**: 302 redirect to Google consent screen

### `GET /api/auth/google/callback`

Handles the Google OAuth callback.

- **Public**: No authentication required
- **Query Params**: `code`, `state`, `error` (from Google)
- **Response**: 302 redirect to frontend with JWT tokens

## Frontend Pages

### `/auth/callback`

Handles the OAuth redirect from the backend. Extracts JWT tokens from URL parameters, stores them in `localStorage` and as an HTTP-only cookie, then redirects to the dashboard.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | No | Backend callback URL (auto-detected if not set) |
| `FRONTEND_URL` | No | Frontend base URL (defaults to `http://localhost`) |

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services > Credentials**
3. Create an **OAuth 2.0 Client ID** (Web application type)
4. Add **Authorized redirect URIs**:
   - `http://localhost/api/auth/google/callback` (development)
   - `https://ventrieeleads.qd.je/api/auth/google/callback` (production)
5. Copy the **Client ID** and **Client Secret** to your `.env` file

## Security Features

- **State parameter**: CSRF protection via Redis-stored random state (10-min TTL)
- **Token exchange**: Server-side code-to-token exchange (tokens never exposed to browser during flow)
- **ID token parsing**: JWT payload parsed directly (no extra HTTP call needed)
- **Session management**: Same JWT + session system as email/password login
- **Rate limiting**: OAuth endpoints subject to general API rate limits

## User Flow

### New User
1. Clicks "Google" on login or register page
2. Redirected to Google consent screen
3. Approves access
4. Backend creates workspace + user + OAuth connection
5. Redirected to dashboard (auto-login)

### Existing User (email match)
1. Clicks "Google" on login page
2. Redirected to Google consent screen
3. Approves access
4. Backend links Google account to existing user
5. Redirected to dashboard (auto-login)

### Returning OAuth User
1. Clicks "Google" on login page
2. Redirected to Google consent screen
3. Approves access
4. Backend finds existing OAuth connection, updates tokens
5. Redirected to dashboard (auto-login)

## Database Schema

The `oauth_connections` table stores OAuth provider data:

```sql
CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,        -- 'google'
    provider_user_id VARCHAR(255) NOT NULL, -- Google's user ID
    provider_email VARCHAR(255),
    provider_name VARCHAR(255),
    provider_avatar TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);
```

## Files Modified

- `backend/src/controllers/authController.ts` — Added `googleAuth()` and `googleCallback()` functions
- `backend/src/routes.ts` — Added `GET /auth/google` and `GET /auth/google/callback` routes
- `backend/src/index.ts` — Added `cookie-parser` middleware
- `backend/package.json` — Added `cookie-parser` dependency
- `docker-compose.yml` — Added Google OAuth env vars to backend service
- `.env` — Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `FRONTEND_URL`
- `frontend/src/app/(auth)/register/page.tsx` — Added Google/GitHub OAuth buttons
- `frontend/src/app/auth/callback/page.tsx` — New OAuth callback handler page
