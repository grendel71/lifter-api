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
