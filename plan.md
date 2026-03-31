# License Server — Implementation Plan

## Context

Standalone Next.js license server deployed on Vercel that enforces per-customer feature access via JWTs. Stateless design — no database required.

---

## Key Design Decisions

| Original | Improved | Why |
|---|---|---|
| HS256 (symmetric) | **RS256 (asymmetric)** | Client apps verify locally with public key; private key never leaves server |
| Customer ID only | **Customer ID alone (default) + optional API secret** | Works out of the box; secret adds stronger auth when needed |
| Hardcoded features in code | **`CUSTOMER_REGISTRY` env var (JSON array)** | Update customers/features without code changes |
| No rate limiting | **10 req/min on `/api/license`, 30 req/min on `/api/verify`** | Brute-force protection |
| No audience claim | **`aud` = customerId** | Prevents token reuse across customers |
| Client-side JWT reads | **Server-to-server only; features passed via headers** | Secrets never touch the browser |
| No timing-safe comparison | **`crypto.timingSafeEqual`** (when secret is set) | Prevents enumeration via timing attacks |

### Optional Customer API Secret

Customers can authenticate with just a `customerId` (simple mode) **or** with a `customerId` + `apiSecret` (secure mode):

- If a customer has no `secretHash` in the registry → any caller knowing the `customerId` gets a token (suitable for dev/internal use)
- If a customer has a `secretHash` → `apiSecret` is required and verified with timing-safe comparison

```typescript
// lib/customers.ts — authentication logic
function authenticateCustomer(customer: Customer, apiSecret?: string): boolean {
  if (!customer.secretHash) return true;           // no secret required for this customer
  if (!apiSecret) return false;                    // secret required but not provided
  return constantTimeEqual(hashSecret(apiSecret), customer.secretHash);
}
```

---

## File Structure

```
fg-license/
├── package.json                     # Next.js + jose + zod
├── tsconfig.json                    # strict, @/* alias
├── next.config.ts                   # serverExternalPackages: ['jose']
├── vercel.json                      # Cache headers for JWKS endpoint
├── .env.example                     # Documented env vars template
├── .gitignore
│
├── scripts/
│   └── generate-keys.mjs            # One-time RSA keypair generator → prints env vars
│
├── lib/
│   ├── jwt.ts                       # signLicenseToken() / verifyLicenseToken() via jose RS256
│   ├── customers.ts                 # loadCustomers() from CUSTOMER_REGISTRY env var
│   ├── crypto.ts                    # hashSecret() + constantTimeEqual()
│   └── rate-limit.ts                # Per-IP rate limiter (in-memory, Upstash-ready)
│
├── middleware.ts                    # Edge: CORS + security headers + OPTIONS preflight
│
└── app/
    ├── layout.tsx
    ├── page.tsx                     # Docs landing page with curl examples
    └── api/
        ├── license/route.ts         # POST /api/license — issue JWT
        ├── verify/route.ts          # POST /api/verify — verify JWT, return claims
        ├── health/route.ts          # GET /api/health — liveness probe
        └── .well-known/
            └── jwks.json/route.ts   # GET /api/.well-known/jwks.json — public key (JWKS)
```

---

## Environment Variables

```bash
# RSA private key (PEM, base64-encoded) — from scripts/generate-keys.mjs
JWT_PRIVATE_KEY_B64=

# RSA public key (PEM, base64-encoded)
JWT_PUBLIC_KEY_B64=

# Customer registry (JSON array)
# [{"id":"customerA","features":["analytics","export"]},{"id":"customerB","secretHash":"<sha256-hex>","features":["export"]}]
CUSTOMER_REGISTRY=

# License server's own URL
NEXT_PUBLIC_APP_URL=https://fg-license.vercel.app

# Optional: Upstash Redis for distributed rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/license` | customerId + optional apiSecret | Issue JWT |
| POST | `/api/verify` | none (token in body) | Verify JWT, return claims |
| GET | `/api/.well-known/jwks.json` | none | Public key for local verification |
| GET | `/api/health` | none | Liveness probe |

---

## JWT Payload

```typescript
{
  licenseId: string;    // crypto.randomUUID()
  customerId: string;
  features: string[];
  iss: 'fg-license';
  aud: string;          // = customerId (prevents cross-customer token reuse)
  iat: number;
  exp: number;          // iat + 3600 (1 hour TTL)
}
```

---

## Client Integration (snippet)

```typescript
// lib/license.ts in client app (server-side only)
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://fg-license.vercel.app/api/.well-known/jwks.json')
);
let cache: { jwt: string; exp: number } | null = null;

export async function getLicenseToken() {
  if (cache && cache.exp - Date.now() / 1000 > 600) return cache.jwt;
  const res = await fetch('https://fg-license.vercel.app/api/license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: process.env.LICENSE_CUSTOMER_ID }),
  });
  const data = await res.json();
  cache = { jwt: data.token, exp: new Date(data.expiresAt).getTime() / 1000 };
  return data.token;
}
```

Feature gating:
```typescript
const features = req.headers.get('X-License-Features')?.split(',') ?? [];
if (!features.includes('analytics')) return Response.json({ error: 'Not licensed' }, { status: 403 });
```

---

## Verification Steps

1. `node scripts/generate-keys.mjs` → copy output to `.env.local`
2. `npm run dev` → server on localhost:3000
3. `curl -X POST localhost:3000/api/license -d '{"customerId":"customerA"}' -H 'Content-Type: application/json'` → JWT
4. `curl -X POST localhost:3000/api/verify -d '{"token":"<JWT>"}' -H 'Content-Type: application/json'` → `{ valid: true }`
5. `curl localhost:3000/api/.well-known/jwks.json` → JWKS
