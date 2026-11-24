export interface Env {
  AUTH_DB: D1Database;
  API_KV: KVNamespace;
  ASSETS?: Fetcher;
  KRERA_API?: Fetcher;
  UPSTREAM_API_URL: string;
  UPSTREAM_INTERNAL_SECRET?: string;
  ADMIN_BOOTSTRAP_EMAIL?: string;
  DEFAULT_RATE_LIMIT_PER_MIN?: string;
  DEFAULT_DAILY_QUOTA?: string;
  MAX_KEYS_PER_USER?: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  full_name: string;
  company: string;
  use_case: string;
  role: "user" | "admin";
  status: "pending" | "approved" | "suspended";
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface SafeUser {
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

export interface KvKeyRecord {
  key_id: string;
  user_id: string;
  status: "active" | "paused" | "revoked";
  user_status: "pending" | "approved" | "suspended";
  rate_limit_per_min: number;
  daily_quota: number;
}

export type AppVariables = {
  user: SafeUser;
};
