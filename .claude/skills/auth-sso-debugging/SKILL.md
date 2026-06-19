---
name: auth-sso-debugging
description: Debug NextAuth + Hive SSO. Auth pipeline, env vars, log locations, outage handling.
tags: [next-auth, sso, oauth, hive]
---

## Auth Pipeline (4 phases)
1. **Authorize** — redirect to Hive `/api/core/sso/authorize/`, receive code on callback
2. **Profile** — map Hive `/api/core/sso/userinfo/` → NextAuth user fields
3. **Exchange** — POST to `/api/core/sso/exchange/` for SimpleJWT access/refresh pair
4. **Session** — map JWT + user data → `AuthSessionData`

Key files:
- `ui\src\api-server\hive\sso.ts` — `authOptions.logger`, exchange logic
- `ui\src\app\api\auth\[...nextauth]\route.ts`
- `ui\src\components\auth\AuthProvider.tsx`

## Debugging

**Logs** — server console prefixes: `❌ [NextAuth Error]`, `⚠️ [NextAuth Warning]`, `🐛 [NextAuth Debug]`

**Env vars** (must match Hive registration):
```powershell
Get-ChildItem env:NEXT_PUBLIC_HIVE_URL
```
Required: `NEXT_PUBLIC_HIVE_URL`, `HIVE_CLIENT_ID`, `HIVE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

## Outage Handling
- `jwt` callback sets `token.error = "TokenExpiredError"` on expiry
- Hive offline → `OfflineProvider` serves cached calendars, bypasses runtime checks
- SSO failure → user-friendly error prompt + allow logout to cached/mock credentials
