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
