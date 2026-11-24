import {
  Code,
  Key,
  List,
  ShieldCheck,
  SignOut,
  X,
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import type { User } from "../lib/api";
import { ReaaLogo } from "./ReaaLogo";
import { StatusBadge } from "./StatusBadge";

export type NavSection = "keys" | "integration" | "admin";

interface AppShellProps {
  user: User;
  activeNav: NavSection;
  pendingCount: number;
  onSelectNav: (nav: NavSection) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  activeNav,
  pendingCount,
  onSelectNav,
  onLogout,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: typeof Key;
    badge?: number;
    adminOnly?: boolean;
  }> = [
    { id: "keys", label: "Overview & Keys", icon: Key },
    { id: "integration", label: "SDK Integration", icon: Code },
    {
      id: "admin",
      label: "Admin Control",
      icon: ShieldCheck,
      badge: pendingCount > 0 ? pendingCount : undefined,
      adminOnly: true,
    },
  ];

  function handleNav(id: NavSection) {
    onSelectNav(id);
    setDrawerOpen(false);
  }

  const railContent = (
    <div className="flex h-full flex-col">
      <div
        className="flex h-16 items-center justify-between border-b px-5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <ReaaLogo size={30} variant="light" />
          <span className="text-[15px] font-bold tracking-tight">REAA API</span>
        </div>
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setDrawerOpen(false)}
          className="flex h-10 w-10 items-center justify-center rounded-[6px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Primary navigation">
        {navItems
          .filter((item) => !item.adminOnly || user.role === "admin")
          .map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-[8px] px-3 text-[15px] font-medium"
                style={{
                  backgroundColor: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={18} weight={active ? "bold" : "regular"} />
                  {item.label}
                </span>
                {item.badge !== undefined && (
                  <span
                    className="font-mono-num rounded-[6px] px-2 py-0.5 text-[12px] font-semibold"
                    style={{ backgroundColor: "var(--accent)", color: "var(--text-on-accent)" }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </nav>

      <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[14px] font-semibold">{user.full_name}</p>
            {user.role === "admin" && (
              <span
                className="font-mono-num rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold uppercase"
                style={{ backgroundColor: "var(--bg-ink)", color: "var(--text-on-ink)" }}
              >
                Admin
              </span>
            )}
          </div>
          <p className="truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {user.company}
          </p>
          <div className="mt-2">
            <StatusBadge status={user.status} />
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[8px] border text-[14px] font-medium"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-base)",
            color: "var(--text-secondary)",
          }}
        >
          <SignOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex" style={{ backgroundColor: "var(--bg-base)" }}>
      <aside
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[240px] lg:border-r"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        {railContent}
      </aside>

      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 lg:hidden"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <ReaaLogo size={28} variant="light" />
          <span className="text-[15px] font-bold">REAA API</span>
        </div>
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={() => setDrawerOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-[8px] border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <List size={20} />
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="w-[260px] border-r shadow-xl"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            {railContent}
          </div>
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            className="flex-1"
            style={{ backgroundColor: "oklch(17.5% 0.012 75 / 0.45)" }}
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      <main className="flex-1 lg:pl-[240px]">
        <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
