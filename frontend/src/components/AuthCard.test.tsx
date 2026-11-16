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
