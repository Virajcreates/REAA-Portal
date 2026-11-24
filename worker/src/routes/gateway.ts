import { Hono } from "hono";
import { sha256Hex } from "../crypto";
import { kvKeyName, syncKeyToKv } from "../kv";
import type { Env, KvKeyRecord } from "../types";

export const gatewayRoutes = new Hono<{ Bindings: Env }>();

const rpmBuckets = new Map<string, { count: number; resetAt: number }>();

function classifyEndpoint(subpath: string): string {
  if (subpath.startsWith("/v1/projects")) {
    if (subpath.endsWith("/inventory")) return "project_inventory";
    if (subpath.endsWith("/qpr")) return "project_qpr";
    if (subpath.endsWith("/documents")) return "project_documents";
    if (subpath.endsWith("/complaints")) return "project_complaints";
    if (subpath.endsWith("/litigations")) return "project_litigations";
    if (subpath === "/v1/projects") return "projects_search";
    return "project_core";
  }
  if (subpath.startsWith("/v1/promoters")) return "promoters";
  if (subpath.startsWith("/v1/stats")) return "stats";
  if (subpath.startsWith("/v1/exports")) return "exports";
  return "other";
}

async function lookupKey(env: Env, keyHash: string): Promise<KvKeyRecord | null> {
  const raw = await env.API_KV.get(kvKeyName(keyHash));
  if (raw) {
    try {
      return JSON.parse(raw) as KvKeyRecord;
    } catch {
    }
  }
  const row = await env.AUTH_DB.prepare(
    `SELECT k.id AS key_id, k.user_id, k.status, u.status AS user_status,
            k.rate_limit_per_min, k.daily_quota
     FROM api_keys k
     JOIN users u ON u.id = k.user_id
     WHERE k.key_hash = ? LIMIT 1`
  )
    .bind(keyHash)
    .first<KvKeyRecord>();

  if (!row) return null;
  if (row.status !== "revoked" && row.user_status !== "suspended") {
    await syncKeyToKv(env, keyHash, row);
  }
  return row;
}

gatewayRoutes.all("/*", async (c) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "X-API-Key, Authorization, Content-Type",
      },
    });
  }
  if (c.req.method !== "GET") {
    return c.json({ error: "method_not_allowed", message: "Only GET requests are supported." }, 405);
  }

  const authHeader = c.req.header("Authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const rawKey = (c.req.header("X-API-Key") ?? bearer).trim();

  if (!rawKey) {
    return c.json(
      { error: "unauthorized", message: "Missing X-API-Key header." },
      401
    );
  }

  const keyHash = await sha256Hex(rawKey);
  const record = await lookupKey(c.env, keyHash);
  if (!record || record.status === "revoked") {
    return c.json({ error: "forbidden", message: "Invalid or revoked API key." }, 403);
  }
  if (record.user_status !== "approved") {
    return c.json({ error: "forbidden", message: "Account is not approved for API access." }, 403);
  }
  if (record.status === "paused") {
    return c.json({ error: "forbidden", message: "API key is currently paused." }, 403);
  }

  const minuteBucket = Math.floor(Date.now() / 60000);
  const resetEpoch = (minuteBucket + 1) * 60;
  const bucketKey = `${record.key_id}:${minuteBucket}`;
  const nowMs = Date.now();
  const prev = rpmBuckets.get(bucketKey);
  const rpmCount = prev && prev.resetAt > nowMs ? prev.count + 1 : 1;
  rpmBuckets.set(bucketKey, { count: rpmCount, resetAt: resetEpoch * 1000 });

  if (rpmCount > record.rate_limit_per_min) {
    return c.json(
      {
        error: "rate_limited",
        message: `Rate limit exceeded (${record.rate_limit_per_min} req/min).`,
        retry_after_seconds: Math.max(1, resetEpoch - Math.floor(nowMs / 1000)),
      },
      429
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const quotaRow = await c.env.AUTH_DB.prepare(
    "SELECT COALESCE(SUM(request_count), 0) AS used FROM api_usage_daily WHERE key_id = ? AND date_utc = ?"
  )
    .bind(record.key_id, today)
    .first<{ used: number }>();

  const usedToday = Number(quotaRow?.used ?? 0);
  if (usedToday >= record.daily_quota) {
    return c.json(
      {
        error: "daily_quota_exceeded",
        message: `Daily quota reached (${record.daily_quota} requests/day). Resets at 00:00 UTC.`,
      },
      429
    );
  }

  const incomingUrl = new URL(c.req.url);
  const subpath = incomingUrl.pathname.replace(/^\/gateway/, "") || "/";
  const upstreamBase = (c.env.UPSTREAM_API_URL || "").replace(/\/+$/, "");
  const targetUrl = `${upstreamBase}${subpath}${incomingUrl.search}`;

  const fwdHeaders = new Headers();
  const acceptEnc = c.req.header("Accept-Encoding");
  if (acceptEnc) fwdHeaders.set("Accept-Encoding", acceptEnc);
  if (c.env.UPSTREAM_INTERNAL_SECRET) {
    fwdHeaders.set("X-Internal-Gateway", c.env.UPSTREAM_INTERNAL_SECRET);
  }

  const started = Date.now();
  const upstreamResp = c.env.KRERA_API
    ? await c.env.KRERA_API.fetch(targetUrl, { method: "GET", headers: fwdHeaders })
    : await fetch(targetUrl, { method: "GET", headers: fwdHeaders });
  const latencyMs = Math.max(1, Date.now() - started);

  const endpointGroup = classifyEndpoint(subpath);
  const isError = upstreamResp.status >= 400 ? 1 : 0;
  const nowIso = new Date().toISOString();

  c.executionCtx.waitUntil(
    c.env.AUTH_DB.batch([
      c.env.AUTH_DB.prepare(
        `INSERT INTO api_usage_daily (key_id, date_utc, endpoint_group, request_count, error_count, total_latency_ms)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(key_id, date_utc, endpoint_group) DO UPDATE SET
           request_count = request_count + 1,
           error_count = error_count + excluded.error_count,
           total_latency_ms = total_latency_ms + excluded.total_latency_ms`
      ).bind(record.key_id, today, endpointGroup, isError, latencyMs),
      c.env.AUTH_DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(
        nowIso,
        record.key_id
      ),
    ])
  );

  const outHeaders = new Headers(upstreamResp.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  outHeaders.delete("transfer-encoding");
  outHeaders.set("Access-Control-Allow-Origin", "*");
  outHeaders.set("X-RateLimit-Limit", String(record.rate_limit_per_min));
  outHeaders.set("X-RateLimit-Remaining", String(Math.max(0, record.rate_limit_per_min - rpmCount)));
  outHeaders.set("X-Daily-Quota-Limit", String(record.daily_quota));
  outHeaders.set("X-Daily-Quota-Remaining", String(Math.max(0, record.daily_quota - usedToday - 1)));

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: outHeaders,
  });
});
