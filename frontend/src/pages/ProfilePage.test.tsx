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
