import { Navigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";

interface LoginPageProps {
  loggedIn: boolean;
  onLoginSuccess: (token: string) => void;
  onUserCreated: () => void;
}

export function LoginPage({ loggedIn, onLoginSuccess, onUserCreated }: LoginPageProps) {
  if (loggedIn) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <main className="container page-stack">
      <h1 className="page-title">Log in or sign up</h1>
      <div className="account-stack">
        <AuthCard onLoginSuccess={onLoginSuccess} onUserCreated={onUserCreated} />
      </div>
    </main>
  );
}
