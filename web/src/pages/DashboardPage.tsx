import {
  Check,
  Clock,
  Copy,
  Key,
  Pause,
  Play,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRevealModal } from "../components/KeyRevealModal";
import { StatusBadge } from "../components/StatusBadge";
import { UsageChart } from "../components/UsageChart";
import { api, type ApiKeyItem, type UsageResponse, type User } from "../lib/api";

interface DashboardPageProps {
  user: User;
  maxKeys: number;
  gatewayOrigin: string;
  section: "keys" | "integration";
}

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  return iso.slice(0, 16).replace("T", " ") + " UTC";
}

export function DashboardPage({ user, maxKeys, gatewayOrigin, section }: DashboardPageProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [minting, setMinting] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; rawKey: string } | null>(null);
  const [sdkLang, setSdkLang] = useState<"python" | "typescript" | "mcp">("python");
  const [copiedSdk, setCopiedSdk] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kRes, uRes] = await Promise.all([api.listKeys(), api.usage()]);
      setKeys(kRes.keys);
      setUsage(uRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleMint(e: FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setMinting(true);
    setError(null);
    try {
      const res = await api.mintKey(newKeyName.trim());
      setRevealed({ name: res.key.name, rawKey: res.raw_key });
      setNewKeyName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mint API key.");
    } finally {
      setMinting(false);
    }
  }

  async function handleToggle(item: ApiKeyItem) {
    const next = item.status === "active" ? "paused" : "active";
    try {
      await api.toggleKey(item.id, next);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update key status.");
    }
  }

  async function handleRevoke(item: ApiKeyItem) {
    const ok = window.confirm(
      `Revoking ${item.key_prefix} (${item.name}) immediately rejects all requests using this key. This cannot be undone.`
    );
    if (!ok) return;
    try {
      await api.revokeKey(item.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke key.");
    }
  }

  const activeKeys = keys.filter((k) => k.status === "active");
  const nonRevokedKeys = keys.filter((k) => k.status !== "revoked");
  const combinedDailyQuota = activeKeys.reduce((acc, k) => acc + k.daily_quota, 0);
  const requestsToday = usage?.requests_today ?? 0;
  const errorRate =
    usage && usage.requests_14d > 0
      ? ((usage.errors_14d / usage.requests_14d) * 100).toFixed(1)
      : "0.0";

  const snippets: Record<"python" | "typescript" | "mcp", string> = {
    python: `import os, requests

class REAAClient:
    def __init__(self, api_key: str | None = None):
        self.key = api_key or os.environ["REAA_API_KEY"]
        self.base = "${gatewayOrigin}/gateway/v1"

    def _get(self, path: str, params: dict | None = None):
        r = requests.get(f"{self.base}{path}", params=params, headers={"X-API-Key": self.key}, timeout=20)
        r.raise_for_status()
        return r.json()

    def search(self, query: str, district: str | None = None, limit: int = 20):
        return self._get("/projects", {"q": query, "district": district, "limit": limit})

    def project(self, project_id: str):
        return self._get(f"/projects/{project_id}")

    def inventory(self, project_id: str):
        return self._get(f"/projects/{project_id}/inventory")

    def qpr(self, project_id: str):
        return self._get(f"/projects/{project_id}/qpr")

    def documents(self, project_id: str, section: str | None = None):
        return self._get(f"/projects/{project_id}/documents", {"section": section})

    def complaints(self, project_id: str, scope: str = "all"):
        return self._get(f"/projects/{project_id}/complaints", {"scope": scope})

client = REAAClient(api_key="rk_live_your_key_here")
print(client.search("silversky"))`,

    typescript: `export class REAAClient {
  private readonly base = "${gatewayOrigin}/gateway/v1";
  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(\`\${this.base}\${path}\`);
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, { headers: { "X-API-Key": this.apiKey } });
    if (!res.ok) throw new Error(\`REAA request failed (\${res.status})\`);
    return res.json() as Promise<T>;
  }

  search(q: string, district?: string, limit = 20) {
    return this.get("/projects", { q, district, limit });
  }
  project(id: string) { return this.get(\`/projects/\${id}\`); }
  inventory(id: string) { return this.get(\`/projects/\${id}/inventory\`); }
  qpr(id: string) { return this.get(\`/projects/\${id}/qpr\`); }
  documents(id: string, section?: string) { return this.get(\`/projects/\${id}/documents\`, { section }); }
  complaints(id: string, scope: "project" | "promoter" | "all" = "all") {
    return this.get(\`/projects/\${id}/complaints\`, { scope });
  }
}

const reaa = new REAAClient(process.env.REAA_API_KEY!);
const matches = await reaa.search("silversky");`,

    mcp: `{
  "reaa": {
    "gateway": "${gatewayOrigin}/gateway/v1",
    "headers": {
      "X-API-Key": "rk_live_your_key_here"
    },
    "capabilities": [
      "search_projects",
      "get_project_core",
      "get_project_inventory",
      "get_project_qpr",
      "get_project_documents",
      "get_project_complaints"
    ]
  }
}`,
  };

  async function copySnippet() {
    await navigator.clipboard.writeText(snippets[sdkLang]);
    setCopiedSdk(true);
    setTimeout(() => setCopiedSdk(false), 2000);
  }

  if (section === "integration") {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-[28px] font-bold">SDK Integration</h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--text-secondary)" }}>
            Drop your API key into a lightweight client wrapper. All requests authenticate through
            your private gateway.
          </p>
        </header>

        {user.status !== "approved" ? (
          <div
            className="rounded-[8px] border p-6"
            style={{
              backgroundColor: "var(--warning-soft)",
              borderColor: "var(--warning-border)",
              color: "var(--warning)",
            }}
          >
            <p className="text-[16px] font-semibold">Integration unlocks after account approval</p>
            <p className="mt-1 text-[14px]">
              Your request is currently under admin review. Once approved, mint an API key under
              Overview & Keys and paste it here.
            </p>
          </div>
        ) : (
          <section
            className="overflow-hidden rounded-[8px] border"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2" role="tablist" aria-label="SDK language">
                {(["python", "typescript", "mcp"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="tab"
                    aria-selected={sdkLang === lang}
                    onClick={() => setSdkLang(lang)}
                    className="min-h-[36px] rounded-[6px] px-3 text-[13px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: sdkLang === lang ? "var(--bg-ink)" : "var(--bg-subtle)",
                      color: sdkLang === lang ? "var(--text-on-ink)" : "var(--text-secondary)",
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={copySnippet}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] border px-3 text-[13px] font-medium"
                style={{
                  borderColor: "var(--border-strong)",
                  backgroundColor: "var(--bg-base)",
                  color: "var(--text-primary)",
                }}
              >
                {copiedSdk ? <Check size={15} weight="bold" /> : <Copy size={15} />}
                {copiedSdk ? "Copied snippet" : "Copy snippet"}
              </button>
            </div>
            <pre
              className="overflow-x-auto p-5 font-mono-num text-[13px] leading-[1.6]"
              style={{ backgroundColor: "var(--bg-ink)", color: "var(--text-on-ink)" }}
            >
              <code>{snippets[sdkLang]}</code>
            </pre>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold">Overview & API Keys</h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--text-secondary)" }}>
            Manage your private credentials and monitor real-time daily gateway quotas.
          </p>
        </div>
        <StatusBadge status={user.status} />
      </header>

      {user.status === "pending" && (
        <section
          className="rounded-[8px] border p-5"
          style={{
            backgroundColor: "var(--warning-soft)",
            borderColor: "var(--warning-border)",
          }}
        >
          <div className="flex items-start gap-3">
            <Clock size={22} weight="bold" style={{ color: "var(--warning)" }} className="mt-0.5 shrink-0" />
            <div>
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--warning)" }}>
                Account pending administrator approval
              </h2>
              <p className="mt-1 text-[14px]" style={{ color: "var(--text-primary)" }}>
                Your registration for <strong>{user.company}</strong> is in the review queue. Key
                minting unlocks immediately once an administrator approves your request.
              </p>
              <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                Submitted use case: {user.use_case}
              </p>
            </div>
          </div>
        </section>
      )}

      {user.status === "suspended" && (
        <section
          className="rounded-[8px] border p-5"
          style={{
            backgroundColor: "var(--danger-soft)",
            borderColor: "var(--danger-border)",
          }}
        >
          <div className="flex items-start gap-3">
            <WarningCircle size={22} weight="bold" style={{ color: "var(--danger)" }} className="mt-0.5 shrink-0" />
            <div>
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--danger)" }}>
                Account suspended
              </h2>
              <p className="mt-1 text-[14px]" style={{ color: "var(--text-primary)" }}>
                All API keys linked to this account are currently blocked. Contact an administrator
                to restore access.
              </p>
            </div>
          </div>
        </section>
      )}

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

      <section className="grid gap-4 sm:grid-cols-3">
        <div
          className="rounded-[8px] border p-5"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Requests Today (UTC)
          </p>
          <p className="font-mono-num mt-2 text-[28px] font-semibold leading-none">
            {requestsToday.toLocaleString()}
            {combinedDailyQuota > 0 && (
              <span className="text-[15px] font-normal" style={{ color: "var(--text-tertiary)" }}>
                {" "}
                / {combinedDailyQuota.toLocaleString()}
              </span>
            )}
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
            {activeKeys.length}
            <span className="text-[15px] font-normal" style={{ color: "var(--text-tertiary)" }}>
              {" "}
              / {maxKeys} max
            </span>
          </p>
        </div>

        <div
          className="rounded-[8px] border p-5"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            14-Day Error Rate
          </p>
          <p className="font-mono-num mt-2 text-[28px] font-semibold leading-none">{errorRate}%</p>
        </div>
      </section>

      {usage && (
        <UsageChart
          series={usage.series}
          title="14-Day Request Volume"
          subtitle="UTC daily requests routed across your active API keys."
        />
      )}

      <section
        className="rounded-[8px] border"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-4 border-b p-5"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2 className="text-[18px] font-semibold">API Keys</h2>
            <p className="mt-0.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              Keys are hashed immediately on creation. Pause or revoke any key at any time.
            </p>
          </div>

          <form onSubmit={handleMint} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label htmlFor="new-key-name" className="sr-only">
              New API key label
            </label>
            <input
              id="new-key-name"
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key label (e.g. Production RAG)"
              disabled={user.status !== "approved" || nonRevokedKeys.length >= maxKeys}
              className="min-h-[42px] flex-1 rounded-[8px] border px-3 text-[14px] disabled:opacity-50 sm:w-56"
              style={{
                backgroundColor: "var(--bg-base)",
                borderColor: "var(--border-strong)",
              }}
            />
            <button
              type="submit"
              disabled={
                minting ||
                user.status !== "approved" ||
                nonRevokedKeys.length >= maxKeys ||
                newKeyName.trim().length < 2
              }
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-[8px] px-4 text-[14px] font-semibold disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-on-accent)",
              }}
            >
              <Plus size={16} weight="bold" />
              {minting ? "Minting..." : "Mint API Key"}
            </button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Loading credentials...
          </div>
        ) : keys.length === 0 ? (
          <div className="p-10 text-center">
            <Key
              size={28}
              className="mx-auto mb-2"
              style={{ color: "var(--text-tertiary)" }}
            />
            <p className="text-[15px] font-medium">No API keys issued yet</p>
            <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              {user.status === "approved"
                ? "Enter a descriptive label above and click Mint API Key to create your first credential."
                : "Once your account is approved, you can mint up to 3 scoped API keys here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr
                  className="border-b text-[12px] uppercase tracking-wider"
                  style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                >
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Key Prefix</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Today / Quota</th>
                  <th className="px-5 py-3 font-semibold">RPM</th>
                  <th className="px-5 py-3 font-semibold">Last Used</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3.5 font-medium">{k.name}</td>
                    <td className="font-mono-num px-5 py-3.5 text-[13px]">{k.key_prefix}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="font-mono-num px-5 py-3.5 text-[13px]">
                      {k.requests_today.toLocaleString()} / {k.daily_quota.toLocaleString()}
                    </td>
                    <td className="font-mono-num px-5 py-3.5 text-[13px]">
                      {k.rate_limit_per_min}
                    </td>
                    <td
                      className="font-mono-num px-5 py-3.5 text-[12px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatTime(k.last_used_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {k.status !== "revoked" ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggle(k)}
                            aria-label={k.status === "active" ? `Pause ${k.name}` : `Resume ${k.name}`}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] border px-2.5 text-[13px] font-medium"
                            style={{
                              borderColor: "var(--border-strong)",
                              backgroundColor: "var(--bg-base)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {k.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                            {k.status === "active" ? "Pause" : "Resume"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(k)}
                            aria-label={`Revoke ${k.name}`}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[6px] border px-2.5 text-[13px] font-medium"
                            style={{
                              borderColor: "var(--danger-border)",
                              backgroundColor: "var(--danger-soft)",
                              color: "var(--danger)",
                            }}
                          >
                            <Trash size={14} />
                            Revoke
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
        )}
      </section>

      {revealed && (
        <KeyRevealModal
          keyName={revealed.name}
          rawKey={revealed.rawKey}
          onClose={() => setRevealed(null)}
        />
      )}
    </div>
  );
}
