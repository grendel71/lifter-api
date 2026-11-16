# Invite Links UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontend use the backend invite tokens. Admins create invite links on the profile page. A new lifter opens `<frontend origin>/?invite=<token>`, sees the sign-up form, and registers with the token. Sign-up without a valid invite is not offered.

**Backend contract (already built, already tested):**
- `POST /api/v1/createInviteToken?duration=N` (N = 1 to 168 hours). Needs `Authorization: Bearer <admin login token>`. Returns `{ "invite_token": "<jwt>" }`. Errors: `401` bad login token, `403` not admin, `422` bad duration (`detail` is a LIST of `{msg}` objects).
- `POST /api/v1/users` body: `{ name, username, password, invite_token }`. Errors: `400` malformed token, `401` expired, `403` wrong type or signature, `409` username taken, `422` missing field. `detail` is a string, except for `422`.
- The invite JWT has claims `sub`, `type: "invite"`, `exp`, `jti`. Login JWTs have `type: "login"`.
- Invite links are multi-use until they expire (the backend does not check `jti`).

**Approved design:**
1. Link format: `window.location.origin + "/?invite=" + token`, built in the browser.
2. `/?invite=<token>` redirects (replace) to `/login?invite=<token>`. The token stays in the URL.
3. Login card: valid invite -> tabs Login / Sign Up, Sign Up selected first. No invite -> login form only, with the note "Accounts are created from an invite link. Ask an admin for one." Invalid or expired invite -> red message "This invite link is not valid or has expired. Ask an admin for a new one." and login form only. A logged-in user goes to `/profile`, as now.
4. The frontend checks `type === "invite"` and `exp` only. The server checks the signature.
5. `/profile`, admins only: new card **Invite Links** (hours field, Create button, read-only link field, Copy button). It shows the latest link only.

**Architecture:** Pure helpers in `src/invite.ts`. API calls in `src/api.ts`. One new redirect component (`InviteRedirect`) and one new card component (`InviteLinkPanel`). `AuthCard` gets an `inviteToken` prop. No new dependency, no backend change.

**Tech Stack:** React 19, react-router-dom 7, Vitest 3, Testing Library (user-event 14).

---

## Constraints from existing tests (DO NOT BREAK)

1. `App.test.tsx`, `UserManagementPanel.test.tsx`, `LeaderboardTable.test.tsx`: do not edit. `api.test.ts` and `routing.test.tsx`: append only (add tests and helpers; change no existing test; the import block in `api.test.ts` may be extended).
2. After login, only ONE element may match each label: `/username/i`, `/password/i`, `/display name/i`, `/squat/i`. Only ONE button may match `/sign in/i` and `/save changes/i`. The exact text `User Management` appears once. Lifter names and totals appear once.
3. The login flow without an invite must work as before: the Log In link, then `/login`, then the form with Username, Password and the Sign In button. `App.test.tsx` depends on this.
4. jsdom has no media queries, so tests see the desktop DOM.
5. Labels used by the new code must not match the words in rule 2. Use "Valid for (hours)" and "Invite link".

## File structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/types.ts` | Modify | `invite_token` on `CreateUserPayload`; `InviteTokenResponse` |
| `frontend/src/api.ts` | Modify | `parseJwtType`, array-aware `parseErrorDetail`, `createInviteToken` |
| `frontend/src/invite.ts` | Create | `buildInviteUrl`, `isInviteTokenUsable`, hour limits |
| `frontend/src/invite.test.ts` | Create | Tests for `invite.ts` |
| `frontend/src/api.test.ts` | Modify (append) | Tests for the new API code |
| `frontend/src/components/InviteRedirect.tsx` | Create | `/?invite=` -> `/login?invite=` |
| `frontend/src/components/AuthCard.tsx` | Modify | `inviteToken` prop, tabs only with a valid invite |
| `frontend/src/components/AuthCard.test.tsx` | Create | Tests for `AuthCard` |
| `frontend/src/pages/LoginPage.tsx` | Modify | Read `?invite=`, pass to `AuthCard`, title |
| `frontend/src/App.tsx` | Modify | Wrap the `/` route in `InviteRedirect` |
| `frontend/src/routing.test.tsx` | Modify (append) | Invite routing tests |
| `frontend/src/components/InviteLinkPanel.tsx` | Create | Admin card |
| `frontend/src/components/InviteLinkPanel.test.tsx` | Create | Tests for the card |
| `frontend/src/pages/ProfilePage.tsx` | Modify | Show the card to admins |
| `frontend/src/pages/ProfilePage.test.tsx` | Create | Admin sees the card, normal user does not |
| `frontend/src/styles/components.css` | Modify | Auth note, invite card styles |
| `frontend/src/components/AboutSection.tsx`, `PageHero.tsx`, `LeaderboardTable.tsx` | Modify | Text no longer says "sign up" |

