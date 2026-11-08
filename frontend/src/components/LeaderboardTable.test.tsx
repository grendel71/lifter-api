import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
