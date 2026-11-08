# Login and Profile Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Log In" button in the top bar that opens a separate `/login` page (same browser tab). After login the user lands on `/profile`, where they adjust their lifts. When logged in, the top bar button becomes a "Profile" link.

**Approved design:**

| URL | Shows | Access |
|---|---|---|
| `/` | Hero, Top 10 leaderboard, About | Everyone |
| `/login` | Login / sign-up card | Logged out. Logged-in users are redirected to `/profile`. |
| `/profile` | Lifts form. Admin also sees User Management. | Logged in. Logged-out users are redirected to `/login`. |
| anything else | Redirect to `/` | Everyone |

- Top bar logged out: brand, `Rankings`, `About`, **Log In** (link styled as a button, to `/login`).
- Top bar logged in: same, but **Profile** (to `/profile`).
- After login or sign-up: go to `/profile`. Log Out (button already on the profile card) clears the token and goes to `/`.
- The old "Account" anchor link and the account form on the home page are removed.
- No backend change.

**Architecture:** `App.tsx` keeps the token state and leaderboard loading, and only defines routes. Three thin page components compose the existing `LeaderboardTable`, `AuthCard`, `ProfileEditor` and `UserManagementPanel`, which keep their logic. `main.tsx` provides `BrowserRouter`. Tests use `MemoryRouter`.

**Tech Stack:** React 19, `react-router-dom` 7 (new), Vite 6, Vitest 3, Testing Library.

---

## Constraints from existing tests (DO NOT BREAK)

1. Show each lifter name and each total only ONCE per page. `getByText("Alex")` and `getByText("580")` fail on duplicates.
2. Only ONE element may match each label: `/username/i`, `/password/i`, `/display name/i`, `/squat/i`. Add no `aria-label` with those words.
3. Only ONE button may match `/sign in/i` and `/save changes/i`. The header "Log In" is a **link** (role `link`), not a button, and its text does not match `/sign in/i`.
4. No other element may have the exact text `User Management`.
5. `UserManagementPanel.test.tsx` and `api.test.ts` must stay unedited. `App.test.tsx` and the `SiteHeader` tests in `layout.test.tsx` MUST change (Task 2), because the login form no longer lives on `/`.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/package.json`, `package-lock.json` | Modify | Add `react-router-dom` |
| `frontend/src/main.tsx` | Modify | Wrap `App` in `BrowserRouter` |
| `frontend/src/components/SiteHeader.tsx` | Rewrite | Router links, Log In / Profile |
| `frontend/src/pages/HomePage.tsx` | Create | Hero + leaderboard + about, scroll to `#about` |
| `frontend/src/pages/LoginPage.tsx` | Create | Auth card, redirect if logged in |
| `frontend/src/pages/ProfilePage.tsx` | Create | Profile editor + admin panel, guard, logout to `/` |
| `frontend/src/App.tsx` | Rewrite | State, routes, header and footer |
| `frontend/src/App.test.tsx` | Rewrite | Same scenarios, through `/login` and `/profile` |
| `frontend/src/routing.test.tsx` | Create | Guards, redirects, header switch, logout |
| `frontend/src/components/layout.test.tsx` | Modify | New `SiteHeader` tests |
| `frontend/src/styles/layout.css` | Modify | Header button, active link, page title |

All commands run from the repo root through the nix shell (node is NOT on PATH):

```bash
cd /home/blau/Projects/apps/leaderboard-api
nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b'
```
The warning "Git tree is dirty" is harmless.

---

### Task 0: Branch and baseline

- [ ] **Step 1:** `git status --short` must be empty. Then `git checkout -b feat/login-profile-pages` (from the current branch `feat/strengthlevel-ui`).
- [ ] **Step 2:** Run the command above. Expected: 29 tests PASS, no type errors. If red, STOP and report.

---

### Task 1: Install the router

