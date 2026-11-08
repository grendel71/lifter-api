import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaderboardTable } from "./LeaderboardTable";
import type { LeaderboardEntry } from "../types";

const entries: LeaderboardEntry[] = [1, 2, 3, 4].map((n) => ({
  id: `id-${n}`,
  name: `Lifter ${n}`,
  squat: 100,
  bench: 100,
  deadlift: 100,
  total: 400 - n,
}));

describe("LeaderboardTable", () => {
  it("exposes the #leaderboard anchor", () => {
    const { container } = render(
      <LeaderboardTable
        entries={entries}
        currentUserId={null}
        loading={false}
        error={null}
        onRefresh={() => {}}
      />
    );
    expect(container.querySelector("#leaderboard")).not.toBeNull();
  });

  it("marks ranks 1-3 with podium classes and rank 4 without", () => {
    render(
      <LeaderboardTable
        entries={entries}
        currentUserId={null}
        loading={false}
        error={null}
        onRefresh={() => {}}
      />
    );
    expect(screen.getByText("#1")).toHaveClass("rank-cell", "rank-1");
    expect(screen.getByText("#2")).toHaveClass("rank-cell", "rank-2");
    expect(screen.getByText("#3")).toHaveClass("rank-cell", "rank-3");
    expect(screen.getByText("#4")).not.toHaveClass("rank-1", "rank-2", "rank-3");
  });

  it("marks the lift columns with the lift-col class", () => {
    const { container } = render(
      <LeaderboardTable
        entries={entries}
        currentUserId={null}
        loading={false}
        error={null}
        onRefresh={() => {}}
      />
    );
    expect(container.querySelectorAll("thead .lift-col")).toHaveLength(3);
    expect(container.querySelectorAll("tbody .lift-col")).toHaveLength(entries.length * 3);
  });

  it("expands and collapses the detail row when a lifter name is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LeaderboardTable
        entries={entries}
        currentUserId={null}
        loading={false}
        error={null}
        onRefresh={() => {}}
      />
    );

    const btn = screen.getByRole("button", { name: "Lifter 1" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".detail-row")).toBeNull();

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const detail = container.querySelector(".detail-row");
    expect(detail).not.toBeNull();
    expect(within(detail as HTMLElement).getByText("Squat")).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText("Bench")).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText("Deadlift")).toBeInTheDocument();

    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".detail-row")).toBeNull();
  });
});
