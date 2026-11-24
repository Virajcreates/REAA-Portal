import { Hono } from "hono";
import { requireAdmin, requireAuth } from "../auth";
import { randomId } from "../crypto";
import { deleteKeyFromKv, syncAllUserKeysToKv, syncKeyToKv } from "../kv";
import type { AppVariables, Env } from "../types";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

adminRoutes.use("*", requireAuth, requireAdmin);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function writeAudit(
  env: Env,
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>
): Promise<void> {
  await env.AUTH_DB.prepare(
    `INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      randomId("aud"),
      adminUserId,
      action,
      targetType,
      targetId,
      JSON.stringify(details),
      new Date().toISOString()
    )
    .run();
}

adminRoutes.get("/overview", async (c) => {
  const today = todayUtc();
  const since7d = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const since14d = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);

  const userCounts = await c.env.AUTH_DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_users,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_users,
       SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended_users,
       COUNT(*) AS total_users
     FROM users`
  ).first<Record<string, number>>();

  const keyCounts = await c.env.AUTH_DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_keys,
       SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_keys,
       SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked_keys,
       COUNT(*) AS total_keys
     FROM api_keys`
  ).first<Record<string, number>>();

  const usageSummary = await c.env.AUTH_DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN date_utc = ? THEN request_count ELSE 0 END), 0) AS requests_today,
       COALESCE(SUM(CASE WHEN date_utc = ? THEN error_count ELSE 0 END), 0) AS errors_today,
       COALESCE(SUM(CASE WHEN date_utc >= ? THEN request_count ELSE 0 END), 0) AS requests_7d,
       COALESCE(SUM(request_count), 0) AS requests_14d
     FROM api_usage_daily
     WHERE date_utc >= ?`
  )
    .bind(today, today, since7d, since14d)
    .first<Record<string, number>>();

  const dailyRows = await c.env.AUTH_DB.prepare(
    `SELECT date_utc,
            SUM(request_count) AS requests,
            SUM(error_count) AS errors
     FROM api_usage_daily
     WHERE date_utc >= ?
     GROUP BY date_utc
     ORDER BY date_utc ASC`
  )
    .bind(since14d)
    .all<{ date_utc: string; requests: number; errors: number }>();

  const dailyMap = new Map(dailyRows.results.map((r) => [r.date_utc, r]));
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const entry = dailyMap.get(d);
    series.push({
      date: d,
      requests: Number(entry?.requests ?? 0),
      errors: Number(entry?.errors ?? 0),
    });
  }

  return c.json({
    users: {
      pending: Number(userCounts?.pending_users ?? 0),
      approved: Number(userCounts?.approved_users ?? 0),
      suspended: Number(userCounts?.suspended_users ?? 0),
      total: Number(userCounts?.total_users ?? 0),
    },
    keys: {
      active: Number(keyCounts?.active_keys ?? 0),
      paused: Number(keyCounts?.paused_keys ?? 0),
      revoked: Number(keyCounts?.revoked_keys ?? 0),
      total: Number(keyCounts?.total_keys ?? 0),
    },
    usage: {
      requests_today: Number(usageSummary?.requests_today ?? 0),
      errors_today: Number(usageSummary?.errors_today ?? 0),
      requests_7d: Number(usageSummary?.requests_7d ?? 0),
      requests_14d: Number(usageSummary?.requests_14d ?? 0),
    },
    series,
  });
});