**Files:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/main.tsx`

- [ ] **Step 1: Install**

```bash
nix develop --command bash -c 'cd frontend && npm install react-router-dom@^7'
```
Expected: `package.json` gets `"react-router-dom": "^7.x.x"` under `dependencies`. The lockfile changes. (The Docker image uses `npm ci`, so the lockfile must be committed.)

- [ ] **Step 2: Replace `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 3: Verify.** Run the baseline command and `npx vite build` (same nix pattern). Expected: 29 PASS, build OK.
- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/main.tsx
git commit -m "build(frontend): add react-router-dom"
```

---

### Task 2: Header, pages and routes (TDD)

Do the steps IN ORDER. Write the tests first and see them fail. Make ONE commit at the end.

**Files:** see the file structure table (everything except `package*.json`, `main.tsx` and `layout.css`).

- [ ] **Step 1: Replace the `SiteHeader` tests in `frontend/src/components/layout.test.tsx`.**

Add to the imports at the top: `import { MemoryRouter } from "react-router-dom";`

Replace the whole `describe("SiteHeader", ...)` block with:

```tsx
function renderHeader(loggedIn: boolean) {
  return render(
    <MemoryRouter>
      <SiteHeader loggedIn={loggedIn} />
    </MemoryRouter>
  );
}

