import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { clearSession, createSession, requireAuth, SESSION_COOKIE, toSafeUser } from "../auth";
import { generateApiKey, hashPassword, randomId, sha256Hex, verifyPassword } from "../crypto";
import { deleteKeyFromKv, syncKeyToKv } from "../kv";
import type { AppVariables, Env, UserRow } from "../types";

export const portalRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

portalRoutes.post("/auth/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "bad_request", message: "Invalid JSON payload." }, 400);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();
  const company = String(body.company ?? "").trim();
  const useCase = String(body.use_case ?? "").trim();

  if (!email || !email.includes("@")) {
    return c.json({ error: "validation", message: "Enter a valid work email address." }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "validation", message: "Password must be at least 8 characters." }, 400);
  }
  if (fullName.length < 2) {
    return c.json({ error: "validation", message: "Enter your full name." }, 400);
  }
  if (company.length < 2) {
    return c.json({ error: "validation", message: "Enter your company or organization name." }, 400);
  }
  if (useCase.length < 5) {
    return c.json({ error: "validation", message: "Briefly describe how you plan to use the API." }, 400);
  }

  const existing = await c.env.AUTH_DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first();
  if (existing) {
    return c.json(
      { error: "conflict", message: "An account with this email already exists. Sign in instead." },
      409
    );
  }

  const totalRow = await c.env.AUTH_DB.prepare("SELECT COUNT(*) AS cnt FROM users").first<{ cnt: number }>();
  const bootstrapEmail = (c.env.ADMIN_BOOTSTRAP_EMAIL ?? "").trim().toLowerCase();
  const isAdmin = Number(totalRow?.cnt ?? 0) === 0 || (bootstrapEmail !== "" && email === bootstrapEmail);

  const now = new Date().toISOString();
  const id = randomId("usr");
  const { hash, salt } = await hashPassword(password);
  const role: "admin" | "user" = isAdmin ? "admin" : "user";
  const status: "approved" | "pending" = isAdmin ? "approved" : "pending";

  await c.env.AUTH_DB.prepare(
    `INSERT INTO users (
       id, email, password_hash, password_salt, full_name, company, use_case,
       role, status, created_at, updated_at, last_login_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, email, hash, salt, fullName, company, useCase, role, status, now, now, now)
    .run();

  await createSession(c, id);

  return c.json(
    {
      user: {
        id,
        email,
        full_name: fullName,
        company,
        use_case: useCase,
        role,
        status,
        created_at: now,
        last_login_at: now,
      },
    },
    201
  );
});

portalRoutes.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return c.json({ error: "validation", message: "Email and password are required." }, 400);
  }

  const row = await c.env.AUTH_DB.prepare("SELECT * FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first<UserRow>();
  if (!row) {
    return c.json({ error: "invalid_credentials", message: "Incorrect email or password." }, 401);
  }

  const ok = await verifyPassword(password, row.password_hash, row.password_salt);
  if (!ok) {
    return c.json({ error: "invalid_credentials", message: "Incorrect email or password." }, 401);
  }

  const now = new Date().toISOString();
  await c.env.AUTH_DB.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, row.id)
    .run();

  await createSession(c, row.id);
  return c.json({ user: { ...toSafeUser(row), last_login_at: now } });
});

portalRoutes.post("/auth/logout", async (c) => {
  await clearSession(c);
  return c.json({ ok: true });
});

portalRoutes.get("/auth/me", async (c) => {
  const rawToken = getCookie(c, SESSION_COOKIE);
  const maxKeys = Number(c.env.MAX_KEYS_PER_USER ?? "3") || 3;
  const origin = new URL(c.req.url).origin;
  if (!rawToken) {
    return c.json({ user: null, config: { max_keys_per_user: maxKeys, gateway_origin: origin } });
  }
  const tokenHash = await sha256Hex(rawToken);
  const row = await c.env.AUTH_DB.prepare(
    `SELECT u.id, u.email, u.password_hash, u.password_salt, u.full_name, u.company,
            u.use_case, u.role, u.status, u.created_at, u.updated_at, u.last_login_at,
            s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? LIMIT 1`
  )
    .bind(tokenHash)
    .first<UserRow & { expires_at: string }>();

  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    return c.json({ user: null, config: { max_keys_per_user: maxKeys, gateway_origin: origin } });
  }
  return c.json({
    user: toSafeUser(row),
    config: { max_keys_per_user: maxKeys, gateway_origin: origin },
  });
});

portalRoutes.get("/keys", requireAuth, async (c) => {
  const user = c.get("user");
  const today = todayUtc();
  const { results } = await c.env.AUTH_DB.prepare(
    `SELECT k.id, k.name, k.key_prefix, k.status, k.rate_limit_per_min, k.daily_quota,
            k.created_at, k.last_used_at, k.revoked_at,
            COALESCE(SUM(CASE WHEN u.date_utc = ? THEN u.request_count ELSE 0 END), 0) AS requests_today,
            COALESCE(SUM(CASE WHEN u.date_utc = ? THEN u.error_count ELSE 0 END), 0) AS errors_today,
            COALESCE(SUM(u.request_count), 0) AS requests_total
     FROM api_keys k
     LEFT JOIN api_usage_daily u ON u.key_id = k.id
     WHERE k.user_id = ?
     GROUP BY k.id
     ORDER BY k.created_at DESC`
  )
    .bind(today, today, user.id)
    .all();

  return c.json({ keys: results });
});

portalRoutes.post("/keys", requireAuth, async (c) => {
  const user = c.get("user");
  if (user.status !== "approved") {
    return c.json(
      {
        error: "account_not_approved",
        message:
          user.status === "pending"
            ? "Couldn't mint API key: account is pending admin approval. You'll be able to create keys once approved."
            : "Couldn't mint API key: account is suspended. Contact an administrator.",
      },
      403
    );
  }

  const body = await c.req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return c.json({ error: "validation", message: "Key name must be 2–60 characters." }, 400);
  }

  const maxKeys = Number(c.env.MAX_KEYS_PER_USER ?? "3") || 3;
  const activeCountRow = await c.env.AUTH_DB.prepare(
    "SELECT COUNT(*) AS cnt FROM api_keys WHERE user_id = ? AND status != 'revoked'"
  )
    .bind(user.id)
    .first<{ cnt: number }>();

  if (Number(activeCountRow?.cnt ?? 0) >= maxKeys) {
    return c.json(
      {
        error: "key_limit_reached",
        message: `You already have ${maxKeys} active or paused keys. Revoke an unused key before minting a new one.`,
      },
      400
    );
  }

  const { rawKey, prefix } = generateApiKey();
  const keyHash = await sha256Hex(rawKey);
  const id = randomId("key");
  const now = new Date().toISOString();
  const rpm = Number(c.env.DEFAULT_RATE_LIMIT_PER_MIN ?? "60") || 60;
  const dailyQuota = Number(c.env.DEFAULT_DAILY_QUOTA ?? "500") || 500;

  await c.env.AUTH_DB.prepare(
    `INSERT INTO api_keys (
       id, user_id, name, key_prefix, key_hash, status,
       rate_limit_per_min, daily_quota, created_at
     ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  )
    .bind(id, user.id, name, prefix, keyHash, rpm, dailyQuota, now)
    .run();

  await syncKeyToKv(c.env, keyHash, {
    key_id: id,
    user_id: user.id,
    status: "active",
    user_status: user.status,
    rate_limit_per_min: rpm,
    daily_quota: dailyQuota,
  });

  return c.json(
    {
      raw_key: rawKey,
      key: {
        id,
        name,
        key_prefix: prefix,
        status: "active",
        rate_limit_per_min: rpm,
        daily_quota: dailyQuota,
        created_at: now,
        last_used_at: null,
        revoked_at: null,
        requests_today: 0,
        errors_today: 0,
        requests_total: 0,
      },
    },
    201
  );
});

