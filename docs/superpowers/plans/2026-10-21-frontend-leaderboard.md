# Frontend Leaderboard & User Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + TypeScript + Vite single-page frontend in `frontend/` showing the Top 10 powerlifting leaderboard, user login/registration, and profile/lift update fields without modifying the FastAPI backend.

**Architecture:** The React SPA communicates with the untouched FastAPI backend via same-origin `/api/*` requests. In local development, Vite proxies `/api` to `http://127.0.0.1:8000`; in Docker, an Nginx container serves the built SPA and reverse-proxies `/api/` to `http://api:8000/api/`. The client aggregates `/api/v1/users` and per-user `/api/v1/users/{id}/performance` calls in parallel, sorts by `total` descending, and slices the top 10.

**Tech Stack:** Nix Flakes (`nodejs_22`), React 19, TypeScript 5, Vite 6, Vitest, React Testing Library, Docker + Nginx.

---

### Task 1: Add Node.js Dependencies to Nix Flake & Update `.gitignore`

**Files:**
- Modify: `flake.nix:13-17`
- Modify: `.gitignore`

- [ ] **Step 1: Add `nodejs_22` to `flake.nix`**

Update `flake.nix` so that `nodejs_22` (which provides `node`, `npm`, and `npx`) is included in `devShell.packages`:

```nix
{
	inputs = {
		nixpkgs.url = "github:nixos/nixpkgs/release-26.05";
		flake-utils.url = "github:numtide/flake-utils";
	};

	outputs = { self, nixpkgs, flake-utils }:
		flake-utils.lib.eachDefaultSystem (system:
			let pkgs = import nixpkgs {
				inherit system;
			}; in {
				devShell = pkgs.mkShell {
					packages = with pkgs; [
						python313
						uv
						gcc.cc.lib
						nodejs_22
					];
					shellHook = ''
						export UV_PYTHON="$(command -v python3.13)"
						export LD_LIBRARY_PATH="${pkgs.gcc.cc.lib}/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
					'';
				};
			}
		);
}
```

- [ ] **Step 2: Ignore frontend build and dependency artifacts in `.gitignore`**

Append `frontend/node_modules/` and `frontend/dist/` to `.gitignore`:

```gitignore
.venv/
__pycache__/
*.py[cod]
.env
.direnv/
.opencode/
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 3: Verify `node` and `npm` work via `nix develop`**

Run: `nix develop --command bash -c "node --version && npm --version"`
Expected: Outputs Node v22.x.x and npm 10.x.x (or newer).

---

### Task 2: Scaffold `frontend/` Vite + React + TypeScript + Vitest Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/test-setup.ts`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "leaderboard-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "typescript": "~5.7.2",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts` with `/api` proxy and Vitest setup**

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
```

- [ ] **Step 4: Create `frontend/index.html` and `frontend/src/test-setup.ts`**

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Powerlifting Leaderboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `frontend/src/test-setup.ts`:

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Install npm dependencies in `frontend/`**

Run: `nix develop --command bash -c "cd frontend && npm install"`
Expected: `added ... packages` and `frontend/package-lock.json` created with 0 errors.

---

### Task 3: API Types, JWT Parser, and Top 10 Leaderboard Aggregator (TDD)

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Test: `frontend/src/api.test.ts`

- [ ] **Step 1: Create `frontend/src/types.ts`**

```typescript
export interface UserPublic {
  id: string;
  name: string;
}

export interface LifterResponse {
  lifter_id: string;
  squat: number;
  bench: number;
  deadlift: number;
  total: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  squat: number;
  bench: number;
  deadlift: number;
  total: number;
}

export interface CreateUserPayload {
  name: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UpdateUserPayload {
  name?: string;
  squat?: number;
  bench?: number;
  deadlift?: number;
}
```

- [ ] **Step 2: Write the failing unit tests in `frontend/src/api.test.ts`**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildTop10,
  parseJwtUserId,
  fetchTop10Leaderboard,
} from "./api";
import type { LeaderboardEntry } from "./types";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.signature`;
}