describe("SiteHeader", () => {
  it("renders the primary nav with Rankings and About links", () => {
    renderHeader(false);

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rankings" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/#about");
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
  });

  it("shows a Log In link to /login when logged out", () => {
    renderHeader(false);

    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("shows a Profile link to /profile when logged in", () => {
    renderHeader(true);

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: "Log In" })).not.toBeInTheDocument();
  });

  it("renders no buttons (keeps sign-in button unique on the page)", () => {
    renderHeader(false);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Replace `frontend/src/App.test.tsx` completely** (same scenarios, now through the Log In link and `/profile`):

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

function makeFakeJwt(sub: string, role?: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload: Record<string, unknown> = { sub, exp };
  if (role) {
    payload.role = role;
  }
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

type TestUser = ReturnType<typeof userEvent.setup>;

async function loginViaHeader(user: TestUser, username: string) {
  await user.click(screen.getByRole("link", { name: "Log In" }));
  await user.type(screen.getByLabelText(/username/i), username);
  await user.type(screen.getByLabelText(/password/i), "secret123");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("App integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders Top 10 leaderboard and allows login via the header and updating lifts on the profile page", async () => {
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
    renderApp("/");

    // Leaderboard loads Alex with total 580
    expect(await screen.findByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("580")).toBeInTheDocument();

    // Log in through the header button -> login page -> profile page
    await loginViaHeader(user, "alex99");

    // Profile page shows the form with pre-filled values
    const nameInput = await screen.findByLabelText(/display name/i);
    expect(nameInput).toHaveValue("Alex");

    const squatInput = screen.getByLabelText(/squat/i);
    await user.clear(squatInput);
    await user.type(squatInput, "220");

    await user.clear(nameInput);
    await user.type(nameInput, "Alex Pro");

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Profile and lifts updated!")).toBeInTheDocument();

    // Back on the home page the leaderboard shows the new name and total (220 + 140 + 240 = 600)
    await user.click(screen.getByRole("link", { name: "Rankings" }));
    await waitFor(() => {
      expect(screen.getByText("Alex Pro")).toBeInTheDocument();
      expect(screen.getByText("600")).toBeInTheDocument();
    });
  });
});

describe("Admin visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function mockLoginAndUsers(
    loginRole: string | undefined,
    userId: string,
    userName: string
  ) {
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
        return new Response(
          JSON.stringify({
            lifter_id: userId,
            squat: 100,
            bench: 100,
            deadlift: 100,
            total: 300,
          }),
          { status: 200 }
        );
      }
      if (url === "/api/v1/login" && method === "POST") {
        return new Response(
          JSON.stringify({
            access_token: makeFakeJwt(userId, loginRole),
            token_type: "bearer",
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });
  }

  it("shows the User Management panel on the profile page after an Admin-role login", async () => {
    const userId = "223e4567-e89b-12d3-a456-426614174000";
    mockLoginAndUsers("Admin", userId, "Admin User");

    const user = userEvent.setup();
    renderApp("/");

    await screen.findByText("Admin User");
    await loginViaHeader(user, "adminuser");

    expect(await screen.findByText("User Management")).toBeInTheDocument();
  });

  it("does not show the User Management panel after a normal-role login", async () => {
    const userId = "323e4567-e89b-12d3-a456-426614174000";
    mockLoginAndUsers(undefined, userId, "Regular User");

    const user = userEvent.setup();
    renderApp("/");

    await screen.findByText("Regular User");
    await loginViaHeader(user, "regularuser");

    await screen.findByLabelText(/display name/i);
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Create `frontend/src/routing.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { TOKEN_STORAGE_KEY } from "./api";

const USER_ID = "423e4567-e89b-12d3-a456-426614174000";

function makeFakeJwt(sub: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = btoa(JSON.stringify({ sub, exp }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}

function mockApi() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/v1/users" && method === "GET") {
      return new Response(JSON.stringify([{ id: USER_ID, name: "Casey" }]), {
        status: 200,
      });
    }
    if (url === `/api/v1/users/${USER_ID}` && method === "GET") {
      return new Response(JSON.stringify({ id: USER_ID, name: "Casey" }), {
        status: 200,
      });
    }
    if (url === `/api/v1/users/${USER_ID}/performance` && method === "GET") {
      return new Response(
        JSON.stringify({
          lifter_id: USER_ID,
          squat: 100,
          bench: 100,
          deadlift: 100,
          total: 300,
        }),
        { status: 200 }
      );
    }
    return new Response("Not found", { status: 404 });
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

function loginAsCasey() {
  localStorage.setItem(TOKEN_STORAGE_KEY, makeFakeJwt(USER_ID));
}

describe("routing", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockApi();
  });

  it("shows a Log In link and no Profile link when logged out", async () => {
    renderAt("/");

    expect(await screen.findByText("Casey")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("redirects /profile to the login page when logged out", async () => {
    renderAt("/profile");

    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
  });

  it("redirects /login to the profile page when logged in, and shows a Profile link", async () => {
    loginAsCasey();
    renderAt("/login");

    expect(await screen.findByLabelText(/display name/i)).toHaveValue("Casey");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(screen.queryByRole("link", { name: "Log In" })).not.toBeInTheDocument();
  });

  it("Log Out clears the token and returns to the home page", async () => {
    loginAsCasey();
    const user = userEvent.setup();
    renderAt("/profile");

    await screen.findByLabelText(/display name/i);
    await user.click(screen.getByRole("button", { name: "Log Out" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Powerlifting Leaderboard" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log In" })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("redirects unknown paths to the home page", async () => {
    renderAt("/does-not-exist");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Powerlifting Leaderboard" })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run to verify RED**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/components/layout.test.tsx src/App.test.tsx src/routing.test.tsx'`
Expected: FAIL (SiteHeader has no `loggedIn` prop and no router links; no routes exist).

- [ ] **Step 5: Rewrite `frontend/src/components/SiteHeader.tsx`**

```tsx
import { Link, NavLink } from "react-router-dom";

interface SiteHeaderProps {
  loggedIn: boolean;
}

export function SiteHeader({ loggedIn }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="site-brand" to="/">
          <span className="site-brand-mark" aria-hidden="true">
            ▲
          </span>
          <span>Leaderboard</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <NavLink to="/" end>
            Rankings
          </NavLink>
          <Link to="/#about">About</Link>
          {loggedIn ? (
            <Link className="site-nav-cta" to="/profile">
              Profile
            </Link>
          ) : (
            <Link className="site-nav-cta" to="/login">
              Log In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Create `frontend/src/pages/HomePage.tsx`**

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AboutSection } from "../components/AboutSection";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { PageHero } from "../components/PageHero";
import type { LeaderboardEntry } from "../types";

interface HomePageProps {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function HomePage({
  entries,
  currentUserId,
  loading,
  error,
  onRefresh,
}: HomePageProps) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ behavior: "smooth" });
  }, [hash]);

  return (
    <>
      <PageHero />
      <main className="container page-stack">
        <LeaderboardTable
          entries={entries}
          currentUserId={currentUserId}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
        />
        <AboutSection />
      </main>
    </>
  );
}
```

- [ ] **Step 7: Create `frontend/src/pages/LoginPage.tsx`**

```tsx
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
```

- [ ] **Step 8: Create `frontend/src/pages/ProfilePage.tsx`**

```tsx
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

  if (!token || !userId) {
    return <Navigate to="/login" replace />;
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
```

- [ ] **Step 9: Rewrite `frontend/src/App.tsx`** (state and loading logic stay the same; only imports and the `return` change)

```tsx
import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  TOKEN_STORAGE_KEY,
  fetchTop10Leaderboard,
  parseJwtUserId,
} from "./api";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
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
            <HomePage
              entries={entries}
              currentUserId={currentUserId}
              loading={loading}
              error={error}
              onRefresh={() => void loadLeaderboard()}
            />
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
```

- [ ] **Step 10: Run to verify GREEN**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b'`
Expected: ALL tests PASS (`UserManagementPanel.test.tsx` and `api.test.ts` untouched), no type errors. If a test says "multiple elements", re-read the Constraints section.

- [ ] **Step 11: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): separate login and profile pages with router"
```

---

### Task 3: Styles for the header button and page title

**Files:** Modify `frontend/src/styles/layout.css` (append only)

- [ ] **Step 1: Append to the end of `frontend/src/styles/layout.css`**

```css

/* ---------- Header: active link, Log In / Profile button ---------- */
.site-nav a.active {
  color: var(--nav-text);
}

.site-nav a.site-nav-cta {
  margin-left: 0.5rem;
  background: var(--accent);
  color: #ffffff;
  font-weight: 600;
}

.site-nav a.site-nav-cta:hover {
  background: var(--accent-dark);
  color: #ffffff;
}

/* ---------- Login / Profile page title ---------- */
.page-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
}
```

- [ ] **Step 2: Verify.** `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'`. Expected: PASS, build OK.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/layout.css
git commit -m "style: header Log In button and page title"
```

---

### Task 4: Final verification

- [ ] **Step 1:** Run tests, `tsc -b` and `vite build` (command above). Expected: all green.
- [ ] **Step 2:** `git diff feat/strengthlevel-ui --stat -- frontend/src/components/UserManagementPanel.test.tsx frontend/src/api.test.ts`. Expected: no output.
- [ ] **Step 3 (manual, see the test guide):**

| Check | Expected |
|---|---|
| `/` logged out | Top bar has a blue **Log In** button. No form on the page. |
| Click Log In | URL is `/login`. Login / Sign Up card. Page title above it. |
| Wrong password | Red error box. Stay on `/login`. |
| Log in | URL is `/profile`. Form is pre-filled. Top bar now shows **Profile**. |
| Save lifts, click Rankings | Leaderboard shows the new name and total, and the "You" badge. |
| Admin login | `/profile` also shows User Management. |
| Log Out | Back on `/`. Top bar shows **Log In** again. |
| Open `/profile` while logged out | Redirect to `/login`. |
| Open `/login` while logged in | Redirect to `/profile`. |
| Refresh on `/profile` | Stay on `/profile`, still logged in. |
| About link | Goes to `/` and scrolls to the About section. |
| Footer "Back to top" | Scrolls up on every page. |
| 375px wide | No sideways page scroll. Header fits (brand, Rankings, About, button). |

- [ ] **Step 4 (optional):** `docker build -t leaderboard-frontend-check frontend`. Expected: success (`npm ci` accepts the new lockfile).

---

## Self-review

- **Spec coverage:** Login button in top bar (Tasks 2, 3). Separate page (`/login`). Profile page after login with lifts editing (`/profile`). Profile link when logged in. Logout to `/`. Guards both ways. Admin panel kept (on `/profile`). Sign-up kept (Sign Up tab on `/login`).
- **Placeholders:** none.
- **Name consistency:** `loggedIn` prop (header, login page), `onChanged` (profile page; App passes `loadLeaderboard`), classes `site-nav-cta`, `page-title`, `account-stack` match between components and CSS.
- **Risks:** the "duplicate element" rule (Constraints). Router context: every test that renders `App` or `SiteHeader` needs `MemoryRouter` (done in Task 2).

## Out of scope

Password reset, remember-me, public profile of other users, API changes, a new browser tab or pop-up for login.
