export interface User {
  id: string;
  email: string;
  full_name: string;
  company: string;
  use_case: string;
  role: "user" | "admin";
  status: "pending" | "approved" | "suspended";
  created_at: string;
  last_login_at: string | null;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  status: "active" | "paused" | "revoked";
  rate_limit_per_min: number;
  daily_quota: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  requests_today: number;
  errors_today: number;
  requests_total: number;
}

export interface AdminKeyItem extends ApiKeyItem {
  user_id: string;
  owner_email: string;
  owner_name: string;
  owner_company: string;
  owner_status: "pending" | "approved" | "suspended";
}

export interface AdminUserItem extends User {
  active_keys: number;
  requests_today: number;
}

export interface UsageSeriesPoint {
  date: string;
  requests: number;
  errors: number;
  avg_latency_ms?: number;
}

export interface UsageResponse {
  today_utc: string;
  requests_today: number;
  errors_today: number;
  requests_14d: number;
  errors_14d: number;
  series: UsageSeriesPoint[];
  by_endpoint: Array<{ endpoint_group: string; requests: number; errors: number }>;
}

export interface AdminOverview {
  users: { pending: number; approved: number; suspended: number; total: number };
  keys: { active: number; paused: number; revoked: number; total: number };
  usage: {
    requests_today: number;
    errors_today: number;
    requests_7d: number;
    requests_14d: number;
  };
  series: UsageSeriesPoint[];
}

export interface AuditLogItem {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  details_json: string | null;
  created_at: string;
  admin_email: string;
  admin_name: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string }).message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  me: () =>
    request<{ user: User | null; config: { max_keys_per_user: number; gateway_origin: string } }>(
      "/portal/auth/me"
    ),
  login: (email: string, password: string) =>
    request<{ user: User }>("/portal/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signup: (payload: {
    full_name: string;
    email: string;
    password: string;
    company: string;
    use_case: string;
  }) =>
    request<{ user: User }>("/portal/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ ok: boolean }>("/portal/auth/logout", { method: "POST" }),

  listKeys: () => request<{ keys: ApiKeyItem[] }>("/portal/keys"),
  mintKey: (name: string) =>
    request<{ raw_key: string; key: ApiKeyItem }>("/portal/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  toggleKey: (id: string, status: "active" | "paused") =>
    request<{ ok: boolean }>(`/portal/keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  revokeKey: (id: string) =>
    request<{ ok: boolean }>(`/portal/keys/${id}`, { method: "DELETE" }),
  usage: () => request<UsageResponse>("/portal/usage"),

  adminOverview: () => request<AdminOverview>("/portal/admin/overview"),
  adminUsers: (status?: string, q?: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    const qs = p.toString();
    return request<{ users: AdminUserItem[] }>(`/portal/admin/users${qs ? `?${qs}` : ""}`);
  },
  adminUpdateUser: (id: string, status: "pending" | "approved" | "suspended") =>
    request<{ ok: boolean }>(`/portal/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  adminKeys: (status?: string, q?: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    const qs = p.toString();
    return request<{ keys: AdminKeyItem[] }>(`/portal/admin/keys${qs ? `?${qs}` : ""}`);
  },
  adminUpdateKey: (
    id: string,
    payload: { status?: "active" | "paused" | "revoked"; rate_limit_per_min?: number; daily_quota?: number }
  ) =>
    request<{ ok: boolean }>(`/portal/admin/keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminAudit: () => request<{ logs: AuditLogItem[] }>("/portal/admin/audit"),
};
