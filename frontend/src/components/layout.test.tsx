import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { PageHero } from "./PageHero";
import { AboutSection } from "./AboutSection";
import { SiteFooter } from "./SiteFooter";

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

  it("renders a profile icon inside the account link", () => {
    renderHeader(false);
    const link = screen.getByRole("link", { name: "Log In" });
    expect(link.querySelector("svg")).not.toBeNull();
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("PageHero", () => {
  it("renders the page title as the only h1", () => {
    render(<PageHero />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Powerlifting Leaderboard" })
    ).toBeInTheDocument();
  });
});

describe("AboutSection", () => {
  it("has the #about anchor and explains how ranking works", () => {
    const { container } = render(<AboutSection />);
    expect(container.querySelector("#about")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: "How the ranking works" })
    ).toBeInTheDocument();
  });
});

describe("SiteFooter", () => {
  it("renders a back-to-top link and the current year", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Back to top" })).toHaveAttribute(
      "href",
      "#top"
    );
    expect(
      screen.getByText(new RegExp(String(new Date().getFullYear())))
    ).toBeInTheDocument();
  });
});
