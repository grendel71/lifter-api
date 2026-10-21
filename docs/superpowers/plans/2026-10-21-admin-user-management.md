# Admin User Management Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only "User Management" panel to the frontend that lets an Admin-role user view, edit, and delete any registered user, using the existing backend role checks.

**Architecture:** `api.ts` gains three functions (`parseJwtRole`, `fetchUsersWithPerformance`, `deleteUser`) and a small refactor so `fetchTop10Leaderboard` reuses the new fetch helper. A new `UserManagementPanel` component renders every user as an editable row with Edit/Delete actions and an inline confirm step for Delete. `App.tsx` decodes the token's role and renders the panel, alongside the existing "Update Your Lifts" form, only when the role is `"Admin"`.

**Tech Stack:** React 19, TypeScript 5, Vite 6, Vitest, React Testing Library (same stack already used in `frontend/`).

**Design spec:** `docs/superpowers/specs/2026-10-21-admin-user-management-design.md`

---

### Task 1: Role Parsing, Full User Fetch, and Delete in `api.ts`

**Files:**
- Modify: `frontend/src/api.test.ts`
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/api.test.ts` with:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  UnauthorizedError,
  buildTop10,
  deleteUser,
  fetchTop10Leaderboard,
  fetchUsersWithPerformance,
  parseJwtRole,
  parseJwtUserId,
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

describe("parseJwtRole", () => {
  it("extracts the role when the token is valid and not expired", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: futureExp,
      role: "Admin",
    });
    expect(parseJwtRole(token)).toBe("Admin");
  });

  it("returns null when the token has no role field", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: futureExp,
    });
    expect(parseJwtRole(token)).toBeNull();
  });

  it("returns null when the token is expired", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: pastExp,
      role: "Admin",
    });
    expect(parseJwtRole(token)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(parseJwtRole("not-a-jwt")).toBeNull();
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

describe("fetchUsersWithPerformance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches every user and does not sort or limit the result", async () => {
    const userList = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${i + 1}`,
      name: `Lifter ${String(i + 1).padStart(2, "0")}`,
    }));

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/users") {
        return new Response(JSON.stringify(userList), { status: 200 });
      }
      const match = url.match(/^\/api\/v1\/users\/(id-\d+)\/performance$/);
      if (match) {
        const index = Number(match[1].split("-")[1]);
        return new Response(
          JSON.stringify({
            lifter_id: match[1],
            squat: index,
            bench: index,
            deadlift: index,
            total: index * 3,
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await fetchUsersWithPerformance();
    expect(result).toHaveLength(12);
    expect(result.map((e) => e.id)).toEqual(userList.map((u) => u.id));
  });
});

