# UI Specification Contract: REAA Portal
Status: LOCKED
Design System: `.rune/design-system.md`

## Layout Architecture
1. **Unauthenticated Surface (`/login`, `/signup`):**
   - Asymmetric split layout (`1440px`: 44% left architectural identity column on `--bg-ink`, 56% right clean form canvas on `--bg-base`; stacks cleanly on `< 960px`).
   - Left column: Brand mark (`REAA`), 48px display headline, 3 concise institutional trust pillars (DPDP-scrubbed Karnataka disclosures, dedicated key quotas, zero raw infrastructure exposure), live coverage footer (`9,136 projects · 31 districts`).
   - Right column: Clean tabbed Sign In / Request Access form with explicit `<label>`s, inline validation, and zero exposed endpoints.

2. **Authenticated App Shell (`/dashboard`, `/admin`):**
   - Fixed `236px` left navigation rail on `--bg-surface` with `1px solid var(--border)` right divider (collapses to clean top bar + slide drawer on `< 960px`).
   - Rail sections: Brand header, primary navigation (`Overview & Keys`, `Integration`, and `Admin Console` when `role === 'admin'`), bottom account card with Sign Out action.
   - Main content container: max-width `1120px`, `32px` padding (`16px` mobile), crisp header row with H1 + primary verb-first CTA on right.

3. **Developer Console (`/dashboard`):**
   - Pending state (`status === 'pending'`): Calm amber architectural notice card explaining manual review status, showing submitted org/use-case metadata; Mint Key button disabled with clear reason.
   - Approved state:
     - 3-column KPI strip (`Requests Today / Daily Quota`, `Active Keys`, `14-Day Error Rate`) in bordered `--bg-surface` cells (`1px solid var(--border)`).
     - 14-day traffic SVG bar chart (`tabular-nums` axes + interactive hover summary).
     - API Keys table: Name, Key Prefix (`JetBrains Mono`), Status dot badge, Today's Usage / Quota, RPM, Last Used, Actions (`Pause/Resume`, `Revoke`).
     - One-time Key Reveal Modal: High-contrast mono box, 1-click Copy button, explicit one-time warning checkbox/acknowledge before closing.
     - Integration Tab: Language switcher (`Python`, `TypeScript`, `MCP Config`) with self-contained thin client wrapper abstracting internal routes so developers only paste `REAA_API_KEY`.

4. **Admin Control Center (`/admin`):**
   - Sub-tabs: `Approvals` (badge count of pending signups), `Users`, `API Keys`, `Audit Log`.
   - Top 4-column global KPI strip (`Pending Approvals`, `Active Users`, `Active Keys`, `Requests Today`).
   - Approvals & Users table: Filter pills + search input; inline `Approve`, `Suspend`, `Reactivate` buttons with confirmation on destructive actions.
   - Global API Keys table: Search by owner/prefix/name; inline `Pause/Resume`, `Edit Limits` (modal for `rate_limit_per_min` & `daily_quota`), and `Revoke`.
   - Audit Log table: Chronological table of admin actions (`timestamp`, `admin`, `action`, `target`, `details`).

## Unwired Elements
- None planned: every visible button, filter, modal, copy control, and chart is wired to live D1 + KV backend endpoints.
