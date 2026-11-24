# REAA Portal — Zero-Card Deployment Guide (Cloudflare D1 + KV + Workers)

Deploy your private **Developer Key Portal**, **Admin Control Center**, and **Private API Gateway** at **₹0/month with zero credit card** (physically isolated from your sacred Turso K-RERA database!).

---

## Step 1: Create Free Cloudflare D1 Database (`krera-auth`) & KV Namespace (`API_KV`)

In Windows PowerShell (`D:\REAA_PORTAL`, with `$env:CLOUDFLARE_API_TOKEN` set):

```powershell
cd D:\REAA_PORTAL
npx wrangler d1 create krera-auth
npx wrangler kv namespace create API_KV
```

Copy the printed `database_id` and KV `id` into `D:\REAA_PORTAL\wrangler.toml`:
- Under `[[d1_databases]]` → set `database_id = "<YOUR_D1_ID>"`
- Under `[[kv_namespaces]]` → set `id = "<YOUR_KV_ID>"`

*(Optional: set `ADMIN_BOOTSTRAP_EMAIL = "your-email@example.com"` in `wrangler.toml`. Note: the very first account created on a fresh D1 database is automatically promoted to Admin regardless!)*

---

## Step 2: Apply the D1 Auth Schema Remotely

```powershell
npm run db:init:remote
```

---

## Step 3: Build & Deploy `reaa-portal`

```powershell
npm run deploy
```

Wrangler prints your live Portal & Private Gateway URL:
```text
https://reaa-portal.<your-subdomain>.workers.dev
```

1. Open that URL in your browser → click **Request Access** and create **your own account first** (automatically granted `role = admin`, `status = approved`).
2. Every subsequent user who submits **Request Access** enters `status = pending` and appears inside your **Admin Control → Pending Approvals** tab.

---

## Step 4 (Recommended): Lock Down Upstream `krera-metadata-api` So Nothing Is Public

Once `reaa-portal` is live, you can bind `krera-metadata-api` as a private **Cloudflare Service Binding** (zero public internet hop) and require a shared internal secret on `krera-metadata-api`, so unauthenticated visitors hitting `krera-metadata-api` directly get `401 Unauthorized` while `reaa-portal/gateway/*` continues serving approved API keys seamlessly.