describe("parseJwtUserId", () => {
  it("extracts sub UUID when token is valid and not expired", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: futureExp,
    });
    expect(parseJwtUserId(token)).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("returns null when token is expired", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: pastExp,
    });
    expect(parseJwtUserId(token)).toBeNull();
  });

  it("returns null for malformed token", () => {
    expect(parseJwtUserId("not-a-jwt")).toBeNull();
  });
});

describe("buildTop10", () => {
  it("sorts descending by total, breaks ties by name, and limits to 10 items", () => {
    const entries: LeaderboardEntry[] = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${i + 1}`,
      name: `Lifter ${String(i + 1).padStart(2, "0")}`,
      squat: (i + 1) * 10,
      bench: (i + 1) * 10,
      deadlift: (i + 1) * 10,
      total: (i + 1) * 30,
    }));

    const top10 = buildTop10(entries);
    expect(top10).toHaveLength(10);
    expect(top10[0].id).toBe("id-12");
    expect(top10[0].total).toBe(360);
    expect(top10[9].id).toBe("id-3");
    expect(top10[9].total).toBe(90);
  });

  it("breaks ties alphabetically by name", () => {
    const entries: LeaderboardEntry[] = [
      { id: "1", name: "Zack", squat: 100, bench: 100, deadlift: 100, total: 300 },
      { id: "2", name: "Alice", squat: 100, bench: 100, deadlift: 100, total: 300 },
    ];
    const top10 = buildTop10(entries);
    expect(top10.map((e) => e.name)).toEqual(["Alice", "Zack"]);
  });
});

describe("fetchTop10Leaderboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches users and their performance in parallel and returns sorted top 10", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/users") {
        return new Response(
          JSON.stringify([
            { id: "u1", name: "Weak Lifter" },
            { id: "u2", name: "Strong Lifter" },
          ]),
          { status: 200 }
        );
      }
      if (url === "/api/v1/users/u1/performance") {
        return new Response(
          JSON.stringify({ lifter_id: "u1", squat: 100, bench: 80, deadlift: 120, total: 300 }),
          { status: 200 }
        );
      }
      if (url === "/api/v1/users/u2/performance") {
        return new Response(
          JSON.stringify({ lifter_id: "u2", squat: 250, bench: 180, deadlift: 300, total: 730 }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await fetchTop10Leaderboard();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual([
      { id: "u2", name: "Strong Lifter", squat: 250, bench: 180, deadlift: 300, total: 730 },
      { id: "u1", name: "Weak Lifter", squat: 100, bench: 80, deadlift: 120, total: 300 },
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `nix develop --command bash -c "cd frontend && npm test"`
Expected: FAIL because `./api` does not exist yet.

- [ ] **Step 4: Implement `frontend/src/api.ts`**

```typescript
import type {
  CreateUserPayload,
  LeaderboardEntry,
  LifterResponse,
  LoginPayload,
  LoginResponse,
  UpdateUserPayload,
  UserPublic,
} from "./types";

export const TOKEN_STORAGE_KEY = "leaderboard_jwt";

export function parseJwtUserId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { sub?: string; exp?: number };
    if (!payload.sub || typeof payload.sub !== "string") return null;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

export function buildTop10(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // ignore JSON parse error
  }
  return fallback;
}

export async function fetchUser(userId: string): Promise<UserPublic> {
  const res = await fetch(`/api/v1/users/${userId}`);
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to load user"));
  }
  return (await res.json()) as UserPublic;
}

export async function fetchUserPerformance(userId: string): Promise<LifterResponse> {
  const res = await fetch(`/api/v1/users/${userId}/performance`);
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to load performance"));
  }
  return (await res.json()) as LifterResponse;
}

export async function fetchTop10Leaderboard(): Promise<LeaderboardEntry[]> {
  const usersRes = await fetch("/api/v1/users");
  if (!usersRes.ok) {
    throw new Error(await parseErrorDetail(usersRes, "Failed to fetch users"));
  }
  const users = (await usersRes.json()) as UserPublic[];

  const entries = await Promise.all(
    users.map(async (user): Promise<LeaderboardEntry> => {
      try {
        const perf = await fetchUserPerformance(user.id);
        return {
          id: user.id,
          name: user.name,
          squat: perf.squat,
          bench: perf.bench,
          deadlift: perf.deadlift,
          total: perf.total ?? perf.squat + perf.bench + perf.deadlift,
        };
      } catch {
        return {
          id: user.id,
          name: user.name,
          squat: 0,
          bench: 0,
          deadlift: 0,
          total: 0,
        };
      }
    })
  );

  return buildTop10(entries);
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch("/api/v1/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Login failed"));
  }
  return (await res.json()) as LoginResponse;
}

