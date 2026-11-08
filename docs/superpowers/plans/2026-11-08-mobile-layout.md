# Mobile Layout Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the mobile layout only. On mobile: show a profile icon instead of the "Log In" / "Profile" text in the header, and show only Rank, Name and Total in the leaderboard, with an expandable detail row under a lifter's name. The desktop version stays exactly as it is.

**Architecture:** CSS media queries at `max-width: 768px` do the visual changes. The header link gains an inline SVG icon and a visually-hidden label. The leaderboard gains React state (`expandedId`) to toggle a detail row, and `lift-col` classes on the three lift columns so CSS can hide them on mobile. No new dependency, no backend change.

**Tech Stack:** React 19, react-router-dom 7, plain CSS, Vitest 3, Testing Library.

**Decisions (approved):**
- Icons are inline SVG (no icon library).
- Mobile breakpoint is `768px`.
- The detail row shows Squat, Bench and Deadlift. Total stays in the main row, so it is never shown twice.

---

## Constraints from existing tests (DO NOT BREAK)

1. `getByRole("link", { name: "Log In" })` and `{ name: "Profile" }` must keep working. The account link keeps its text in the DOM (visually hidden on mobile via clip, NOT `display: none`), so its accessible name stays "Log In" / "Profile".
2. `getByText("Alex")`, `getByText("580")`, `getByText("600")` must keep matching exactly once. The detail row does NOT repeat the name or the total.
3. The header must still render zero buttons. The account control stays a `Link`.
4. `UserManagementPanel.test.tsx` and `api.test.ts` must stay unedited.
5. jsdom does not apply media queries, so tests always see the desktop DOM. This means the hidden lift columns and the detail row are driven by React state and classes, which ARE testable, while the visual hiding stays CSS-only.

## File structure

| File | Action |
|---|---|
| `frontend/src/components/SiteHeader.tsx` | Modify: icon + visually-hidden label |
| `frontend/src/components/layout.test.tsx` | Modify: add icon test |
| `frontend/src/styles/layout.css` | Modify: header icon + mobile nav sizing |
| `frontend/src/components/LeaderboardTable.tsx` | Modify: `expandedId` state, `lift-col` classes, detail row |
| `frontend/src/components/LeaderboardTable.test.tsx` | Modify: add expand/collapse and `lift-col` tests |
| `frontend/src/styles/components.css` | Modify: name button, chevron, detail row, mobile hide |

All node commands run through the nix shell (node is NOT on PATH):

```bash
cd /home/blau/Projects/apps/leaderboard-api
nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b'
```

The warning "Git tree is dirty" is harmless.

---

### Task 0: Branch and baseline

- [ ] **Step 1:** `git status --short` must be empty, then:

```bash
git checkout -b feat/mobile-layout
```

- [ ] **Step 2:** Run the verify command above. Expected: 36 tests PASS, tsc clean. If red, STOP and report.

---

### Task 1: Profile icon in the header (TDD)

**Files:** `SiteHeader.tsx`, `layout.test.tsx`, `layout.css`

- [ ] **Step 1: Add the failing test to `frontend/src/components/layout.test.tsx`.**

The file already imports `MemoryRouter` and has `renderHeader(loggedIn)`. Append this test inside the `describe("SiteHeader", ...)` block, after the "renders no buttons" test:

```tsx
  it("renders a profile icon inside the account link", () => {
    renderHeader(false);
    const link = screen.getByRole("link", { name: "Log In" });
    expect(link.querySelector("svg")).not.toBeNull();
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
```

- [ ] **Step 2: Run to verify RED**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/components/layout.test.tsx'`
Expected: FAIL — the account link has no `svg`.

- [ ] **Step 3: Rewrite `frontend/src/components/SiteHeader.tsx`** with the full content below:

