import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";

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
