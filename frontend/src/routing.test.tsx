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
