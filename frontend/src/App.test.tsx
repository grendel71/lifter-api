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
