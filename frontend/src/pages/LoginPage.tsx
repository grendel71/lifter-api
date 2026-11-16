import { Navigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { isInviteTokenUsable } from "../invite";

interface LoginPageProps {
  loggedIn: boolean;
  onLoginSuccess: (token: string) => void;
  onUserCreated: () => void;
}

export function LoginPage({ loggedIn, onLoginSuccess, onUserCreated }: LoginPageProps) {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  if (loggedIn) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <main className="container page-stack">
      <h1 className="page-title">
        {isInviteTokenUsable(inviteToken) ? "Create your account" : "Log in"}
      </h1>
      <div className="account-stack">
        <AuthCard
          key={inviteToken ?? ""}
          inviteToken={inviteToken}
          onLoginSuccess={onLoginSuccess}
          onUserCreated={onUserCreated}
        />
      </div>
    </main>
  );
}