All node commands run through the nix shell (node is NOT on PATH):

```bash
cd /home/blau/Projects/apps/leaderboard-api
nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b'
```
The warning "Git tree is dirty" is harmless. Use a timeout of 120000 ms or more.

---

### Task 0: Branch, commit the backend, baseline

- [ ] **Step 1:** Check the state. `git branch --show-current` must print `main`. `git status --short` must list ONLY these five files: `docker-compose.yml`, `src/api/leaderboard/config.py`, `src/api/leaderboard/requestclass.py`, `src/api/leaderboard/users.py`, `src/api/main.py`. If other files appear, STOP and report.
- [ ] **Step 2:** Make the branch: `git checkout -b feat/invite-links`
- [ ] **Step 3:** Commit the backend work on its own:

```bash
git add docker-compose.yml src/api/leaderboard/config.py src/api/leaderboard/requestclass.py src/api/leaderboard/users.py src/api/main.py
git commit -m "feat(api): invite tokens for user creation"
git add docs/superpowers/plans/2026-11-15-invite-links-ui.md
git commit -m "docs: add invite links UI plan"
```
(`.env` is in `.gitignore`. Do not add it.)

- [ ] **Step 4:** Baseline. Run the verify command. Expected: 39 tests PASS, tsc clean. If red, STOP.

---

### Task 1: Invite helpers and API client (TDD)

This task does NOT change `CreateUserPayload` (Task 2 does, together with `AuthCard`).

**Files:** `types.ts`, `api.ts`, `invite.ts`, `invite.test.ts`, `api.test.ts`

- [ ] **Step 1: Create `frontend/src/invite.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildInviteUrl, isInviteTokenUsable } from "./invite";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.signature`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 60;

describe("buildInviteUrl", () => {
  it("builds /?invite=<token> from the given origin", () => {
    expect(buildInviteUrl("aaa.bbb.ccc", "https://lifters.example.com")).toBe(
      "https://lifters.example.com/?invite=aaa.bbb.ccc"
    );
  });

  it("uses the current window origin by default", () => {
    expect(buildInviteUrl("tok")).toBe(`${window.location.origin}/?invite=tok`);
  });

  it("drops any path and query of the origin value", () => {
    expect(buildInviteUrl("tok", "https://example.com/profile?x=1")).toBe(
      "https://example.com/?invite=tok"
    );
  });
});

