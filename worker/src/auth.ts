import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomHex, sha256Hex } from "./crypto";
import type { AppVariables, Env, SafeUser, UserRow } from "./types";

export const SESSION_COOKIE = "reaa_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    company: row.company,
    use_case: row.use_case,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
}

export async function createSession(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  userId: string
): Promise<void> {
  const rawToken = randomHex(32);
  const tokenHash = await sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await c.env.AUTH_DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(tokenHash, userId, expiresAt, now.toISOString())
    .run();

  const isHttps = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSession(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): Promise<void> {
  const rawToken = getCookie(c, SESSION_COOKIE);
  if (rawToken) {
    const tokenHash = await sha256Hex(rawToken);
    await c.env.AUTH_DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const rawToken = getCookie(c, SESSION_COOKIE);
  if (!rawToken) {
    return c.json({ error: "unauthorized", message: "Sign in to continue." }, 401);
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
    if (row) {
      await c.env.AUTH_DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(tokenHash)
        .run();
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ error: "session_expired", message: "Your session expired. Sign in again." }, 401);
  }

  c.set("user", toSafeUser(row));
  await next();
};

export const requireAdmin: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "forbidden", message: "Admin access is required." }, 403);
  }
  await next();
};