describe("deleteUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a DELETE request with the Authorization header and resolves on success", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

    await expect(deleteUser("user-1", "token-abc")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/users/user-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer token-abc" },
    });
  });

  it("throws UnauthorizedError on a 401 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid or expired token" }), { status: 401 })
    );

    await expect(deleteUser("user-1", "bad-token")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws a plain Error carrying the server message on another failed response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "User not found" }), { status: 404 })
    );

    await expect(deleteUser("user-1", "token-abc")).rejects.toThrow("User not found");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop --command bash -c "cd frontend && npm test -- src/api.test.ts"`
Expected: FAIL. Vitest reports a TypeScript error because `api.ts` does not yet export `parseJwtRole`, `fetchUsersWithPerformance`, or `deleteUser`.

- [ ] **Step 3: Implement the new functions and refactor the existing fetch helper**

Replace the full contents of `frontend/src/api.ts` with:

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

interface DecodedJwt {
  sub?: string;
  exp?: number;
  role?: string;
}

function decodeJwtPayload(token: string): DecodedJwt | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as DecodedJwt;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function parseJwtUserId(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub || typeof payload.sub !== "string") return null;
  return payload.sub;
}

export function parseJwtRole(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.role !== "string" || payload.role.length === 0) {
    return null;
  }
  return payload.role;
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

export async function fetchUsersWithPerformance(): Promise<LeaderboardEntry[]> {
  const usersRes = await fetch("/api/v1/users");
  if (!usersRes.ok) {
    throw new Error(await parseErrorDetail(usersRes, "Failed to fetch users"));
  }
  const users = (await usersRes.json()) as UserPublic[];

  return Promise.all(
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
}

export async function fetchTop10Leaderboard(): Promise<LeaderboardEntry[]> {
  const entries = await fetchUsersWithPerformance();
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

export async function deleteUser(userId: string, token: string): Promise<void> {
  const res = await fetch(`/api/v1/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    throw new UnauthorizedError(await parseErrorDetail(res, "Invalid or expired token"));
  }
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to delete user"));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop --command bash -c "cd frontend && npm test -- src/api.test.ts"`
Expected: PASS (all describe blocks in `src/api.test.ts`, including the three pre-existing ones and the three new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.test.ts
git commit -m "feat: add parseJwtRole, fetchUsersWithPerformance, and deleteUser to api.ts"
```

---

### Task 2: Build the `UserManagementPanel` Component

**Files:**
- Create: `frontend/src/components/UserManagementPanel.test.tsx`
- Create: `frontend/src/components/UserManagementPanel.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/components/UserManagementPanel.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserManagementPanel } from "./UserManagementPanel";

function makeFakeJwt(sub: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = btoa(JSON.stringify({ sub, exp, role: "Admin" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}

const ADMIN_ID = "admin-0000-0000-0000-000000000000";
const ADMIN_TOKEN = makeFakeJwt(ADMIN_ID);

interface FakeUser {
  id: string;
  name: string;
  squat: number;
  bench: number;
  deadlift: number;
}

function mockApi(users: FakeUser[], extra?: (url: string, method: string) => Response | null) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (extra) {
      const handled = extra(url, method);
      if (handled) return handled;
    }

    if (url === "/api/v1/users" && method === "GET") {
      return new Response(
        JSON.stringify(users.map((u) => ({ id: u.id, name: u.name }))),
        { status: 200 }
      );
    }

    const perfMatch = url.match(/^\/api\/v1\/users\/(.+)\/performance$/);
    if (perfMatch && method === "GET") {
      const u = users.find((candidate) => candidate.id === perfMatch[1]);
      if (!u) return new Response("Not found", { status: 404 });
      return new Response(
        JSON.stringify({
          lifter_id: u.id,
          squat: u.squat,
          bench: u.bench,
          deadlift: u.deadlift,
          total: u.squat + u.bench + u.deadlift,
        }),
        { status: 200 }
      );
    }

    return new Response("Not found", { status: 404 });
  });
}