portalRoutes.patch("/keys/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const nextStatus = String(body?.status ?? "").trim();

  if (nextStatus !== "active" && nextStatus !== "paused") {
    return c.json({ error: "validation", message: "Status must be 'active' or 'paused'." }, 400);
  }

  const row = await c.env.AUTH_DB.prepare(
    "SELECT id, key_hash, status, rate_limit_per_min, daily_quota FROM api_keys WHERE id = ? AND user_id = ? LIMIT 1"
  )
    .bind(keyId, user.id)
    .first<{
      id: string;
      key_hash: string;
      status: string;
      rate_limit_per_min: number;
      daily_quota: number;
    }>();

  if (!row) {
    return c.json({ error: "not_found", message: "API key not found." }, 404);
  }
  if (row.status === "revoked") {
    return c.json({ error: "invalid_state", message: "Revoked keys cannot be reactivated." }, 400);
  }

  await c.env.AUTH_DB.prepare("UPDATE api_keys SET status = ? WHERE id = ?")
    .bind(nextStatus, keyId)
    .run();

  await syncKeyToKv(c.env, row.key_hash, {
    key_id: row.id,
    user_id: user.id,
    status: nextStatus,
    user_status: user.status,
    rate_limit_per_min: row.rate_limit_per_min,
    daily_quota: row.daily_quota,
  });

  return c.json({ ok: true, id: keyId, status: nextStatus });
});

