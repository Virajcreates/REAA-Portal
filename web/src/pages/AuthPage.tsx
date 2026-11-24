import { Buildings, Key, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { ReaaLogo } from "../components/ReaaLogo";
import { api, type User } from "../lib/api";

interface AuthPageProps {
  onAuthenticated: (user: User) => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await api.login(email, password);
        onAuthenticated(res.user);
      } else {
        const res = await api.signup({
          full_name: fullName,
          email,
          password,
          company,
          use_case: useCase,
        });
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-12">
      <section
        className="arch-grid flex flex-col justify-between px-6 py-8 sm:px-10 lg:col-span-5 lg:min-h-screen lg:py-10"
        style={{ backgroundColor: "var(--bg-ink)", color: "var(--text-on-ink)" }}
      >
        <div>
          <div className="flex items-center gap-3">
            <ReaaLogo size={36} variant="dark" />
            <div>
              <span className="block text-[16px] font-bold leading-tight tracking-tight">
                REAA API
              </span>
              <span
                className="font-mono-num block text-[11px] uppercase tracking-wider"
                style={{ color: "var(--text-on-ink-muted)" }}
              >
                Developer Gateway
              </span>
            </div>
          </div>

          <h1 className="mt-7 text-[36px] font-bold leading-[1.06] sm:text-[46px]">
            REAA API Service Platform.
          </h1>
          <p
            className="mt-4 max-w-md text-[15px] leading-[1.55]"
            style={{ color: "var(--text-on-ink-muted)" }}
          >
            Centralized API credentials, quota governance, and unified gateway access for REAA's
            Karnataka RERA intelligence services.
          </p>

          <ul className="mt-7 space-y-4">
            <li className="flex items-start gap-3.5">
              <ShieldCheck size={20} weight="bold" style={{ color: "var(--accent)" }} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[15px] font-semibold">Vetted, key-gated access</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-on-ink-muted)" }}>
                  Every account is reviewed before credentials are issued. Zero public endpoints.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <Key size={20} weight="bold" style={{ color: "var(--accent)" }} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[15px] font-semibold">Cryptographic key isolation</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-on-ink-muted)" }}>
                  Keys are shown once, stored strictly as SHA-256 hashes, with instant pause and
                  revocation.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <Buildings size={20} weight="bold" style={{ color: "var(--accent)" }} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-[15px] font-semibold">DPDP-aligned statutory records</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-on-ink-muted)" }}>
                  Personal identifiers, PAN records, and bank account numbers are scrubbed before
                  storage.
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div
          className="mt-8 grid grid-cols-3 gap-4 border-t pt-5"
          style={{ borderColor: "var(--border-ink)" }}
        >
          <div>
            <p className="font-mono-num text-[20px] font-semibold">9,136</p>
            <p className="text-[13px]" style={{ color: "var(--text-on-ink-muted)" }}>
              Projects
            </p>
          </div>
          <div>
            <p className="font-mono-num text-[20px] font-semibold">31</p>
            <p className="text-[13px]" style={{ color: "var(--text-on-ink-muted)" }}>
              Districts
            </p>
          </div>
          <div>
            <p className="font-mono-num text-[20px] font-semibold">942k+</p>
            <p className="text-[13px]" style={{ color: "var(--text-on-ink-muted)" }}>
              Doc Tokens
            </p>
          </div>
        </div>
      </section>

      <main
        className="flex items-center justify-center px-6 py-10 sm:px-12 lg:col-span-7"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <div
          className="w-full max-w-[460px] rounded-[12px] border p-6 sm:p-8"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <div
            className="grid grid-cols-2 rounded-[8px] border p-1"
            style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="min-h-[40px] rounded-[6px] text-[14px] font-semibold"
              style={{
                backgroundColor: mode === "login" ? "var(--bg-surface)" : "transparent",
                color: mode === "login" ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className="min-h-[40px] rounded-[6px] text-[14px] font-semibold"
              style={{
                backgroundColor: mode === "signup" ? "var(--bg-surface)" : "transparent",
                color: mode === "signup" ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              Request Access
            </button>
          </div>

          <div className="mt-6">
            <h2 className="text-[22px] font-bold">
              {mode === "login" ? "Sign in to your workspace" : "Request developer access"}
            </h2>
            <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              {mode === "login"
                ? "Manage your API keys, quotas, and integration snippets."
                : "Submit your details. Accounts enter manual admin review before keys unlock."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-[8px] border px-3.5 py-2.5 text-[14px]"
              style={{
                backgroundColor: "var(--danger-soft)",
                borderColor: "var(--danger-border)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label htmlFor="full_name" className="block text-[14px] font-medium">
                    Full Name
                  </label>
                  <input
                    id="full_name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aarav Kulkarni"
                    className="mt-1.5 min-h-[44px] w-full rounded-[8px] border px-3.5 text-[15px]"
                    style={{
                      backgroundColor: "var(--bg-base)",
                      borderColor: "var(--border-strong)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="company" className="block text-[14px] font-medium">
                    Company / Organization
                  </label>
                  <input
                    id="company"
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Deccan PropTech Labs"
                    className="mt-1.5 min-h-[44px] w-full rounded-[8px] border px-3.5 text-[15px]"
                    style={{
                      backgroundColor: "var(--bg-base)",
                      borderColor: "var(--border-strong)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-[14px] font-medium">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="mt-1.5 min-h-[44px] w-full rounded-[8px] border px-3.5 text-[15px]"
                style={{
                  backgroundColor: "var(--bg-base)",
                  borderColor: "var(--border-strong)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[14px] font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="mt-1.5 min-h-[44px] w-full rounded-[8px] border px-3.5 text-[15px]"
                style={{
                  backgroundColor: "var(--bg-base)",
                  borderColor: "var(--border-strong)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {mode === "signup" && (
              <div>
                <label htmlFor="use_case" className="block text-[14px] font-medium">
                  Intended Use Case
                </label>
                <textarea
                  id="use_case"
                  required
                  rows={3}
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="Describe what you are building (e.g., due-diligence assistant, housing analytics, internal underwriting)."
                  className="mt-1.5 w-full rounded-[8px] border px-3.5 py-2.5 text-[15px]"
                  style={{
                    backgroundColor: "var(--bg-base)",
                    borderColor: "var(--border-strong)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[8px] text-[15px] font-semibold disabled:opacity-60"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-on-accent)",
              }}
            >
              <LockKey size={18} weight="bold" />
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Submitting request..."
                : mode === "login"
                  ? "Sign In"
                  : "Submit Access Request"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
