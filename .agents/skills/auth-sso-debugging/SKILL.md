---
name: auth-sso-debugging
description: Guides the agent in debugging NextAuth authentication flows, troubleshooting SSO endpoints, exchanging tokens with Hive, and verifying fallback behaviors/offline state handling.
version: 1.0.0
tags:
  - next-auth
  - sso
  - oauth
  - hive
  - error-handling
---

# Auth & SSO Debugging Skill

This skill documents NextAuth and Hive Single Sign-On (SSO) integration, debugging tools, token exchange architectures, and robust failure recovery patterns.

## Architecture Overview

Bluz delegates user authentication to the external Hive SSO identity service.
The authentication pipeline comprises four sequential phases:
1. **Authorization Code Flow:** NextAuth redirects the user to the Hive SSO authorize page (`/api/core/sso/authorize/`) and obtains an authorization code on callback.
2. **Profile Map (`profile` callback):** Map the profile returned by Hive SSO `/api/core/sso/userinfo/` to NextAuth user fields (username, display_name, clearance, is_teacher, etc.).
3. **Token Exchange (`jwt` callback):** Exchange the temporary opaque token for a SimpleJWT access/refresh token pair by sending a POST request to Hive's `/api/core/sso/exchange/` endpoint.
4. **Session Mapping (`session` callback):** Map JWT access details and user data onto the NextAuth active session object (`AuthSessionData`).

---

## Configuration Files

- **`ui/src/api-server/hive/sso.ts`:** Implements NextAuth provider (`HIVE_PROVIDER`), profile parser, logger intercepts, and JWT/session callbacks.
- **`ui/src/app/api/auth/[...nextauth]/route.ts`:** Serves as the API route handler that boots NextAuth.
- **`ui/src/components/auth/AuthProvider.tsx`:** Provides client-side session states (`useSession()`) across the React app tree.

---

## Debugging Authentication Issues

### 1. Intercepting Logs
NextAuth logs are customized in `ui/src/api-server/hive/sso.ts` inside `authOptions.logger`. Check server console outputs for:
- `❌ [NextAuth Error]`
- `⚠️ [NextAuth Warning]`
- `🐛 [NextAuth Debug]`

### 2. Environment Variables Check
Ensure the following variables are configured inside `.env`:
- `NEXT_PUBLIC_HIVE_URL` (must match the hostname of the identity provider)
- `HIVE_CLIENT_ID` & `HIVE_CLIENT_SECRET` (matching registered OAuth applications)
- `NEXTAUTH_SECRET` (used for encrypting JWT cookies)
- `NEXTAUTH_URL` (usually set to `https://bluz.bis` or the absolute local address)

---

## Outage Handling & Fallbacks

When the Hive service is offline or inaccessible, token exchanges will fail, resulting in login errors. To ensure the application remains operational during outages:

1. **Verify Token Validity:** The `jwt` callback sets `token.error = "TokenExpiredError"` if token expiration times are exceeded.
2. **Offline Mode & Session Persistence:** If communication with Hive fails but the client has cached session storage, utilize local/offline status contexts (`OfflineProvider`) to bypass runtime checks and allow viewing cached calendars.
3. **SSO Failure UI Alert:** Intercept exchange/SSO endpoint errors, display user-friendly prompts explaining that the authentication service is down, and allow logging out to try cached/mock credentials.
