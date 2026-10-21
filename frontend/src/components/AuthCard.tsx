import { useState, type FormEvent } from "react";
import { loginUser, registerUser } from "../api";

interface AuthCardProps {
  onLoginSuccess: (token: string) => void;
  onUserCreated: () => void;
}

export function AuthCard({ onLoginSuccess, onUserCreated }: AuthCardProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "register") {
        await registerUser({
          name: name.trim(),
          username: username.trim(),
          password,
        });
        onUserCreated();
      }
      const res = await loginUser({
        username: username.trim(),
        password,
      });
      onLoginSuccess(res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card auth-card">
      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={`tab-btn ${mode === "login" ? "active" : ""}`}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Login
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={`tab-btn ${mode === "register" ? "active" : ""}`}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        {mode === "register" && (
          <div className="field">
            <label htmlFor="auth-name">Display Name</label>
            <input
              id="auth-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
          />
        </div>

        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? "Please wait..."
            : mode === "login"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>
    </section>
  );
}
