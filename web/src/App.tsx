import { useCallback, useEffect, useState } from "react";
import { AppShell, type NavSection } from "./components/AppShell";
import { api, type User } from "./lib/api";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [maxKeys, setMaxKeys] = useState(3);
  const [gatewayOrigin, setGatewayOrigin] = useState(window.location.origin);
  const [checking, setChecking] = useState(true);
  const [activeNav, setActiveNav] = useState<NavSection>("keys");
  const [pendingCount, setPendingCount] = useState(0);

  const hydrate = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res.user);
      setMaxKeys(res.config.max_keys_per_user);
      setGatewayOrigin(res.config.gateway_origin);
      if (res.user?.role === "admin") {
        api
          .adminOverview()
          .then((ov) => setPendingCount(ov.users.pending))
          .catch(() => {});
      }
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    setActiveNav("keys");
  }

  if (checking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-[15px]"
        style={{ backgroundColor: "var(--bg-base)", color: "var(--text-secondary)" }}
      >
        Initializing workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuthenticated={(u) => {
          setUser(u);
          setActiveNav(u.role === "admin" ? "admin" : "keys");
          hydrate();
        }}
      />
    );
  }

  return (
    <AppShell
      user={user}
      activeNav={activeNav}
      pendingCount={pendingCount}
      onSelectNav={setActiveNav}
      onLogout={handleLogout}
    >
      {activeNav === "admin" && user.role === "admin" ? (
        <AdminPage onPendingCountChange={setPendingCount} />
      ) : (
        <DashboardPage
          user={user}
          maxKeys={maxKeys}
          gatewayOrigin={gatewayOrigin}
          section={activeNav === "integration" ? "integration" : "keys"}
        />
      )}
    </AppShell>
  );
}
