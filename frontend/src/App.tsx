import { useCallback, useEffect, useState } from "react";
import {
  TOKEN_STORAGE_KEY,
  fetchTop10Leaderboard,
  parseJwtRole,
  parseJwtUserId,
} from "./api";
import { AuthCard } from "./components/AuthCard";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { ProfileEditor } from "./components/ProfileEditor";
import { UserManagementPanel } from "./components/UserManagementPanel";
import type { LeaderboardEntry } from "./types";

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!saved) return null;
    if (!parseJwtUserId(saved)) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return saved;
  });

  const currentUserId = token ? parseJwtUserId(token) : null;
  const currentUserRole = token ? parseJwtRole(token) : null;
  const isAdmin = currentUserRole === "Admin";

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const top10 = await fetchTop10Leaderboard();
      setEntries(top10);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  function handleLoginSuccess(newToken: string) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container">
          <h1>Powerlifting Leaderboard</h1>
          <p>Top 10 lifters by Squat, Bench, and Deadlift total</p>
        </div>
      </header>

      <main className="container main-grid">
        <LeaderboardTable
          entries={entries}
          currentUserId={currentUserId}
          loading={loading}
          error={error}
          onRefresh={() => void loadLeaderboard()}
        />

        <aside className="side-panel">
          {token && currentUserId ? (
            <>
              <ProfileEditor
                userId={currentUserId}
                token={token}
                onUpdated={() => void loadLeaderboard()}
                onLogout={handleLogout}
              />
              {isAdmin && (
                <UserManagementPanel
                  token={token}
                  onChanged={() => void loadLeaderboard()}
                  onLogout={handleLogout}
                />
              )}
            </>
          ) : (
            <AuthCard
              onLoginSuccess={handleLoginSuccess}
              onUserCreated={() => void loadLeaderboard()}
            />
          )}
        </aside>
      </main>
    </div>
  );
}
