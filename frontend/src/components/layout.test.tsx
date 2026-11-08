import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";
import { PageHero } from "./PageHero";
import { AboutSection } from "./AboutSection";
import { SiteFooter } from "./SiteFooter";

describe("SiteHeader", () => {
  it("renders brand and anchor links to page sections", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rankings" })).toHaveAttribute(
      "href",
      "#leaderboard"
    );
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "#account"
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "#about"
    );
  });

  it("renders no buttons (keeps sign-in button unique on the page)", () => {
    render(<SiteHeader />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
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
