import { useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { parseJwtRole, parseJwtUserId } from "../api";
import { ProfileEditor } from "../components/ProfileEditor";
import { UserManagementPanel } from "../components/UserManagementPanel";

interface ProfilePageProps {
  token: string | null;
  onChanged: () => void;
  onLogout: () => void;
}

export function ProfilePage({ token, onChanged, onLogout }: ProfilePageProps) {
  const navigate = useNavigate();
  const userId = token ? parseJwtUserId(token) : null;
  const wasLoggedIn = useRef(userId !== null);

  if (!token || !userId) {
    // A logged-out visitor who lands here directly is sent to /login.
    // After logout, onLogout() has already cleared the token and
    // handleLogout() navigates home, so we must not redirect to /login here.
    return wasLoggedIn.current ? null : <Navigate to="/login" replace />;
  }

  const isAdmin = parseJwtRole(token) === "Admin";

  function handleLogout() {
    onLogout();
    navigate("/");
  }

  return (
    <main className="container page-stack">
      <h1 className="page-title">Your profile</h1>
      <div className="account-stack">
        <ProfileEditor
          userId={userId}
          token={token}
          onUpdated={onChanged}
          onLogout={handleLogout}
        />
        {isAdmin && (
          <UserManagementPanel
            token={token}
            onChanged={onChanged}
            onLogout={handleLogout}
          />
        )}
      </div>
    </main>
  );
}