portalRoutes.delete("/keys/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");
  const row = await c.env.AUTH_DB.prepare(
    "SELECT id, key_hash FROM api_keys WHERE id = ? AND user_id = ? LIMIT 1"
  )
    .bind(keyId, user.id)
    .first<{ id: string; key_hash: string }>();

  if (!row) {
    return c.json({ error: "not_found", message: "API key not found." }, 404);
  }

  const now = new Date().toISOString();
  await c.env.AUTH_DB.prepare(
    "UPDATE api_keys SET status = 'revoked', revoked_at = ? WHERE id = ?"
  )
    .bind(now, keyId)
    .run();

  await deleteKeyFromKv(c.env, row.key_hash);
  return c.json({ ok: true, id: keyId, status: "revoked" });
});

portalRoutes.get("/usage", requireAuth, async (c) => {
  const user = c.get("user");
  const today = todayUtc();
  const sinceDate = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);

  const daily = await c.env.AUTH_DB.prepare(
    `SELECT u.date_utc,
            SUM(u.request_count) AS requests,
            SUM(u.error_count) AS errors,
            CASE WHEN SUM(u.request_count) > 0
                 THEN ROUND(CAST(SUM(u.total_latency_ms) AS REAL) / SUM(u.request_count), 1)
                 ELSE 0 END AS avg_latency_ms
     FROM api_usage_daily u
     JOIN api_keys k ON k.id = u.key_id
     WHERE k.user_id = ? AND u.date_utc >= ?
     GROUP BY u.date_utc
     ORDER BY u.date_utc ASC`
  )
    .bind(user.id, sinceDate)
    .all<{ date_utc: string; requests: number; errors: number; avg_latency_ms: number }>();

  const byEndpoint = await c.env.AUTH_DB.prepare(
    `SELECT u.endpoint_group,
            SUM(u.request_count) AS requests,
            SUM(u.error_count) AS errors
     FROM api_usage_daily u
     JOIN api_keys k ON k.id = u.key_id
     WHERE k.user_id = ? AND u.date_utc >= ?
     GROUP BY u.endpoint_group
     ORDER BY requests DESC`
  )
    .bind(user.id, sinceDate)
    .all<{ endpoint_group: string; requests: number; errors: number }>();

  const dailyMap = new Map(daily.results.map((r) => [r.date_utc, r]));
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const entry = dailyMap.get(d);
    series.push({
      date: d,
      requests: Number(entry?.requests ?? 0),
      errors: Number(entry?.errors ?? 0),
      avg_latency_ms: Number(entry?.avg_latency_ms ?? 0),
    });
  }

  const todayEntry = dailyMap.get(today);
  const total14d = series.reduce((acc, s) => acc + s.requests, 0);
  const errors14d = series.reduce((acc, s) => acc + s.errors, 0);

  return c.json({
    today_utc: today,
    requests_today: Number(todayEntry?.requests ?? 0),
    errors_today: Number(todayEntry?.errors ?? 0),
    requests_14d: total14d,
    errors_14d: errors14d,
    series,
    by_endpoint: byEndpoint.results,
  });
});