adminRoutes.get("/users", async (c) => {
  const status = (c.req.query("status") ?? "").trim();
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const today = todayUtc();

  const where: string[] = [];
  const binds: unknown[] = [today];
  if (status && ["pending", "approved", "suspended"].includes(status)) {
    where.push("u.status = ?");
    binds.push(status);
  }
  if (q) {
    where.push("(LOWER(u.email) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(u.company) LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { results } = await c.env.AUTH_DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.company, u.use_case, u.role, u.status,
            u.created_at, u.last_login_at,
            COUNT(DISTINCT CASE WHEN k.status = 'active' THEN k.id END) AS active_keys,
            COALESCE(SUM(CASE WHEN d.date_utc = ? THEN d.request_count ELSE 0 END), 0) AS requests_today
     FROM users u
     LEFT JOIN api_keys k ON k.user_id = u.id
     LEFT JOIN api_usage_daily d ON d.key_id = k.id
     ${whereSql}
     GROUP BY u.id
     ORDER BY CASE WHEN u.status = 'pending' THEN 0 ELSE 1 END, u.created_at DESC`
  )
    .bind(...binds)
    .all();

  return c.json({ users: results });
});

adminRoutes.patch("/users/:id", async (c) => {
  const admin = c.get("user");
  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const nextStatus = String(body?.status ?? "").trim() as "pending" | "approved" | "suspended";

  if (!["pending", "approved", "suspended"].includes(nextStatus)) {
    return c.json({ error: "validation", message: "Status must be pending, approved, or suspended." }, 400);
  }
  if (targetId === admin.id && nextStatus !== "approved") {
    return c.json({ error: "invalid_action", message: "You cannot suspend your own admin account." }, 400);
  }

  const target = await c.env.AUTH_DB.prepare(
    "SELECT id, email, status FROM users WHERE id = ? LIMIT 1"
  )
    .bind(targetId)
    .first<{ id: string; email: string; status: string }>();

  if (!target) {
    return c.json({ error: "not_found", message: "User not found." }, 404);
  }

  const now = new Date().toISOString();
  await c.env.AUTH_DB.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?")
    .bind(nextStatus, now, targetId)
    .run();

  await syncAllUserKeysToKv(c.env, targetId, nextStatus);
  await writeAudit(c.env, admin.id, `user_${nextStatus}`, "user", targetId, {
    email: target.email,
    previous_status: target.status,
    next_status: nextStatus,
  });

  return c.json({ ok: true, id: targetId, status: nextStatus });
});

adminRoutes.get("/keys", async (c) => {
  const status = (c.req.query("status") ?? "").trim();
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const today = todayUtc();

  const where: string[] = [];
  const binds: unknown[] = [today, today];
  if (status && ["active", "paused", "revoked"].includes(status)) {
    where.push("k.status = ?");
    binds.push(status);
  }
  if (q) {
    where.push(
      "(LOWER(k.name) LIKE ? OR LOWER(k.key_prefix) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.company) LIKE ?)"
    );
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { results } = await c.env.AUTH_DB.prepare(
    `SELECT k.id, k.user_id, k.name, k.key_prefix, k.status, k.rate_limit_per_min,
            k.daily_quota, k.created_at, k.last_used_at, k.revoked_at,
            u.email AS owner_email, u.full_name AS owner_name, u.company AS owner_company,
            u.status AS owner_status,
            COALESCE(SUM(CASE WHEN d.date_utc = ? THEN d.request_count ELSE 0 END), 0) AS requests_today,
            COALESCE(SUM(CASE WHEN d.date_utc = ? THEN d.error_count ELSE 0 END), 0) AS errors_today,
            COALESCE(SUM(d.request_count), 0) AS requests_total
     FROM api_keys k
     JOIN users u ON u.id = k.user_id
     LEFT JOIN api_usage_daily d ON d.key_id = k.id
     ${whereSql}
     GROUP BY k.id
     ORDER BY requests_today DESC, k.created_at DESC`
  )
    .bind(...binds)
    .all();

  return c.json({ keys: results });
});

adminRoutes.patch("/keys/:id", async (c) => {
  const admin = c.get("user");
  const keyId = c.req.param("id");
  const body = await c.req.json().catch(() => null);

  const row = await c.env.AUTH_DB.prepare(
    `SELECT k.id, k.user_id, k.key_prefix, k.key_hash, k.status,
            k.rate_limit_per_min, k.daily_quota, u.status AS user_status
     FROM api_keys k
     JOIN users u ON u.id = k.user_id
     WHERE k.id = ? LIMIT 1`
  )
    .bind(keyId)
    .first<{
      id: string;
      user_id: string;
      key_prefix: string;
      key_hash: string;
      status: "active" | "paused" | "revoked";
      rate_limit_per_min: number;
      daily_quota: number;
      user_status: "pending" | "approved" | "suspended";
    }>();

  if (!row) {
    return c.json({ error: "not_found", message: "API key not found." }, 404);
  }

  const nextStatus = body?.status ? String(body.status).trim() : row.status;
  if (!["active", "paused", "revoked"].includes(nextStatus)) {
    return c.json({ error: "validation", message: "Invalid key status." }, 400);
  }
  if (row.status === "revoked" && nextStatus !== "revoked") {
    return c.json({ error: "invalid_state", message: "Revoked keys cannot be re-enabled." }, 400);
  }

  const nextRpm =
    body?.rate_limit_per_min !== undefined
      ? Math.max(1, Math.min(2000, Math.floor(Number(body.rate_limit_per_min))))
      : row.rate_limit_per_min;
  const nextQuota =
    body?.daily_quota !== undefined
      ? Math.max(10, Math.min(100000, Math.floor(Number(body.daily_quota))))
      : row.daily_quota;

  const revokedAt = nextStatus === "revoked" ? new Date().toISOString() : null;
  await c.env.AUTH_DB.prepare(
    `UPDATE api_keys
     SET status = ?, rate_limit_per_min = ?, daily_quota = ?,
         revoked_at = COALESCE(?, revoked_at)
     WHERE id = ?`
  )
    .bind(nextStatus, nextRpm, nextQuota, revokedAt, keyId)
    .run();

  if (nextStatus === "revoked") {
    await deleteKeyFromKv(c.env, row.key_hash);
  } else {
    await syncKeyToKv(c.env, row.key_hash, {
      key_id: row.id,
      user_id: row.user_id,
      status: nextStatus as "active" | "paused",
      user_status: row.user_status,
      rate_limit_per_min: nextRpm,
      daily_quota: nextQuota,
    });
  }

  await writeAudit(c.env, admin.id, "key_updated", "api_key", keyId, {
    key_prefix: row.key_prefix,
    status: nextStatus,
    rate_limit_per_min: nextRpm,
    daily_quota: nextQuota,
  });

  return c.json({
    ok: true,
    id: keyId,
    status: nextStatus,
    rate_limit_per_min: nextRpm,
    daily_quota: nextQuota,
  });
});

adminRoutes.get("/audit", async (c) => {
  const { results } = await c.env.AUTH_DB.prepare(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.details_json, a.created_at,
            u.email AS admin_email, u.full_name AS admin_name
     FROM admin_audit_logs a
     JOIN users u ON u.id = a.admin_user_id
     ORDER BY a.created_at DESC
     LIMIT 100`
  ).all();

  return c.json({ logs: results });
});
