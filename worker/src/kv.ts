import type { Env, KvKeyRecord } from "./types";

export function kvKeyName(keyHash: string): string {
  return `keyhash:${keyHash}`;
}

export async function syncKeyToKv(env: Env, keyHash: string, record: KvKeyRecord): Promise<void> {
  if (record.status === "revoked" || record.user_status === "suspended") {
    await env.API_KV.delete(kvKeyName(keyHash));
    return;
  }
  await env.API_KV.put(kvKeyName(keyHash), JSON.stringify(record));
}

export async function deleteKeyFromKv(env: Env, keyHash: string): Promise<void> {
  await env.API_KV.delete(kvKeyName(keyHash));
}

export async function syncAllUserKeysToKv(
  env: Env,
  userId: string,
  userStatus: "pending" | "approved" | "suspended"
): Promise<void> {
  const { results } = await env.AUTH_DB.prepare(
    "SELECT id, key_hash, status, rate_limit_per_min, daily_quota FROM api_keys WHERE user_id = ?"
  )
    .bind(userId)
    .all<{
      id: string;
      key_hash: string;
      status: "active" | "paused" | "revoked";
      rate_limit_per_min: number;
      daily_quota: number;
    }>();

  await Promise.all(
    results.map((k) =>
      syncKeyToKv(env, k.key_hash, {
        key_id: k.id,
        user_id: userId,
        status: k.status,
        user_status: userStatus,
        rate_limit_per_min: k.rate_limit_per_min,
        daily_quota: k.daily_quota,
      })
    )
  );
}