export async function registerUser(payload: CreateUserPayload): Promise<{ user_id: string }> {
  const res = await fetch("/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Registration failed"));
  }
  return (await res.json()) as { user_id: string };
}

export class UnauthorizedError extends Error {
  constructor(message = "Invalid or expired token") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function updateUserPerformance(
  userId: string,
  token: string,
  payload: UpdateUserPayload
): Promise<void> {
  const res = await fetch(`/api/v1/users/${userId}/updatePerformance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    throw new UnauthorizedError(await parseErrorDetail(res, "Invalid or expired token"));
  }
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to update performance"));
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `nix develop --command bash -c "cd frontend && npm test"`
Expected: PASS (`3 passed` test suites in `src/api.test.ts`).

---

### Task 4: Build UI Components (`LeaderboardTable`, `AuthCard`, `ProfileEditor`) and `App` (TDD)

**Files:**
- Create: `frontend/src/components/LeaderboardTable.tsx`
- Create: `frontend/src/components/AuthCard.tsx`
- Create: `frontend/src/components/ProfileEditor.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing component integration tests in `frontend/src/App.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

function makeFakeJwt(sub: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = btoa(JSON.stringify({ sub, exp }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}

describe("App integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders Top 10 leaderboard and allows user login and updating fields", async () => {
    const userId = "123e4567-e89b-12d3-a456-426614174000";
    let userPerf = {
      lifter_id: userId,
      squat: 200,
      bench: 140,
      deadlift: 240,
      total: 580,
    };
    let userName = "Alex";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/v1/users" && method === "GET") {
        return new Response(JSON.stringify([{ id: userId, name: userName }]), {
          status: 200,
        });
      }
      if (url === `/api/v1/users/${userId}` && method === "GET") {
        return new Response(JSON.stringify({ id: userId, name: userName }), {
          status: 200,
        });
      }
      if (url === `/api/v1/users/${userId}/performance` && method === "GET") {
        return new Response(JSON.stringify(userPerf), { status: 200 });
      }
      if (url === "/api/v1/login" && method === "POST") {
        return new Response(
          JSON.stringify({
            access_token: makeFakeJwt(userId),
            token_type: "bearer",
          }),
          { status: 200 }
        );
      }
      if (url === `/api/v1/users/${userId}/updatePerformance` && method === "PUT") {
        const body = JSON.parse(String(init?.body)) as {
          name: string;
          squat: number;
          bench: number;
          deadlift: number;
        };
        userName = body.name;
        userPerf = {
          lifter_id: userId,
          squat: body.squat,
          bench: body.bench,
          deadlift: body.deadlift,
          total: body.squat + body.bench + body.deadlift,
        };
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });

    const user = userEvent.setup();
    render(<App />);

    // Leaderboard loads Alex with total 580
    expect(await screen.findByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("580")).toBeInTheDocument();

    // Log in via Login form
    await user.type(screen.getByLabelText(/username/i), "alex99");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Update form appears with pre-filled values
    const nameInput = await screen.findByLabelText(/display name/i);
    expect(nameInput).toHaveValue("Alex");

    const squatInput = screen.getByLabelText(/squat/i);
    await user.clear(squatInput);
    await user.type(squatInput, "220");

    await user.clear(nameInput);
    await user.type(nameInput, "Alex Pro");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    // Leaderboard updates with new name and total (220 + 140 + 240 = 600)
    await waitFor(() => {
      expect(screen.getByText("Alex Pro")).toBeInTheDocument();
      expect(screen.getByText("600")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nix develop --command bash -c "cd frontend && npm test"`
Expected: FAIL because `./App` does not exist yet.

- [ ] **Step 3: Create `frontend/src/components/LeaderboardTable.tsx`**

```tsx
import type { LeaderboardEntry } from "../types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function LeaderboardTable({
  entries,
  currentUserId,
  loading,
  error,
  onRefresh,
}: LeaderboardTableProps) {
  return (
    <section className="card leaderboard-card">
      <div className="card-header">
        <div>
          <h2>Top 10 Lifters</h2>
          <p className="subtitle">Ranked by combined Squat, Bench, and Deadlift total</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <p className="empty-state">Loading leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No lifters registered yet. Sign up to claim #1!</p>
      ) : (
        <div className="table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Lifter</th>
                <th className="num">Squat</th>
                <th className="num">Bench</th>
                <th className="num">Deadlift</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isCurrentUser = currentUserId === entry.id;
                return (
                  <tr key={entry.id} className={isCurrentUser ? "row-current-user" : undefined}>
                    <td className="rank-cell">#{idx + 1}</td>
                    <td>
                      <span className="lifter-name">{entry.name}</span>
                      {isCurrentUser && <span className="badge-you">You</span>}
                    </td>
                    <td className="num">{entry.squat}</td>
                    <td className="num">{entry.bench}</td>
                    <td className="num">{entry.deadlift}</td>
                    <td className="num total-cell">{entry.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/AuthCard.tsx`**

```tsx
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
```

- [ ] **Step 5: Create `frontend/src/components/ProfileEditor.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from "react";
import {
  UnauthorizedError,
  fetchUser,
  fetchUserPerformance,
  updateUserPerformance,
} from "../api";

interface ProfileEditorProps {
  userId: string;
  token: string;
  onUpdated: () => void;
  onLogout: () => void;
}

export function ProfileEditor({
  userId,
  token,
  onUpdated,
  onLogout,
}: ProfileEditorProps) {
  const [name, setName] = useState("");
  const [squat, setSquat] = useState("0");
  const [bench, setBench] = useState("0");
  const [deadlift, setDeadlift] = useState("0");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingProfile(true);
      setError(null);
      try {
        const [user, perf] = await Promise.all([
          fetchUser(userId),
          fetchUserPerformance(userId),
        ]);
        if (!cancelled) {
          setName(user.name);
          setSquat(String(perf.squat));
          setBench(String(perf.bench));
          setDeadlift(String(perf.deadlift));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Display name cannot be empty.");
      return;
    }

    const parsedSquat = Number(squat);
    const parsedBench = Number(bench);
    const parsedDeadlift = Number(deadlift);

    for (const [label, val] of [
      ["Squat", parsedSquat],
      ["Bench", parsedBench],
      ["Deadlift", parsedDeadlift],
    ] as const) {
      if (!Number.isInteger(val) || val < 0 || val >= 10000) {
        setError(`${label} must be a whole number between 0 and 9999.`);
        return;
      }
    }

    setSaving(true);
    try {
      await updateUserPerformance(userId, token, {
        name: trimmedName,
        squat: parsedSquat,
        bench: parsedBench,
        deadlift: parsedDeadlift,
      });
      setSuccessMsg("Profile and lifts updated!");
      onUpdated();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card profile-card">
      <div className="card-header">
        <div>
          <h2>Update Your Lifts</h2>
          <p className="subtitle">Edit your display name and personal records</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </div>

      {loadingProfile ? (
        <p className="empty-state">Loading your profile...</p>
      ) : (
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="field">
            <label htmlFor="profile-name">Display Name</label>
            <input
              id="profile-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="lifts-grid">
            <div className="field">
              <label htmlFor="profile-squat">Squat</label>
              <input
                id="profile-squat"
                type="number"
                min={0}
                max={9999}
                step={1}
                required
                value={squat}
                onChange={(e) => setSquat(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-bench">Bench</label>
              <input
                id="profile-bench"
                type="number"
                min={0}
                max={9999}
                step={1}
                required
                value={bench}
                onChange={(e) => setBench(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-deadlift">Deadlift</label>
              <input
                id="profile-deadlift"
                type="number"
                min={0}
                max={9999}
                step={1}
                required
                value={deadlift}
                onChange={(e) => setDeadlift(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success" role="status">
              {successMsg}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Create `frontend/src/App.tsx`, `frontend/src/main.tsx`, and `frontend/src/index.css`**

Create `frontend/src/App.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  TOKEN_STORAGE_KEY,
  fetchTop10Leaderboard,
  parseJwtUserId,
} from "./api";
import { AuthCard } from "./components/AuthCard";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { ProfileEditor } from "./components/ProfileEditor";
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
            <ProfileEditor
              userId={currentUserId}
              token={token}
              onUpdated={() => void loadLeaderboard()}
              onLogout={handleLogout}
            />
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
```

Create `frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `frontend/src/index.css`:

```css
:root {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #0f172a;
  background-color: #f8fafc;
  line-height: 1.5;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.25rem;
}

.app-header {
  background: #0f172a;
  color: #f8fafc;
  padding: 1.5rem 0;
  margin-bottom: 2rem;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.app-header p {
  margin: 0.25rem 0 0;
  color: #94a3b8;
  font-size: 0.925rem;
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 1.5rem;
  align-items: start;
  padding-bottom: 3rem;
}

@media (max-width: 840px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.card-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: #64748b;
}

.table-wrapper {
  overflow-x: auto;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.leaderboard-table th,
.leaderboard-table td {
  padding: 0.75rem 0.65rem;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
}

.leaderboard-table th {
  font-weight: 600;
  color: #475569;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.leaderboard-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rank-cell {
  font-weight: 700;
  color: #334155;
  width: 3.5rem;
}

.total-cell {
  font-weight: 700;
  color: #0f172a;
}

.row-current-user {
  background-color: #eff6ff;
}

.badge-you {
  margin-left: 0.5rem;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  vertical-align: middle;
}

.tab-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  background: #f1f5f9;
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 0.5rem;
  font-weight: 600;
  color: #475569;
  border-radius: 0.375rem;
  cursor: pointer;
}

.tab-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lifts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.field input {
  padding: 0.55rem 0.7rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.45rem;
  font-size: 0.95rem;
}

.field input:focus {
  outline: 2px solid #2563eb;
  border-color: transparent;
}

.btn {
  padding: 0.6rem 1rem;
  border-radius: 0.45rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}

.alert {
  padding: 0.65rem 0.85rem;
  border-radius: 0.45rem;
  font-size: 0.875rem;
}

.alert-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.alert-success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 2rem 0;
}
```

- [ ] **Step 7: Run tests and production build to verify everything passes**

Run: `nix develop --command bash -c "cd frontend && npm test && npm run build"`
Expected: All unit & integration tests pass (`src/api.test.ts` and `src/App.test.tsx`), and `vite build` succeeds with zero TypeScript or bundler errors.

---

### Task 5: Add Frontend Docker & Nginx Reverse Proxy Configuration

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Create `frontend/Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Add `frontend` service to `docker-compose.yml`**

Update `docker-compose.yml` to add the `frontend` service on port `3000:80`:

```yaml
services:
  db:
    image: postgres:15
    container_name: postgres_db
    environment:
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: ${PG_DB_NAME}
    ports:
      - "${PG_PORT}:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PG_USER} -d ${PG_DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      PG_USER: ${PG_USER}
      PG_PASSWORD: ${PG_PASSWORD}
      PG_DB_NAME: ${PG_DB_NAME}
      PG_HOST: db
      PG_PORT: "5432"
      PRIVKEY: ${PRIVKEY}
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      api:
        condition: service_healthy

volumes:
  db_data:
```

- [ ] **Step 4: Validate `docker compose config`**

Run: `docker compose config -q`
Expected: Exits with code 0 (valid Compose configuration).