```tsx
import { Link, NavLink } from "react-router-dom";

interface SiteHeaderProps {
  loggedIn: boolean;
}

export function SiteHeader({ loggedIn }: SiteHeaderProps) {
  const ctaTo = loggedIn ? "/profile" : "/login";
  const ctaLabel = loggedIn ? "Profile" : "Log In";

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="site-brand" to="/">
          <span className="site-brand-mark" aria-hidden="true">
            ▲
          </span>
          <span>Leaderboard</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <NavLink to="/" end>
            Rankings
          </NavLink>
          <Link to="/#about">About</Link>
          <Link className="site-nav-cta" to={ctaTo}>
            <svg
              className="cta-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
            <span className="cta-label">{ctaLabel}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/components/layout.test.tsx'`
Expected: PASS (8 tests now: 7 existing + 1 new).

- [ ] **Step 5: Append the header CSS to `frontend/src/styles/layout.css`**

```css

/* ---------- Header: profile icon on mobile ---------- */
.cta-icon {
  display: none;
}

@media (max-width: 768px) {
  .site-brand {
    font-size: 1rem;
  }

  .site-nav {
    gap: 0;
  }

  .site-nav a {
    padding: 0.4rem 0.5rem;
    font-size: 0.9rem;
  }

  .site-nav-cta {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.6rem;
  }

  .cta-icon {
    display: block;
  }

  .cta-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
```

- [ ] **Step 6: Full suite + commit**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'`
Expected: all PASS, build OK.

```bash
git add frontend/src/components/SiteHeader.tsx frontend/src/components/layout.test.tsx frontend/src/styles/layout.css
git commit -m "feat(frontend): profile icon in header on mobile"
```

---

### Task 2: Mobile leaderboard: rank, name, total + expandable detail (TDD)

**Files:** `LeaderboardTable.tsx`, `LeaderboardTable.test.tsx`, `components.css`

- [ ] **Step 1: Add failing tests to `frontend/src/components/LeaderboardTable.test.tsx`.**

Change the top imports to:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaderboardTable } from "./LeaderboardTable";
import type { LeaderboardEntry } from "../types";
```

Append these two tests inside the `describe("LeaderboardTable", ...)` block:

```tsx
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
```

- [ ] **Step 2: Run to verify RED**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/components/LeaderboardTable.test.tsx'`
Expected: FAIL — no `lift-col` class, no name button, no `.detail-row`.

- [ ] **Step 3: Rewrite `frontend/src/components/LeaderboardTable.tsx`** with the full content below:

```tsx
import { Fragment, useState } from "react";
import type { LeaderboardEntry } from "../types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function LeaderboardTable({
  entries,
  currentUserId,
  loading,
  error,
  onRefresh,
}: LeaderboardTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <section id="leaderboard" className="card leaderboard-card">
      <div className="card-header">
        <div>
          <h2>Top 10 Lifters</h2>
          <p className="subtitle">Ranked by combined Squat, Bench, and Deadlift total</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <p className="empty-state">Loading leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No lifters registered yet. Sign up to claim #1!</p>
      ) : (
        <div className="table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Lifter</th>
                <th className="num lift-col">Squat</th>
                <th className="num lift-col">Bench</th>
                <th className="num lift-col">Deadlift</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isCurrentUser = currentUserId === entry.id;
                const isExpanded = expandedId === entry.id;
                return (
                  <Fragment key={entry.id}>
                    <tr className={isCurrentUser ? "row-current-user" : undefined}>
                      <td className={`rank-cell${idx < 3 ? ` rank-${idx + 1}` : ""}`}>
                        #{idx + 1}
                      </td>
                      <td className="lifter-cell">
                        <button
                          type="button"
                          className="lifter-name-btn"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpand(entry.id)}
                        >
                          <span className="lifter-name">{entry.name}</span>
                          <svg
                            className="expand-chevron"
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {isCurrentUser && <span className="badge-you">You</span>}
                      </td>
                      <td className="num lift-col">{entry.squat}</td>
                      <td className="num lift-col">{entry.bench}</td>
                      <td className="num lift-col">{entry.deadlift}</td>
                      <td className="num total-cell">{entry.total}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="detail-row">
                        <td colSpan={3}>
                          <dl className="detail-list">
                            <div>
                              <dt>Squat</dt>
                              <dd>{entry.squat}</dd>
                            </div>
                            <div>
                              <dt>Bench</dt>
                              <dd>{entry.bench}</dd>
                            </div>
                            <div>
                              <dt>Deadlift</dt>
                              <dd>{entry.deadlift}</dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run src/components/LeaderboardTable.test.tsx'`
