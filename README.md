# REAA API Platform (`REAA-Portal`)

> **Private Developer Key Portal, Admin Control Center, and Key-Gated API Gateway for REAA's Karnataka RERA intelligence services — running permanently at ₹0/month on Cloudflare Workers, D1, and KV.**

[![Live Portal](https://img.shields.io/badge/Portal-Live%20on%20Cloudflare%20Edge-C2512B?logo=cloudflare&logoColor=white)](https://reaa-portal.krera-metadata-api.workers.dev)
[![Auth DB](https://img.shields.io/badge/Auth%20DB-Cloudflare%20D1-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Frontend](https://img.shields.io/badge/UI-React%2019%20%2B%20Tailwind%20v4-1F1D1A?logo=react&logoColor=61DAFB)](https://react.dev)
[![Accessibility](https://img.shields.io/badge/Lighthouse%20A11y-100%2F100-2EA44F)](#design-system)
[![Operating Cost](https://img.shields.io/badge/Cost-%E2%82%B90%2Fmonth%20%C2%B7%20Zero%20Card-2EA44F)](#architecture)

---

## Live Portal
- **Portal & Private Gateway:** [`https://reaa-portal.krera-metadata-api.workers.dev`](https://reaa-portal.krera-metadata-api.workers.dev)
- **Public API Exposure:** **Zero** — all `/gateway/*` routes return `401 Unauthorized` without an approved `rk_live_...` key, and the upstream K-RERA data API is locked behind an internal 256-bit `X-Internal-Gateway` secret.

---

## Architecture

User authentication, key governance, and usage analytics are **physically isolated** from the upstream K-RERA dataset:

```text
  Developer / Admin Browser                     API Consumer (Python / TS / AI Agent)
          │                                                    │
          │ HttpOnly Session Cookie                            │ X-API-Key: rk_live_...
          ▼                                                    ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                 REAA Portal Worker (Cloudflare Workers + Hono)            │
  │                                                                           │
  │  • Static React SPA (/)             • /portal/* & /portal/admin/*         │
  │  • /gateway/v1/*  ──► SHA-256 hash ──► Workers KV (API_KV, <1ms read)     │
  │                   ──► RPM + Daily Quota check                             │
  │                   ──► Async usage log (waitUntil) ──► Cloudflare D1       │
  └───────────────────────────────────────┬───────────────────────────────────┘
                                          │
                  Private Cloudflare Service Binding + X-Internal-Gateway
                                          ▼
                   Upstream K-RERA Metadata Worker (Locked: 401 public)
                                          │
                                          ▼
                       Turso Cloud (Sacred K-RERA Public Dataset)
```

---

## Key Features

### 1. Access Control & Onboarding
- **Unified Auth Surface:** Single Sign In / Request Access split-screen (no public `/admin-login` endpoint).
- **Manual Admin Approval Queue:** New signups submit name, work email, organization, and intended use case, entering `pending` status until an administrator approves them.
- **First-User Admin Bootstrap:** On a fresh D1 database, the very first registered account is promoted to `admin`; every subsequent account is strictly `user` (`pending`).

### 2. Developer Console
- **API Key Vault:** Mint named `rk_live_...` keys (configurable per-user cap). Raw secrets are revealed **once** in a dedicated one-time modal and persisted exclusively as **SHA-256 hashes**.
- **Instant Lifecycle Controls:** Pause, resume, or permanently revoke keys with immediate Cloudflare KV propagation.
- **Real-Time Telemetry:** Daily UTC quota tracker, 14-day interactive SVG request bar chart, error-rate readout, and per-key last-used timestamps.
- **Zero-Endpoint SDK Integration:** Copy-paste **Python**, **TypeScript**, and **MCP Config** wrappers pre-wired to the private gateway so developers drop in a single `REAA_API_KEY`.

### 3. Admin Control Center
- **Global Telemetry Strip:** Pending approvals, approved accounts, active/paused keys, and platform-wide 14-day gateway volume.
- **Approvals & User Directory:** Search by name/email/company; 1-click **Approve** or **Suspend** (suspending immediately kills all user keys in KV).
- **Global API Key Monitor:** Inspect every issued key across all accounts with live usage vs. daily quota, inline **Edit Limits** modal (`rate_limit_per_min` & `daily_quota`), Pause/Resume, and permanent Revoke.
- **Immutable Audit Trail:** Chronological log of every approval, suspension, quota adjustment, and key revocation.

---

## Security Model
- **Passwords:** Web Crypto **PBKDF2-SHA256** (`100,000` iterations, per-user 128-bit random salt, constant-time comparison).
- **Sessions:** `HttpOnly`, `Secure`, `SameSite=Lax` cookies stored as SHA-256 hashes in D1 (`7-day` TTL).
- **API Keys:** `rk_live_` + 192-bit CSPRNG hex; stored only as SHA-256 hashes in D1 and KV.
- **Read-Only Gateway:** `/gateway/*` strictly permits `GET` (`405` on mutations) and strips no security boundaries.
- **KV Free-Tier Safe:** Workers KV is strictly **reads-only** during API traffic (`100k reads/day` free); usage writes go asynchronously to D1 (`100k writes/day` free), avoiding KV's `1,000 writes/day` cap.

---

## Design System
Designed using the **Rune Design Contract** (`.rune/design-system.md` & `.rune/ui-spec.md`):
- **Architectural Ledger Palette:** Warm stone alabaster & deep ink surfaces built strictly with `oklch()` semantic tokens and relative `oklch(from var(--accent) ...)` Terracotta Copper derivations (zero pure `#000`/`#fff`, zero neon AI gradients).
- **Typography:** `Plus Jakarta Sans` UI hierarchy paired with `JetBrains Mono` (`tabular-nums`) for all key prefixes, quotas, counts, and timestamps.
- **Accessibility:** Audited at **100 / 100 Lighthouse Accessibility** and **100 / 100 Best Practices** — visible `:focus-visible` rings, `>= 44px` primary targets, `@phosphor-icons/react` iconography, and live `prefers-reduced-motion` support.

---

## Repository Structure

```text
REAA-Portal/
├── .rune/
│   ├── design-system.md          # Locked oklch tokens, scale minimums, anti-patterns & UX writing
│   └── ui-spec.md                # Locked layout & component contract
├── db/
│   └── auth_schema.sql           # Isolated Cloudflare D1 schema (5 tables)
├── worker/src/
│   ├── index.ts                  # Hono entrypoint + SPA static asset fallback
│   ├── auth.ts                   # Session cookies, requireAuth & requireAdmin middleware
│   ├── crypto.ts                 # PBKDF2-SHA256, SHA-256 hashing & rk_live_ generator
│   ├── kv.ts                     # Instant KV sync & revocation helpers
│   ├── types.ts                  # Worker bindings & types
│   └── routes/
│       ├── portal.ts             # Auth, user keys & 14-day usage endpoints
│       ├── admin.ts              # Overview, approvals, global keys, limits & audit trail
│       └── gateway.ts            # Key-gated /gateway/* proxy + Service Binding forwarder
├── web/src/
│   ├── index.css                 # Rune oklch() tokens & base accessibility styles
│   ├── lib/api.ts                # Typed frontend API client
│   ├── components/               # ReaaLogo, AppShell, KeyRevealModal, StatusBadge, UsageChart
│   └── pages/                    # AuthPage, DashboardPage, AdminPage
├── docs/
│   └── PORTAL_DEPLOY_GUIDE.md    # Zero-card Cloudflare D1 + KV + Workers deployment guide
├── package.json
└── wrangler.toml
```

---

## Local Development

```powershell
npm install
npm run db:init:local
npm run dev
```

Opens locally at `http://127.0.0.1:8788` backed by local D1 and KV simulators.

### Production Deploy (Zero Card)
See [`docs/PORTAL_DEPLOY_GUIDE.md`](docs/PORTAL_DEPLOY_GUIDE.md) for creating D1 (`krera-auth`), KV (`API_KV`), applying `auth_schema.sql` remotely, and running `npm run deploy`.

---

## License & Disclaimer

Source code in this repository is licensed under the **[MIT License](LICENSE)**.

*Disclaimer: This is an independent project and is not affiliated with, endorsed by, or officially connected to the Karnataka Real Estate Regulatory Authority (K-RERA). All underlying project metadata is sourced from public statutory disclosures on `rera.karnataka.gov.in` and provided "as-is" for informational purposes only — not legal or title verification advice.*