describe("UserManagementPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every user, even more than 10", async () => {
    const users: FakeUser[] = Array.from({ length: 12 }, (_, i) => ({
      id: `user-${i + 1}`,
      name: `Lifter ${String(i + 1).padStart(2, "0")}`,
      squat: 100,
      bench: 100,
      deadlift: 100,
    }));
    mockApi(users);

    render(<UserManagementPanel token={ADMIN_TOKEN} onChanged={() => {}} onLogout={() => {}} />);

    for (const u of users) {
      expect(await screen.findByText(u.name)).toBeInTheDocument();
    }
  });

  it("edits a user's name and lifts, then shows the updated row", async () => {
    const users: FakeUser[] = [
      { id: "user-1", name: "Alice", squat: 100, bench: 80, deadlift: 120 },
    ];
    mockApi(users, (url, method) => {
      if (url === "/api/v1/users/user-1/updatePerformance" && method === "PUT") {
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }
      return null;
    });

    const user = userEvent.setup();
    render(<UserManagementPanel token={ADMIN_TOKEN} onChanged={() => {}} onLogout={() => {}} />);

    await screen.findByText("Alice");
    await user.click(screen.getByRole("button", { name: "Edit Alice" }));

    const nameInput = screen.getByLabelText("Manage name");
    expect(nameInput).toHaveValue("Alice");

    const squatInput = screen.getByLabelText("Manage squat");
    await user.clear(squatInput);
    await user.type(squatInput, "150");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Manage name")).not.toBeInTheDocument();
  });

  it("shows the delete confirm step, then removes the row on Confirm", async () => {
    const users: FakeUser[] = [
      { id: "user-1", name: "Alice", squat: 100, bench: 80, deadlift: 120 },
      { id: "user-2", name: "Bob", squat: 90, bench: 70, deadlift: 110 },
    ];
    mockApi(users, (url, method) => {
      if (url === "/api/v1/users/user-2" && method === "DELETE") {
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }
      return null;
    });

    const user = userEvent.setup();
    render(<UserManagementPanel token={ADMIN_TOKEN} onChanged={() => {}} onLogout={() => {}} />);

    await screen.findByText("Bob");
    await user.click(screen.getByRole("button", { name: "Delete Bob" }));

    expect(await screen.findByText("Delete this user?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete this user?")).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Bob" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("blocks Save and shows an error when a lift value is invalid", async () => {
    const users: FakeUser[] = [
      { id: "user-1", name: "Alice", squat: 100, bench: 80, deadlift: 120 },
    ];
    const fetchMock = mockApi(users);

    const user = userEvent.setup();
    render(<UserManagementPanel token={ADMIN_TOKEN} onChanged={() => {}} onLogout={() => {}} />);

    await screen.findByText("Alice");
    await user.click(screen.getByRole("button", { name: "Edit Alice" }));

    const squatInput = screen.getByLabelText("Manage squat");
    await user.clear(squatInput);
    await user.type(squatInput, "-1");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Squat must be a whole number between 0 and 9999.")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/v1/users/user-1/updatePerformance",
      expect.anything()
    );
  });

  it("calls onLogout instead of onChanged when the admin deletes their own row", async () => {
    const users: FakeUser[] = [
      { id: ADMIN_ID, name: "Admin User", squat: 100, bench: 80, deadlift: 120 },
    ];
    mockApi(users, (url, method) => {
      if (url === `/api/v1/users/${ADMIN_ID}` && method === "DELETE") {
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }
      return null;
    });

    const onLogout = vi.fn();
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<UserManagementPanel token={ADMIN_TOKEN} onChanged={onChanged} onLogout={onLogout} />);

    await screen.findByText("Admin User");
    await user.click(screen.getByRole("button", { name: "Delete Admin User" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledTimes(1);
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop --command bash -c "cd frontend && npm test -- src/components/UserManagementPanel.test.tsx"`
Expected: FAIL. Vitest reports that `./UserManagementPanel` cannot be found, because the component file does not exist yet.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/UserManagementPanel.tsx`:

```tsx
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  UnauthorizedError,
  deleteUser,
  fetchUsersWithPerformance,
  parseJwtUserId,
  updateUserPerformance,
} from "../api";
import type { LeaderboardEntry } from "../types";

interface UserManagementPanelProps {
  token: string;
  onChanged: () => void;
  onLogout: () => void;
}

interface EditableFields {
  name: string;
  squat: string;
  bench: string;
  deadlift: string;
}

type RowMode = "editing" | "confirming-delete";

export function UserManagementPanel({
  token,
  onChanged,
  onLogout,
}: UserManagementPanelProps) {
  const [users, setUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<RowMode | null>(null);
  const [editFields, setEditFields] = useState<EditableFields>({
    name: "",
    squat: "0",
    bench: "0",
    deadlift: "0",
  });
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const currentUserId = parseJwtUserId(token);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const list = await fetchUsersWithPerformance();
      setUsers(list);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function startEdit(entry: LeaderboardEntry) {
    setActiveRowId(entry.id);
    setActiveMode("editing");
    setRowError(null);
    setEditFields({
      name: entry.name,
      squat: String(entry.squat),
      bench: String(entry.bench),
      deadlift: String(entry.deadlift),
    });
  }

  function startDeleteConfirm(entryId: string) {
    setActiveRowId(entryId);
    setActiveMode("confirming-delete");
    setRowError(null);
  }

  function cancelActiveRow() {
    setActiveRowId(null);
    setActiveMode(null);
    setRowError(null);
  }

  async function saveEdit(entryId: string) {
    const trimmedName = editFields.name.trim();
    if (!trimmedName) {
      setRowError("Display name cannot be empty.");
      return;
    }

    const parsedSquat = Number(editFields.squat);
    const parsedBench = Number(editFields.bench);
    const parsedDeadlift = Number(editFields.deadlift);

    for (const [label, val] of [
      ["Squat", parsedSquat],
      ["Bench", parsedBench],
      ["Deadlift", parsedDeadlift],
    ] as const) {
      if (!Number.isInteger(val) || val < 0 || val >= 10000) {
        setRowError(`${label} must be a whole number between 0 and 9999.`);
        return;
      }
    }

    setBusyRowId(entryId);
    setRowError(null);
    try {
      await updateUserPerformance(entryId, token, {
        name: trimmedName,
        squat: parsedSquat,
        bench: parsedBench,
        deadlift: parsedDeadlift,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === entryId
            ? {
                ...u,
                name: trimmedName,
                squat: parsedSquat,
                bench: parsedBench,
                deadlift: parsedDeadlift,
                total: parsedSquat + parsedBench + parsedDeadlift,
              }
            : u
        )
      );
      cancelActiveRow();
      onChanged();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      if (err instanceof Error && err.message === "User not found") {
        setUsers((prev) => prev.filter((u) => u.id !== entryId));
        cancelActiveRow();
        setListError("This user no longer exists.");
        return;
      }
      setRowError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyRowId(null);
    }
  }

  async function confirmDelete(entryId: string) {
    setBusyRowId(entryId);
    setRowError(null);
    try {
      await deleteUser(entryId, token);
      if (entryId === currentUserId) {
        onLogout();
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== entryId));
      cancelActiveRow();
      onChanged();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      if (err instanceof Error && err.message === "User not found") {
        setUsers((prev) => prev.filter((u) => u.id !== entryId));
        cancelActiveRow();
        setListError("This user no longer exists.");
        return;
      }
      setRowError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <section className="card user-management-card">
      <div className="card-header">
        <div>
          <h2>User Management</h2>
          <p className="subtitle">Edit or remove any registered user</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadUsers()}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {listError && (
        <div className="alert alert-error" role="alert">
          <span>{listError}</span>
        </div>
      )}

      {loading && users.length === 0 ? (
        <p className="empty-state">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="empty-state">No users found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Squat</th>
                <th className="num">Bench</th>
                <th className="num">Deadlift</th>
                <th className="num">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => {
                const isActive = activeRowId === entry.id;
                const mode = isActive ? activeMode : null;
                const isBusy = busyRowId === entry.id;

                return (
                  <Fragment key={entry.id}>
                    <tr>
                      {mode === "editing" ? (
                        <>
                          <td>
                            <input
                              aria-label="Manage name"
                              type="text"
                              value={editFields.name}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, name: e.target.value }))
                              }
                            />
                          </td>
                          <td className="num">
                            <input
                              aria-label="Manage squat"
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              value={editFields.squat}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, squat: e.target.value }))
                              }
                            />
                          </td>
                          <td className="num">
                            <input
                              aria-label="Manage bench"
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              value={editFields.bench}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, bench: e.target.value }))
                              }
                            />
                          </td>
                          <td className="num">
                            <input
                              aria-label="Manage deadlift"
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              value={editFields.deadlift}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, deadlift: e.target.value }))
                              }
                            />
                          </td>
                          <td colSpan={2}>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => void saveEdit(entry.id)}
                                disabled={isBusy}
                              >
                                {isBusy ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={cancelActiveRow}
                                disabled={isBusy}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : mode === "confirming-delete" ? (
                        <td colSpan={6}>
                          <div className="row-actions">
                            <span>Delete this user?</span>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => void confirmDelete(entry.id)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Deleting..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={cancelActiveRow}
                              disabled={isBusy}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td>{entry.name}</td>
                          <td className="num">{entry.squat}</td>
                          <td className="num">{entry.bench}</td>
                          <td className="num">{entry.deadlift}</td>
                          <td className="num">{entry.total}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                aria-label={`Edit ${entry.name}`}
                                onClick={() => startEdit(entry)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                aria-label={`Delete ${entry.name}`}
                                onClick={() => startDeleteConfirm(entry.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                    {isActive && rowError && (
                      <tr>
                        <td colSpan={6}>
                          <div className="alert alert-error" role="alert">
                            {rowError}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

Append the following to the end of `frontend/src/index.css`:

```css

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.row-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.leaderboard-table input[type="text"],
.leaderboard-table input[type="number"] {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.35rem;
  font-size: 0.9rem;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop --command bash -c "cd frontend && npm test -- src/components/UserManagementPanel.test.tsx"`
Expected: PASS (5 tests in `UserManagementPanel.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UserManagementPanel.tsx frontend/src/components/UserManagementPanel.test.tsx frontend/src/index.css
git commit -m "feat: add UserManagementPanel component for admin edit and delete"
```

---

### Task 3: Wire Admin Visibility into `App.tsx`

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/App.test.tsx`, replace this existing function:

```tsx
function makeFakeJwt(sub: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = btoa(JSON.stringify({ sub, exp }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}
```

with this version, which adds an optional role:

```tsx
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
```

Then append this new block at the end of the file, after the existing `describe("App integration", ...)` block's closing `});`:

```tsx

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

  it("shows the User Management panel after an Admin-role login", async () => {
    const userId = "223e4567-e89b-12d3-a456-426614174000";
    mockLoginAndUsers("Admin", userId, "Admin User");

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Admin User");

    await user.type(screen.getByLabelText(/username/i), "adminuser");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("User Management")).toBeInTheDocument();
  });

  it("does not show the User Management panel after a normal-role login", async () => {
    const userId = "323e4567-e89b-12d3-a456-426614174000";
    mockLoginAndUsers(undefined, userId, "Regular User");

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Regular User");

    await user.type(screen.getByLabelText(/username/i), "regularuser");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByLabelText(/display name/i);
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify the Admin test fails**

Run: `nix develop --command bash -c "cd frontend && npm test -- src/App.test.tsx"`
Expected: The test `"shows the User Management panel after an Admin-role login"` FAILS, because `App.tsx` does not render `UserManagementPanel` yet. The test `"does not show the User Management panel after a normal-role login"` may already PASS, because nothing renders that panel yet — this is expected. The next step keeps that test passing for the right reason.

- [ ] **Step 3: Wire the panel into `App.tsx`**

Replace the full contents of `frontend/src/App.tsx` with:

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop --command bash -c "cd frontend && npm test -- src/App.test.tsx"`
Expected: PASS (both tests in the existing `"App integration"` block, and both tests in the new `"Admin visibility"` block).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: show User Management panel in App.tsx for Admin-role tokens"
```

---

### Task 4: Final Verification

**Files:** None (verification only).

- [ ] **Step 1: Run the full frontend test suite and production build**

Run: `nix develop --command bash -c "cd frontend && npm test && npm run build"`
Expected: Every test file passes (`api.test.ts`, `App.test.tsx`, and the new `components/UserManagementPanel.test.tsx`), and `vite build` completes with zero TypeScript or bundler errors.

- [ ] **Step 2: Validate the Docker Compose configuration still parses**

Run: `docker compose config -q`
Expected: Exits with code 0. (This feature made no changes to `docker-compose.yml`, `Dockerfile`, or `nginx.conf`; this step confirms nothing else broke them.)