describe("isInviteTokenUsable", () => {
  it("is true for a token of type invite that has not expired", () => {
    expect(isInviteTokenUsable(makeFakeJwt({ sub: "a", type: "invite", exp: future() }))).toBe(true);
  });

  it("is false for a login token", () => {
    expect(isInviteTokenUsable(makeFakeJwt({ sub: "a", type: "login", exp: future() }))).toBe(false);
  });

  it("is false for an expired invite token", () => {
    expect(isInviteTokenUsable(makeFakeJwt({ sub: "a", type: "invite", exp: past() }))).toBe(false);
  });

  it("is false for a malformed token", () => {
    expect(isInviteTokenUsable("garbage")).toBe(false);
  });

  it("is false when there is no token", () => {
    expect(isInviteTokenUsable(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Append tests to `frontend/src/api.test.ts`.**

Extend the import block at the top so it also imports `createInviteToken` and `parseJwtType` (keep every existing name):

```ts
import {
  UnauthorizedError,
  buildTop10,
  createInviteToken,
  deleteUser,
  fetchTop10Leaderboard,
  fetchUsersWithPerformance,
  parseJwtRole,
  parseJwtType,
  parseJwtUserId,
} from "./api";
```

Append at the END of the file:

```ts
describe("parseJwtType", () => {
  it("returns the type claim of a valid token", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(parseJwtType(makeFakeJwt({ sub: "u", exp, type: "invite" }))).toBe("invite");
  });

  it("returns null when the type claim is missing", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(parseJwtType(makeFakeJwt({ sub: "u", exp }))).toBeNull();
  });

  it("returns null when the token is expired", () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    expect(parseJwtType(makeFakeJwt({ sub: "u", exp, type: "invite" }))).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(parseJwtType("not-a-jwt")).toBeNull();
  });
});

describe("createInviteToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs the duration with the Authorization header and returns the invite token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ invite_token: "inv-123" }), { status: 200 }));

    await expect(createInviteToken("admin-token", 48)).resolves.toBe("inv-123");

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/createInviteToken?duration=48", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    });
  });

  it("throws UnauthorizedError on a 401 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid or expired token" }), { status: 401 })
    );

    await expect(createInviteToken("bad", 24)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws the first validation message on a 422 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ detail: [{ msg: "Input should be less than or equal to 168" }] }),
        { status: 422 }
      )
    );

    await expect(createInviteToken("t", 500)).rejects.toThrow(
      "Input should be less than or equal to 168"
    );
  });
});
```

- [ ] **Step 3: Run to verify RED**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/invite.test.ts src/api.test.ts'`
Expected: FAIL (`./invite` cannot be resolved; `parseJwtType` and `createInviteToken` are not exported).

- [ ] **Step 4: Edit `frontend/src/types.ts`.** Append at the END of the file:

```ts

export interface InviteTokenResponse {
  invite_token: string;
}
```

- [ ] **Step 5: Edit `frontend/src/api.ts`.**

5a. In the type import block at the top, add `InviteTokenResponse,` after `LeaderboardEntry,` (keep alphabetical order: `CreateUserPayload, InviteTokenResponse, LeaderboardEntry, ...`).

5b. In `interface DecodedJwt`, add the line `  type?: string;` after `role?: string;`.

5c. After the `parseJwtRole` function, add:

```ts
export function parseJwtType(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.type !== "string" || payload.type.length === 0) {
    return null;
  }
  return payload.type;
}
```

5d. Replace the whole `parseErrorDetail` function with:

```ts
async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: unknown } | undefined;
      if (first && typeof first.msg === "string") return first.msg;
    }
  } catch {
    // ignore JSON parse error
  }
  return fallback;
}
```

5e. Append at the END of the file:

```ts

export async function createInviteToken(
  token: string,
  durationHours: number
): Promise<string> {
  const res = await fetch(`/api/v1/createInviteToken?duration=${durationHours}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    throw new UnauthorizedError(await parseErrorDetail(res, "Invalid or expired token"));
  }
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to create invite link"));
  }
  const body = (await res.json()) as InviteTokenResponse;
  return body.invite_token;
}
```

- [ ] **Step 6: Create `frontend/src/invite.ts`**

```ts
import { parseJwtType } from "./api";

// Must match MAX_INVITE_HOURS in the backend .env.
export const INVITE_MAX_HOURS = 168;
export const INVITE_DEFAULT_HOURS = 24;

// The link points at the root of the frontend that the admin is using now.
export function buildInviteUrl(
  inviteToken: string,
  origin: string = window.location.origin
): string {
  const url = new URL("/", origin);
  url.searchParams.set("invite", inviteToken);
  return url.toString();
}

// Client-side check only: type and expiry. The server checks the signature.
export function isInviteTokenUsable(inviteToken: string | null): boolean {
  if (!inviteToken) return false;
  return parseJwtType(inviteToken) === "invite";
}
```

- [ ] **Step 7: Run to verify GREEN**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'`
Expected: all PASS (54 tests: 39 + 8 in `invite.test.ts` + 7 new in `api.test.ts`), tsc clean, build OK.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/api.test.ts frontend/src/invite.ts frontend/src/invite.test.ts
git commit -m "feat(frontend): invite token API client and helpers"
```

---

### Task 2: Sign-up with an invite link (TDD)

**Files:** `types.ts`, `api.test.ts`, `AuthCard.tsx`, `AuthCard.test.tsx`, `LoginPage.tsx`, `InviteRedirect.tsx`, `App.tsx`, `routing.test.tsx`, `components.css`

- [ ] **Step 1: Create `frontend/src/components/AuthCard.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthCard } from "./AuthCard";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.signature`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const validInvite = () => makeFakeJwt({ sub: "admin", type: "invite", exp: future() });
const INVALID_MESSAGE = "This invite link is not valid or has expired. Ask an admin for a new one.";

function renderCard(inviteToken: string | null) {
  const onLoginSuccess = vi.fn();
  const onUserCreated = vi.fn();
  render(
    <AuthCard
      inviteToken={inviteToken}
      onLoginSuccess={onLoginSuccess}
      onUserCreated={onUserCreated}
    />
  );
  return { onLoginSuccess, onUserCreated };
}

describe("AuthCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows only the login form and an invite-only note when there is no invite", () => {
    renderCard(null);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign Up" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
    expect(screen.getByText(/created from an invite link/i)).toBeInTheDocument();
  });

  it("shows an error and no Sign Up tab for a malformed invite", () => {
    renderCard("garbage");

    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign Up" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("shows an error for an expired invite", () => {
    const expired = makeFakeJwt({
      sub: "admin",
      type: "invite",
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    renderCard(expired);

    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign Up" })).not.toBeInTheDocument();
  });

  it("shows an error when the token is a login token, not an invite", () => {
    renderCard(makeFakeJwt({ sub: "u", type: "login", exp: future() }));

    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign Up" })).not.toBeInTheDocument();
  });

  it("opens the Sign Up tab first when the invite is valid", () => {
    renderCard(validInvite());

    expect(screen.getByRole("tab", { name: "Sign Up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("lets the user switch to the Login tab", async () => {
    const user = userEvent.setup();
    renderCard(validInvite());

    await user.click(screen.getByRole("tab", { name: "Login" }));

    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("registers with the invite token, then logs in", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/v1/users" && init?.method === "POST") {
        return new Response(JSON.stringify({ user_id: "u1" }), { status: 201 });
      }
      if (url === "/api/v1/login" && init?.method === "POST") {
        return new Response(
          JSON.stringify({ access_token: "login-token", token_type: "bearer" }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const invite = validInvite();
    const user = userEvent.setup();
    const { onLoginSuccess, onUserCreated } = renderCard(invite);

    await user.type(screen.getByLabelText(/display name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/username/i), "jane");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith("login-token"));
    expect(onUserCreated).toHaveBeenCalledTimes(1);

    const registerCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/v1/users");
    expect(JSON.parse(String(registerCall?.[1]?.body))).toEqual({
      name: "Jane Doe",
      username: "jane",
      password: "secret123",
      invite_token: invite,
    });
  });

  it("shows the server message when the invite is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invite link has expired" }), { status: 401 })
    );

    const user = userEvent.setup();
    const { onLoginSuccess } = renderCard(validInvite());

    await user.type(screen.getByLabelText(/display name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/username/i), "jane");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByText("Invite link has expired")).toBeInTheDocument();
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Append a `registerUser` test to `frontend/src/api.test.ts`.**

Add `registerUser` to the import block at the top (keep every other name). Append at the END of the file:

```ts
describe("registerUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the invite token in the request body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ user_id: "u1" }), { status: 201 }));
    const payload = { name: "Ann", username: "ann", password: "pw", invite_token: "tok" };

    await expect(registerUser(payload)).resolves.toEqual({ user_id: "u1" });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("throws a plain Error with the server message when the invite is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invite link has expired" }), { status: 401 })
    );

    await expect(
      registerUser({ name: "Ann", username: "ann", password: "pw", invite_token: "tok" })
    ).rejects.toThrow("Invite link has expired");
  });
});
```

- [ ] **Step 3: Append routing tests to `frontend/src/routing.test.tsx`.**

Append at the END of the file (it already imports `describe, expect, it, vi, beforeEach`, `render, screen`, `MemoryRouter`, `App`, `TOKEN_STORAGE_KEY` and defines `mockApi`, `renderAt`, `loginAsCasey`):

```tsx
function makeInviteJwt(): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = btoa(JSON.stringify({ sub: "admin-id", type: "invite", exp }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}

describe("invite links", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockApi();
  });

  it("sends /?invite=<token> to the login page with the sign-up form open", async () => {
    renderAt(`/?invite=${makeInviteJwt()}`);

    expect(await screen.findByLabelText(/display name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Create your account" })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign Up" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows login only, with an invite-only note, when there is no invite", async () => {
    renderAt("/login");

    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign Up" })).not.toBeInTheDocument();
    expect(screen.getByText(/created from an invite link/i)).toBeInTheDocument();
  });

  it("shows an error for an invite link that is not valid", async () => {
    renderAt("/?invite=garbage");

    expect(
      await screen.findByText(
        "This invite link is not valid or has expired. Ask an admin for a new one."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sign Up" })).not.toBeInTheDocument();
  });

  it("sends a logged-in user who opens an invite link to the profile page", async () => {
    loginAsCasey();
    renderAt(`/?invite=${makeInviteJwt()}`);

    expect(await screen.findByLabelText(/display name/i)).toHaveValue("Casey");
  });
});
```

- [ ] **Step 4: Run to verify RED**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/components/AuthCard.test.tsx src/routing.test.tsx src/api.test.ts'`
Expected: FAIL (`AuthCard` has no `inviteToken` prop and always shows the tabs; no invite redirect; `registerUser` test fails type check only if run with tsc, so confirm the failures are in `AuthCard.test.tsx` and `routing.test.tsx`).

- [ ] **Step 5: Edit `frontend/src/types.ts`.** In `CreateUserPayload`, add `invite_token: string;` after `password: string;`:

```ts
export interface CreateUserPayload {
  name: string;
  username: string;
  password: string;
  invite_token: string;
}
```

- [ ] **Step 6: Rewrite `frontend/src/components/AuthCard.tsx`** with the full content below:

```tsx
import { useState, type FormEvent } from "react";
import { loginUser, registerUser } from "../api";
import { isInviteTokenUsable } from "../invite";

interface AuthCardProps {
  inviteToken: string | null;
  onLoginSuccess: (token: string) => void;
  onUserCreated: () => void;
}

export function AuthCard({ inviteToken, onLoginSuccess, onUserCreated }: AuthCardProps) {
  const inviteUsable = isInviteTokenUsable(inviteToken);
  const [mode, setMode] = useState<"login" | "register">(inviteUsable ? "register" : "login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Without a usable invite only login is possible.
  const activeMode = inviteUsable ? mode : "login";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (activeMode === "register") {
        await registerUser({
          name: name.trim(),
          username: username.trim(),
          password,
          invite_token: inviteToken ?? "",
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
      {inviteUsable ? (
        <div className="tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "login"}
            className={`tab-btn ${activeMode === "login" ? "active" : ""}`}
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
            aria-selected={activeMode === "register"}
            className={`tab-btn ${activeMode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Sign Up
          </button>
        </div>
      ) : inviteToken ? (
        <div className="alert alert-error" role="alert">
          This invite link is not valid or has expired. Ask an admin for a new one.
        </div>
      ) : (
        <p className="auth-note">
          Accounts are created from an invite link. Ask an admin for one.
        </p>
      )}

      <form onSubmit={handleSubmit} className="form-stack">
        {activeMode === "register" && (
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
            : activeMode === "login"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 7: Rewrite `frontend/src/pages/LoginPage.tsx`** with the full content below:

```tsx
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
```

- [ ] **Step 8: Create `frontend/src/components/InviteRedirect.tsx`**

```tsx
import type { ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

interface InviteRedirectProps {
  children: ReactNode;
}

// An invite link is <origin>/?invite=<token>. Send it to the login page and keep the token.
export function InviteRedirect({ children }: InviteRedirectProps) {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get("invite");

  if (invite) {
    const query = new URLSearchParams({ invite }).toString();
    return <Navigate to={`/login?${query}`} replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 9: Edit `frontend/src/App.tsx`.**

9a. Add this import after the `SiteHeader` import:

```tsx
import { InviteRedirect } from "./components/InviteRedirect";
```

9b. Replace the `/` route (the first `<Route ... />` inside `<Routes>`) with:

```tsx
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
```

- [ ] **Step 10: Append CSS to `frontend/src/styles/components.css`**

```css

/* ---------- Auth card: invite note ---------- */
.auth-note {
  margin: 0 0 1.25rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.auth-card > .alert {
  margin: 0 0 1.25rem;
}
```

- [ ] **Step 11: Run to verify GREEN**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'`
Expected: all PASS (68 tests: 54 + 2 `registerUser` + 8 `AuthCard` + 4 routing), tsc clean, build OK. `App.test.tsx` must pass unchanged. If it fails with "multiple elements", re-read Constraints.

- [ ] **Step 12: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): sign up through invite links"
```

---

### Task 3: Admin card to create invite links (TDD)

**Files:** `InviteLinkPanel.tsx`, `InviteLinkPanel.test.tsx`, `ProfilePage.tsx`, `ProfilePage.test.tsx`, `components.css`

- [ ] **Step 1: Create `frontend/src/components/InviteLinkPanel.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteLinkPanel } from "./InviteLinkPanel";

function mockCreate(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function setClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

const LINK = () => `${window.location.origin}/?invite=aaa.bbb.ccc`;

describe("InviteLinkPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the heading and a default of 24 hours", () => {
    render(<InviteLinkPanel token="admin-token" onLogout={() => {}} />);

    expect(screen.getByRole("heading", { level: 2, name: "Invite Links" })).toBeInTheDocument();
    expect(screen.getByLabelText("Valid for (hours)")).toHaveValue(24);
  });

  it("creates a link from the current origin and shows it", async () => {
    const fetchMock = mockCreate(200, { invite_token: "aaa.bbb.ccc" });
    const user = userEvent.setup();
    render(<InviteLinkPanel token="admin-token" onLogout={() => {}} />);

    const hours = screen.getByLabelText("Valid for (hours)");
    await user.clear(hours);
    await user.type(hours, "48");
    await user.click(screen.getByRole("button", { name: "Create invite link" }));

    expect(await screen.findByLabelText("Invite link")).toHaveValue(LINK());
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/createInviteToken?duration=48", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    });
    expect(screen.getByText(/Valid for 48 hours/)).toBeInTheDocument();
  });

  it("blocks hours outside 1 to 168 and does not call the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    render(<InviteLinkPanel token="admin-token" onLogout={() => {}} />);

    const hours = screen.getByLabelText("Valid for (hours)");
    await user.clear(hours);
    await user.type(hours, "0");
    await user.click(screen.getByRole("button", { name: "Create invite link" }));
    expect(
      await screen.findByText("Hours must be a whole number between 1 and 168.")
    ).toBeInTheDocument();

    await user.clear(hours);
    await user.type(hours, "169");
    await user.click(screen.getByRole("button", { name: "Create invite link" }));
    expect(
      screen.getByText("Hours must be a whole number between 1 and 168.")
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs the admin out on a 401 response", async () => {
    mockCreate(401, { detail: "Invalid or expired token" });
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(<InviteLinkPanel token="old-token" onLogout={onLogout} />);

    await user.click(screen.getByRole("button", { name: "Create invite link" }));

    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
  });

  it("shows the server message on another error", async () => {
    mockCreate(422, { detail: [{ msg: "Input should be less than or equal to 168" }] });
    const user = userEvent.setup();
    render(<InviteLinkPanel token="admin-token" onLogout={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Create invite link" }));

    expect(
      await screen.findByText("Input should be less than or equal to 168")
    ).toBeInTheDocument();
  });

  it("copies the link to the clipboard", async () => {
    mockCreate(200, { invite_token: "aaa.bbb.ccc" });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<InviteLinkPanel token="admin-token" onLogout={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Create invite link" }));
    await screen.findByLabelText("Invite link");
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(LINK());
    expect(await screen.findByText("Link copied.")).toBeInTheDocument();
  });

  it("tells the user to copy by hand when the clipboard fails", async () => {
    mockCreate(200, { invite_token: "aaa.bbb.ccc" });
    const user = userEvent.setup();
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<InviteLinkPanel token="admin-token" onLogout={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Create invite link" }));
    await screen.findByLabelText("Invite link");
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByText("Could not copy. Select the link and copy it by hand.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Create `frontend/src/pages/ProfilePage.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfilePage } from "./ProfilePage";

const USER_ID = "523e4567-e89b-12d3-a456-426614174000";

function makeFakeJwt(role?: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload: Record<string, unknown> = { sub: USER_ID, exp, type: "login" };
  if (role) payload.role = role;
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}

function renderProfile(token: string) {
  return render(
    <MemoryRouter>
      <ProfilePage token={token} onChanged={() => {}} onLogout={() => {}} />
    </MemoryRouter>
  );
}

describe("ProfilePage invite card", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/users") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url === `/api/v1/users/${USER_ID}`) {
        return new Response(JSON.stringify({ id: USER_ID, name: "Pat" }), { status: 200 });
      }
      if (url === `/api/v1/users/${USER_ID}/performance`) {
        return new Response(
          JSON.stringify({ lifter_id: USER_ID, squat: 1, bench: 1, deadlift: 1, total: 3 }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });
  });

  it("shows the Invite Links card to an admin", async () => {
    renderProfile(makeFakeJwt("Admin"));

    expect(
      await screen.findByRole("heading", { level: 2, name: "Invite Links" })
    ).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
  });

  it("does not show the Invite Links card to a normal user", async () => {
    renderProfile(makeFakeJwt());

    await screen.findByLabelText(/display name/i);
    expect(screen.queryByRole("heading", { name: "Invite Links" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify RED**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/components/InviteLinkPanel.test.tsx src/pages/ProfilePage.test.tsx'`
Expected: FAIL (`./InviteLinkPanel` cannot be resolved; no Invite Links card).

- [ ] **Step 4: Create `frontend/src/components/InviteLinkPanel.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { UnauthorizedError, createInviteToken } from "../api";
import { INVITE_DEFAULT_HOURS, INVITE_MAX_HOURS, buildInviteUrl } from "../invite";

interface InviteLinkPanelProps {
  token: string;
  onLogout: () => void;
}

interface CreatedLink {
  url: string;
  hours: number;
}

interface CopyResult {
  ok: boolean;
  text: string;
}

export function InviteLinkPanel({ token, onLogout }: InviteLinkPanelProps) {
  const [hours, setHours] = useState(String(INVITE_DEFAULT_HOURS));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<CreatedLink | null>(null);
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCopyResult(null);

    const parsed = Number(hours);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > INVITE_MAX_HOURS) {
      setError(`Hours must be a whole number between 1 and ${INVITE_MAX_HOURS}.`);
      return;
    }

    setCreating(true);
    try {
      const inviteToken = await createInviteToken(token, parsed);
      setLink({ url: buildInviteUrl(inviteToken), hours: parsed });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to create invite link");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopyResult({ ok: true, text: "Link copied." });
    } catch {
      setCopyResult({
        ok: false,
        text: "Could not copy. Select the link and copy it by hand.",
      });
    }
  }

  return (
    <section className="card invite-card">
      <div className="card-header">
        <div>
          <h2>Invite Links</h2>
          <p className="subtitle">Create a link that lets a new lifter sign up</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        <div className="field">
          <label htmlFor="invite-hours">Valid for (hours)</label>
          <input
            id="invite-hours"
            type="number"
            min={1}
            max={INVITE_MAX_HOURS}
            step={1}
            required
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Creating..." : "Create invite link"}
        </button>
      </form>

      {link && (
        <div className="invite-result">
          <label htmlFor="invite-url">Invite link</label>
          <div className="invite-link-row">
            <input
              id="invite-url"
              type="text"
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void handleCopy()}>
              Copy
            </button>
          </div>
          <p className="subtitle">
            Valid for {link.hours} {link.hours === 1 ? "hour" : "hours"}. Anyone with this link
            can create an account until it expires.
          </p>
          {copyResult && (
            <div
              className={`alert ${copyResult.ok ? "alert-success" : "alert-error"}`}
              role="status"
            >
              {copyResult.text}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Edit `frontend/src/pages/ProfilePage.tsx`.**

5a. Add the import after the `ProfileEditor` import:

```tsx
import { InviteLinkPanel } from "../components/InviteLinkPanel";
```

5b. Inside `<div className="account-stack">`, replace the block `{isAdmin && ( <UserManagementPanel ... /> )}` with:

```tsx
        {isAdmin && <InviteLinkPanel token={token} onLogout={handleLogout} />}
        {isAdmin && (
          <UserManagementPanel
            token={token}
            onChanged={onChanged}
            onLogout={handleLogout}
          />
        )}
```

- [ ] **Step 6: Append CSS to `frontend/src/styles/components.css`**

```css

/* ---------- Invite link card ---------- */
.invite-result {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invite-result > label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
}

.invite-result .subtitle {
  margin: 0;
}

.invite-link-row {
  display: flex;
  gap: 0.5rem;
}

.invite-link-row input {
  flex: 1;
  min-width: 0;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font: inherit;
  font-size: 0.9rem;
  color: var(--ink);
  background: var(--surface);
}

@media (max-width: 768px) {
  .invite-link-row {
    flex-direction: column;
  }
}
```

- [ ] **Step 7: Run to verify GREEN**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'`
Expected: all PASS (77 tests: 68 + 7 `InviteLinkPanel` + 2 `ProfilePage`), tsc clean, build OK.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): admin invite link card"
```

---

### Task 4: Text updates

Pages must not tell people to "sign up" freely.

**Files:** `AboutSection.tsx`, `PageHero.tsx`, `LeaderboardTable.tsx`

- [ ] **Step 1: Edit `frontend/src/components/AboutSection.tsx`.** Replace the paragraph text of the "Your lifts" item (the `dd` that starts with "Create an account or log in") with:

```tsx
            Log in, then use the profile page to change your name and lifts. New
            accounts are created from an invite link sent by an admin. The table
            updates at once.
```

- [ ] **Step 2: Edit `frontend/src/components/PageHero.tsx`.** Replace `Sign in to add your own lifts.` with `Log in to update your own lifts.` (keep the rest of the sentence unchanged).

- [ ] **Step 3: Edit `frontend/src/components/LeaderboardTable.tsx`.** Replace `No lifters registered yet. Sign up to claim #1!` with `No lifters registered yet.`

- [ ] **Step 4: Verify.** Run: `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'`. Expected: 77 tests PASS, tsc clean, build OK. Run `grep -rniE "sign up|create an account" frontend/src --include=*.tsx` and expect only: the `Sign Up` tab in `AuthCard.tsx`, `AuthCard.test.tsx`, `routing.test.tsx`, and the heading text `Create your account` in `LoginPage.tsx`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AboutSection.tsx frontend/src/components/PageHero.tsx frontend/src/components/LeaderboardTable.tsx
git commit -m "feat(frontend): invite-only wording"
```

---

### Task 5: Final verification

- [ ] **Step 1:** Run tests, `tsc -b` and `vite build`. Expected: 77 tests PASS, tsc clean, build OK.
- [ ] **Step 2:** Protected files unchanged:
`git diff main --stat -- frontend/src/App.test.tsx frontend/src/components/UserManagementPanel.test.tsx frontend/src/components/LeaderboardTable.test.tsx` -> no output.
- [ ] **Step 3:** Backend still passes my checks. Run:
`nix develop --command bash -c 'PYTHONPATH=src .venv/bin/python -c "import api.main"'` -> no error.
- [ ] **Step 4:** Manual end-to-end test (a person does this, with a database running). See the table below.

**First admin (the app now needs an invite for every account).** If your database already has an admin, log in with it. If not, mint a first invite with the key, register with `curl`, and promote the user:

```bash
# 1. First invite token (1 hour):
nix develop --command bash -c 'PYTHONPATH=src .venv/bin/python -c "import uuid; from api.leaderboard.users import create_invite_token; print(create_invite_token(uuid.uuid4(), 1))"'
# 2. Register (replace TOKEN):
curl -s -X POST localhost:8000/api/v1/users -H 'Content-Type: application/json' \
  -d '{"name":"Admin","username":"admin","password":"secret123","invite_token":"TOKEN"}'
# 3. Promote:
docker exec -it postgres_db psql -U postgres -d backend -c "UPDATE users SET role='Admin' WHERE username='admin';"
```

| Check | Expected |
|---|---|
| Open `/login` with no invite | Login form only. Note: "Accounts are created from an invite link." No Sign Up tab. |
| Log in as admin, open `/profile` | The Invite Links card shows, above User Management. |
| Create a link with 24 hours | A link `http://<your host>/?invite=...` shows. Copy works. |
| Hours = 0 or 169 | Red message. No request is sent. |
| Open the link in a private window | You land on `/login?invite=...`. Title "Create your account". Sign Up tab is selected. |
| Register a new lifter | You are logged in and land on `/profile`. The lifter shows on the leaderboard. |
| Reuse the same link for a second lifter | Works (links are multi-use until they expire). |
| Edit the link (change one character of the token) | Red message: "This invite link is not valid or has expired" is NOT shown (the client cannot see a bad signature). Registration fails with the server message. |
| Open `/?invite=abc` | Red message: "This invite link is not valid or has expired. Ask an admin for a new one." |
| Open an invite link while logged in | You go to `/profile`. |
| Run on port 3000 (Docker) and 5173 (dev) | The created link uses the port you are on. |

---

## Self-review

- **Coverage:** link built from the current origin (Task 1, `buildInviteUrl`; Task 3, the card). `/?invite=` landing (Task 2, `InviteRedirect`). Sign-up uses the token (Task 2, `AuthCard`, `registerUser`). Admin creates tokens (Task 3). Backend work committed first (Task 0).
- **Placeholders:** none. Every step has the full code.
- **Name consistency:** `inviteToken` (prop and query value), `invite_token` (API body and response field), `isInviteTokenUsable`, `buildInviteUrl`, `INVITE_MAX_HOURS`, `createInviteToken` (frontend API function; the backend has a Python function with a similar name, which is unrelated).
- **Order:** `CreateUserPayload.invite_token` becomes required in Task 2 together with `AuthCard`, so every commit passes `tsc`.

## Risks

- The limit `INVITE_MAX_HOURS = 168` is fixed in `invite.ts`. If you change `MAX_INVITE_HOURS` in the backend `.env`, change it there too.
- Users who are logged in from before the backend change hold a token without `type`. The backend rejects it with `403` for up to 1 hour. They log out and in again. This plan adds no code for it.
- The client cannot check the token signature. A changed token looks valid in the browser and fails at the server with a server message.
- Links are multi-use until they expire. The card says so. A one-use link needs a backend change (store `jti`).

## Out of scope

One-use links, a list of past links, revoking a link, `iat` and the extra life check, the backend wording fix ("Invalid return type"), backend tests.
