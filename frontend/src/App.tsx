import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  TOKEN_STORAGE_KEY,
  fetchTop10Leaderboard,
  parseJwtUserId,
} from "./api";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { InviteRedirect } from "./components/InviteRedirect";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
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
  const loggedIn = currentUserId !== null;

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
    <div className="app-shell" id="top">
      <SiteHeader loggedIn={loggedIn} />

      <Routes>
        <Route
          path="/"
          element={
            <InviteRedirect>
              <HomePage
                entries={entries}
                currentUserId={currentUserId}
                loading={loading}
                error={error}
                onRefresh={() => void loadLeaderboard()}
              />
            </InviteRedirect>
          }
        />
        <Route
          path="/login"
          element={
            <LoginPage
              loggedIn={loggedIn}
              onLoginSuccess={handleLoginSuccess}
              onUserCreated={() => void loadLeaderboard()}
            />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              token={token}
              onChanged={() => void loadLeaderboard()}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SiteFooter />
    </div>
  );
}
