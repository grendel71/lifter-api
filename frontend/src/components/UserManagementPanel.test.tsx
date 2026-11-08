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
