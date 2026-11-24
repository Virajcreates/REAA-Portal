import {
  CheckCircle,
  MagnifyingGlass,
  Pause,
  Play,
  Prohibit,
  SlidersHorizontal,
  Trash,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { UsageChart } from "../components/UsageChart";
import {
  api,
  type AdminKeyItem,
  type AdminOverview,
  type AdminUserItem,
  type AuditLogItem,
} from "../lib/api";

interface AdminPageProps {
  onPendingCountChange: (count: number) => void;
}

type AdminTab = "approvals" | "users" | "keys" | "audit";

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  return iso.slice(0, 16).replace("T", " ");
}

export function AdminPage({ onPendingCountChange }: AdminPageProps) {
  const [tab, setTab] = useState<AdminTab>("approvals");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [keys, setKeys] = useState<AdminKeyItem[]>([]);
  const [audit, setAudit] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingKey, setEditingKey] = useState<AdminKeyItem | null>(null);
  const [editRpm, setEditRpm] = useState("60");
  const [editQuota, setEditQuota] = useState("500");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, uRes, kRes, aRes] = await Promise.all([
        api.adminOverview(),
        api.adminUsers(tab === "approvals" ? "pending" : statusFilter, search),
        api.adminKeys(tab === "keys" ? statusFilter : "", search),
        api.adminAudit(),
      ]);
      setOverview(ov);
      onPendingCountChange(ov.users.pending);
      setUsers(uRes.users);
      setKeys(kRes.keys);
      setAudit(aRes.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin telemetry.");
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter, search, onPendingCountChange]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function updateUserStatus(
    u: AdminUserItem,
    next: "approved" | "suspended" | "pending"
  ) {
    if (
      next === "suspended" &&
      !window.confirm(
        `Suspending ${u.email} immediately blocks all of their active API keys. Continue?`
      )
    ) {
      return;
    }
    try {
      await api.adminUpdateUser(u.id, next);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user status.");
    }
  }

  async function toggleAdminKey(k: AdminKeyItem, next: "active" | "paused" | "revoked") {
    if (
      next === "revoked" &&
      !window.confirm(
        `Permanently revoke ${k.key_prefix} (${k.owner_email})? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api.adminUpdateKey(k.id, { status: next });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update key.");
    }
  }

  async function saveLimits(e: FormEvent) {
    e.preventDefault();
    if (!editingKey) return;
    try {
      await api.adminUpdateKey(editingKey.id, {
        rate_limit_per_min: Number(editRpm),
        daily_quota: Number(editQuota),
      });
      setEditingKey(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save limits.");
    }
  }

  const tabs: Array<{ id: AdminTab; label: string; count?: number }> = [
    { id: "approvals", label: "Pending Approvals", count: overview?.users.pending ?? 0 },
    { id: "users", label: "All Users", count: overview?.users.total },
    { id: "keys", label: "Global API Keys", count: overview?.keys.active },
    { id: "audit", label: "Audit Trail" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-bold">Admin Control Center</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--text-secondary)" }}>
          Review incoming developer applications, regulate quotas, and monitor live gateway usage.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-[8px] border px-4 py-3 text-[14px]"
          style={{
            backgroundColor: "var(--danger-soft)",
            borderColor: "var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      {overview && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="rounded-[8px] border p-5"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Pending Approvals
              </p>
              <p
                className="font-mono-num mt-2 text-[28px] font-semibold leading-none"
                style={{
                  color: overview.users.pending > 0 ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                {overview.users.pending}
              </p>
            </div>
            <div
              className="rounded-[8px] border p-5"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Approved Accounts
              </p>
              <p className="font-mono-num mt-2 text-[28px] font-semibold leading-none">
                {overview.users.approved}
              </p>
              <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                of {overview.users.total} total registered users
              </p>
            </div>
            <div
              className="rounded-[8px] border p-5"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Active API Keys
              </p>
              <p className="font-mono-num mt-2 text-[28px] font-semibold leading-none">
                {overview.keys.active}
                <span className="text-[14px] font-normal" style={{ color: "var(--text-tertiary)" }}>
                  {" "}
                  ({overview.keys.paused} paused)
                </span>
              </p>
            </div>
            <div
              className="rounded-[8px] border p-5"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Gateway Requests Today
              </p>
              <p className="font-mono-num mt-2 text-[28px] font-semibold leading-none">
                {overview.usage.requests_today.toLocaleString()}
              </p>
            </div>
          </section>

          <UsageChart
            series={overview.series}
            title="Platform-Wide Gateway Volume (14 Days)"
            subtitle={`7-day total: ${overview.usage.requests_7d.toLocaleString()} requests · Today errors: ${overview.usage.errors_today}`}
          />
        </>
      )}

      <section
        className="rounded-[8px] border"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Admin sections">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.id);
                    setStatusFilter("");
                  }}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-[6px] px-3 text-[14px] font-medium"
                  style={{
                    backgroundColor: active ? "var(--bg-ink)" : "var(--bg-subtle)",
                    color: active ? "var(--text-on-ink)" : "var(--text-secondary)",
                  }}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span
                      className="font-mono-num rounded-[4px] px-1.5 py-0.2 text-[12px]"
                      style={{
                        backgroundColor: active
                          ? "var(--accent)"
                          : t.id === "approvals" && t.count > 0
                            ? "var(--accent-soft)"
                            : "var(--bg-surface)",
                        color: active
                          ? "var(--text-on-accent)"
                          : t.id === "approvals" && t.count > 0
                            ? "var(--accent)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {(tab === "users" || tab === "keys" || tab === "approvals") && (
            <div className="relative w-full sm:w-64">
              <MagnifyingGlass
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                style={{ color: "var(--text-tertiary)" }}
              />
              <label htmlFor="admin-search" className="sr-only">
                Filter records
              </label>
              <input
                id="admin-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, org, or prefix..."
                className="min-h-[38px] w-full rounded-[6px] border pr-3 pl-9 text-[14px]"
                style={{
                  backgroundColor: "var(--bg-base)",
                  borderColor: "var(--border-strong)",
                }}
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Loading records...
          </div>
        ) : tab === "approvals" || tab === "users" ? (
          users.length === 0 ? (
            <div className="p-10 text-center text-[14px]" style={{ color: "var(--text-secondary)" }}>
              {tab === "approvals"
                ? "No pending access requests right now. New signups will appear here for review."
                : "No users match the current search filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[14px]">
                <thead>
                  <tr
                    className="border-b text-[12px] uppercase tracking-wider"
                    style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                  >
                    <th className="px-5 py-3 font-semibold">Applicant</th>
                    <th className="px-5 py-3 font-semibold">Use Case</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Keys / Today</th>
                    <th className="px-5 py-3 text-right font-semibold">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-5 py-3.5 align-top">
                        <p className="font-semibold">
                          {u.full_name}{" "}
                          {u.role === "admin" && (
                            <span
                              className="font-mono-num ml-1 rounded-[4px] px-1.5 py-0.5 text-[11px] uppercase"
                              style={{ backgroundColor: "var(--bg-ink)", color: "var(--text-on-ink)" }}
                            >
                              Admin
                            </span>
                          )}
                        </p>
                        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                          {u.email}
                        </p>
                        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          {u.company} · Joined {u.created_at.slice(0, 10)}
                        </p>
                      </td>
                      <td
                        className="max-w-xs px-5 py-3.5 align-top text-[13px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {u.use_case}
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="font-mono-num px-5 py-3.5 align-top text-[13px]">
                        {u.active_keys} keys · {u.requests_today} req
                      </td>
                      <td className="px-5 py-3.5 text-right align-top">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          {u.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => updateUserStatus(u, "approved")}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-semibold"
                              style={{
                                backgroundColor: "var(--success)",
                                color: "var(--text-on-accent)",
                              }}
                            >
                              <CheckCircle size={15} weight="bold" />
                              Approve
                            </button>
                          )}
                          {u.role !== "admin" && u.status !== "suspended" && (
                            <button
                              type="button"
                              onClick={() => updateUserStatus(u, "suspended")}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] border px-3 text-[13px] font-medium"
                              style={{
                                borderColor: "var(--danger-border)",
                                backgroundColor: "var(--danger-soft)",
                                color: "var(--danger)",
                              }}
                            >
                              <Prohibit size={15} />
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "keys" ? (
          keys.length === 0 ? (
            <div className="p-10 text-center text-[14px]" style={{ color: "var(--text-secondary)" }}>
              No API keys issued across the platform yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[14px]">
                <thead>
                  <tr
                    className="border-b text-[12px] uppercase tracking-wider"
                    style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                  >
                    <th className="px-5 py-3 font-semibold">Key</th>
                    <th className="px-5 py-3 font-semibold">Owner</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Usage / Quota</th>
                    <th className="px-5 py-3 font-semibold">RPM</th>
                    <th className="px-5 py-3 text-right font-semibold">Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr
                      key={k.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold">{k.name}</p>
                        <p
                          className="font-mono-num text-[12px]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {k.key_prefix}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-medium">{k.owner_name}</p>
                        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                          {k.owner_email} · {k.owner_company}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={k.status} />
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-[13px]">
                        {k.requests_today.toLocaleString()} / {k.daily_quota.toLocaleString()}
                      </td>
                      <td className="font-mono-num px-5 py-3.5 text-[13px]">
                        {k.rate_limit_per_min}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {k.status !== "revoked" ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingKey(k);
                                setEditRpm(String(k.rate_limit_per_min));
                                setEditQuota(String(k.daily_quota));
                              }}
                              aria-label={`Edit limits for ${k.name}`}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-[6px] border px-2.5 text-[13px] font-medium"
                              style={{
                                borderColor: "var(--border-strong)",
                                backgroundColor: "var(--bg-base)",
                              }}
                            >
                              <SlidersHorizontal size={14} />
                              Limits
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                toggleAdminKey(k, k.status === "active" ? "paused" : "active")
                              }
                              aria-label={k.status === "active" ? `Pause ${k.name}` : `Resume ${k.name}`}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-[6px] border px-2.5 text-[13px] font-medium"
                              style={{
                                borderColor: "var(--border-strong)",
                                backgroundColor: "var(--bg-base)",
                              }}
                            >
                              {k.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAdminKey(k, "revoked")}
                              aria-label={`Revoke ${k.name}`}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-[6px] border px-2.5 text-[13px] font-medium"
                              style={{
                                borderColor: "var(--danger-border)",
                                backgroundColor: "var(--danger-soft)",
                                color: "var(--danger)",
                              }}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                            Revoked
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : audit.length === 0 ? (
          <div className="p-10 text-center text-[14px]" style={{ color: "var(--text-secondary)" }}>
            No admin actions logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr
                  className="border-b text-[12px] uppercase tracking-wider"
                  style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                >
                  <th className="px-5 py-3 font-semibold">Timestamp (UTC)</th>
                  <th className="px-5 py-3 font-semibold">Admin</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td
                      className="font-mono-num whitespace-nowrap px-5 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatTime(a.created_at)}
                    </td>
                    <td className="px-5 py-3 font-medium">{a.admin_email}</td>
                    <td className="font-mono-num px-5 py-3 font-semibold">{a.action}</td>
                    <td
                      className="font-mono-num max-w-md truncate px-5 py-3 text-[12px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {a.details_json}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "oklch(17.5% 0.012 75 / 0.52)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-limits-title"
        >
          <form
            onSubmit={saveLimits}
            className="w-full max-w-md rounded-[12px] border p-6 shadow-xl"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-strong)" }}
          >
            <h2 id="edit-limits-title" className="text-[18px] font-semibold">
              Update Key Limits
            </h2>
            <p className="mt-1 font-mono-num text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {editingKey.name} ({editingKey.key_prefix})
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="edit-rpm" className="block text-[14px] font-medium">
                  Requests per Minute (RPM)
                </label>
                <input
                  id="edit-rpm"
                  type="number"
                  min={1}
                  max={2000}
                  required
                  value={editRpm}
                  onChange={(e) => setEditRpm(e.target.value)}
                  className="font-mono-num mt-1.5 min-h-[44px] w-full rounded-[8px] border px-3.5 text-[15px]"
                  style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-strong)" }}
                />
              </div>
              <div>
                <label htmlFor="edit-quota" className="block text-[14px] font-medium">
                  Daily Quota (Requests / UTC Day)
                </label>
                <input
                  id="edit-quota"
                  type="number"
                  min={10}
                  max={100000}
                  required
                  value={editQuota}
                  onChange={(e) => setEditQuota(e.target.value)}
                  className="font-mono-num mt-1.5 min-h-[44px] w-full rounded-[8px] border px-3.5 text-[15px]"
                  style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-strong)" }}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                className="min-h-[42px] rounded-[8px] border px-4 text-[14px] font-medium"
                style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--bg-base)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-[8px] px-4 text-[14px] font-semibold"
                style={{ backgroundColor: "var(--accent)", color: "var(--text-on-accent)" }}
              >
                Save Limits
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