Expected: PASS (4 tests now).

- [ ] **Step 5: Append the mobile leaderboard CSS to `frontend/src/styles/components.css`**

```css

/* ---------- Mobile leaderboard: expandable rows ---------- */
.lifter-name-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
}

.expand-chevron {
  display: none;
}

.detail-row {
  display: none;
}

@media (max-width: 768px) {
  .leaderboard-table .lift-col {
    display: none;
  }

  .lifter-name-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
  }

  .expand-chevron {
    display: inline-block;
    transition: transform 0.15s ease;
  }

  .lifter-name-btn[aria-expanded="true"] .expand-chevron {
    transform: rotate(180deg);
  }

  .detail-row {
    display: table-row;
  }

  .detail-row td {
    background: var(--row-hover);
    border-bottom: 1px solid var(--border);
  }

  .detail-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin: 0;
    padding: 0.25rem 0;
  }

  .detail-list dt {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-list dd {
    margin: 0.1rem 0 0;
    font-weight: 600;
    color: var(--ink);
  }
}
```

- [ ] **Step 6: Full suite + commit**

Run: `nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'`
Expected: all PASS, build OK.

```bash
git add frontend/src/components/LeaderboardTable.tsx frontend/src/components/LeaderboardTable.test.tsx frontend/src/styles/components.css
git commit -m "feat(frontend): mobile leaderboard with expandable rows"
```

---

### Task 3: Final verification

- [ ] **Step 1:** Run tests, `tsc -b` and `vite build` (command above). Expected: 38 tests PASS (36 + 2 new leaderboard tests + 1 new header test), tsc clean, build OK.
- [ ] **Step 2:** `git diff feat/blue-background --stat -- frontend/src/components/UserManagementPanel.test.tsx frontend/src/api.test.ts`. Expected: no output.
- [ ] **Step 3: Manual check in the browser (DevTools device toolbar).**

| Check | Expected |
|---|---|
| 375px wide, `/` | Header shows the profile icon (no "Log In" text). Rankings and About still fit. |
| Tap the icon | Goes to `/login`. |
| Logged in, 375px | Icon links to `/profile`. |
| Leaderboard, 375px | Rows show only Rank, Name, Total. No Squat/Bench/Deadlift columns. |
| Tap a name | A detail row opens under it with Squat, Bench and Deadlift. The chevron flips. |
| Tap the name again | The detail row closes. |
| ≥ 769px wide | Header shows the "Log In" / "Profile" text, no icon. Leaderboard shows all six columns. Names look like plain text. |
| Screen reader | The account link is announced as "Log In" or "Profile". |

---

## Self-review

- **Spec coverage:** profile icon on mobile (Task 1). Rank/name/total with expandable details (Task 2). Desktop unchanged (all mobile rules are inside `max-width: 768px`, and the desktop `display: none` rules hide the icon, chevron and detail row).
- **Placeholders:** none. Every code step has full code.
- **Name consistency:** `cta-icon`, `cta-label`, `lifter-name-btn`, `expand-chevron`, `detail-row`, `detail-list`, `lift-col` match between components, tests and CSS.
- **Risks:** the "duplicate text" rule (Constraints). The detail row avoids name and total. The lift columns stay in the DOM (hidden by CSS), but tests never query lift values, so no collision.

## Out of scope

A hamburger menu for the nav, a bottom tab bar, changes to the admin panel table, and any desktop-only change.
