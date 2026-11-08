# Strength Level Style UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the React frontend so it looks like https://strengthlevel.com/strength-standards/bench-press (dark nav bar, hero, light grey page, white cards, clean tables, underline tabs, info section, footer). Keep ALL current features and data.

**Scope (approved by user):** Look and layout only. No new backend, no new data, no standards tables, no lift tabs.

**Architecture:** Keep every current component and its logic. Keep every current CSS class name (`card`, `btn`, `leaderboard-table`, `tab-bar`, `field`, `alert`, ...) and re-style them with new design tokens. Add four small presentational components (`SiteHeader`, `PageHero`, `AboutSection`, `SiteFooter`) and change `App.tsx` from "main + side panel" to one centered column, like the reference page. Split the single CSS file into three focused files.

**Tech Stack:** React 19, Vite 6, TypeScript 5.7, Vitest 3, Testing Library. Plain CSS (no new dependency).

---

## Reference page facts (what we copy)

| Area on reference page | What we build |
|---|---|
| Near-black top bar with logo and links | `SiteHeader` |
| Page title block with short summary line | `PageHero` |
| Male/Female tabs with underline style | Restyle existing `.tab-bar` / `.tab-btn` (Login / Sign Up) |
| White card with a clean table, thin grey row lines | Restyle `.card` and `.leaderboard-table` |
| "What do the strength standards mean?" text section | `AboutSection` ("How the ranking works") |
| Dark footer with company text | `SiteFooter` |

Palette taken from the reference CSS: ink `#0a0a0a`, text `#363636`, muted `#7a7a7a`, border `#dbdbdb`, page bg `#f5f5f5`, nav `#121212` / `#242424`, link `#485fc7`, accent `#008ee6`, deep accent `#004977`, danger `#f14668`.

## Constraints from existing tests (DO NOT BREAK)

`frontend/src/App.test.tsx` and `UserManagementPanel.test.tsx` must pass **without edits**. Rules:

1. Show each lifter name and each total only ONCE on the page. `getByText("Alex")` and `getByText("580")` fail on duplicates. So no "top total" stat in the hero.
2. Only ONE element may match each of: label `/username/i`, `/password/i`, `/display name/i`, `/squat/i`. Do not add `aria-label` text with those words anywhere new.
3. Only ONE button may match `/sign in/i` and `/save changes/i`. Header nav items must be links (`<a>`), not buttons.
4. No other element may have the exact text `User Management`.
5. Admin panel button names stay exact: `Edit <name>`, `Delete <name>`, `Save`, `Cancel`, `Confirm`.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `frontend/index.html` | Modify | Page title, `theme-color` |
| `frontend/src/index.css` | Rewrite | Only `@import` the three style files |
| `frontend/src/styles/tokens.css` | Create | CSS variables, reset, base typography, container |
| `frontend/src/styles/layout.css` | Create | Header, hero, page stack, about, footer, responsive rules |
| `frontend/src/styles/components.css` | Create | Cards, tables, tabs, forms, buttons, alerts (existing class names) |
| `frontend/src/components/SiteHeader.tsx` | Create | Top nav bar |
| `frontend/src/components/PageHero.tsx` | Create | Title and summary block |
| `frontend/src/components/AboutSection.tsx` | Create | Static "how ranking works" text |
| `frontend/src/components/SiteFooter.tsx` | Create | Footer |
| `frontend/src/components/layout.test.tsx` | Create | Tests for the four new components |
| `frontend/src/components/LeaderboardTable.tsx` | Modify | Add `id`, podium classes for rank 1-3 |
| `frontend/src/components/LeaderboardTable.test.tsx` | Create | Test podium classes |
| `frontend/src/App.tsx` | Modify | New single-column layout |

All commands below run from `/home/blau/Projects/apps/leaderboard-api/frontend` unless stated.

---

### Task 0: Preflight and baseline

The working tree has uncommitted admin-panel work (`App.tsx`, `api.ts`, `index.css`, `UserManagementPanel*`). This refactor edits the same files. Save that work first so the refactor diff is clean.

- [ ] **Step 1: Check state**

Run (repo root): `git status --short`
Expected: lists the modified and untracked frontend files.

- [ ] **Step 2: Run baseline tests and build**

Run: `npx vitest run && npx tsc -b`
Expected: all tests PASS, no type errors. If a test fails now, STOP and report. Do not start the refactor on a red baseline.

- [ ] **Step 3: Commit the admin work separately (ask the user first if unsure)**

```bash
cd /home/blau/Projects/apps/leaderboard-api
git add frontend/src
git commit -m "feat(frontend): add admin user management panel"
```

- [ ] **Step 4: Make a branch for the refactor**

```bash
git checkout -b feat/strengthlevel-ui
```

---

### Task 1: Design tokens and base styles

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Rewrite: `frontend/src/index.css`
- Modify: `frontend/index.html`

- [ ] **Step 1: Create `frontend/src/styles/tokens.css`**

```css
:root {
  --ink: #0a0a0a;
  --text: #363636;
  --muted: #7a7a7a;
  --border: #dbdbdb;
  --surface: #ffffff;
  --page-bg: #f5f5f5;
  --row-hover: #fafafa;
  --nav-bg: #121212;
  --nav-bg-2: #242424;
  --nav-text: #f5f5f5;
  --nav-muted: #b5b5b5;
  --link: #485fc7;
  --accent: #008ee6;
  --accent-dark: #004977;
  --accent-soft: #ebf7ff;
  --danger: #f14668;
  --danger-soft: #fff1f4;
  --success: #257942;
  --success-soft: #effaf3;
  --gold: #c9a227;
  --silver: #8d949c;
  --bronze: #b8733d;
  --radius: 6px;
  --shadow: 0 1px 2px rgba(10, 10, 10, 0.06), 0 0 0 1px rgba(10, 10, 10, 0.02);
  --font: BlinkMacSystemFont, -apple-system, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, "Helvetica Neue", Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: 4.5rem;
}

body {
  margin: 0;
  font-family: var(--font);
  font-size: 1rem;
  line-height: 1.5;
  color: var(--text);
  background: var(--page-bg);
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--link);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

h1,
h2,
h3 {
  color: var(--ink);
  line-height: 1.2;
}

.container {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.25rem;
}
```

- [ ] **Step 2: Rewrite `frontend/src/index.css`** (replace the whole file)

```css
@import "./styles/tokens.css";
@import "./styles/layout.css";
@import "./styles/components.css";
```

- [ ] **Step 3: Create empty placeholders so the build works**

Create `frontend/src/styles/layout.css` and `frontend/src/styles/components.css` with one line each: `/* filled in later tasks */`

- [ ] **Step 4: Update `frontend/index.html`** — replace the `<title>` line and add a meta tag below the viewport tag:

```html
    <meta name="theme-color" content="#121212" />
    <title>Powerlifting Leaderboard</title>
```

- [ ] **Step 5: Verify build**

Run: `npx tsc -b && npx vite build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/styles src/index.css index.html
git commit -m "style: add design tokens and split stylesheet"
```

---

### Task 2: SiteHeader component (TDD)

**Files:**
- Create: `frontend/src/components/layout.test.tsx`
- Create: `frontend/src/components/SiteHeader.tsx`

- [ ] **Step 1: Write the failing test** in `frontend/src/components/layout.test.tsx`

```tsx
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/layout.test.tsx`
Expected: FAIL, cannot resolve `./SiteHeader`.

- [ ] **Step 3: Create `frontend/src/components/SiteHeader.tsx`**

```tsx
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a className="site-brand" href="#top">
          <span className="site-brand-mark" aria-hidden="true">
            ▲
          </span>
          <span>Leaderboard</span>
        </a>
        <nav className="site-nav" aria-label="Primary">
          <a href="#leaderboard">Rankings</a>
          <a href="#account">Account</a>
          <a href="#about">About</a>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/layout.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SiteHeader.tsx src/components/layout.test.tsx
git commit -m "feat(frontend): add SiteHeader nav bar"
```

---

### Task 3: PageHero, AboutSection, SiteFooter (TDD)

**Files:**
- Modify: `frontend/src/components/layout.test.tsx`
- Create: `frontend/src/components/PageHero.tsx`, `AboutSection.tsx`, `SiteFooter.tsx`

- [ ] **Step 1: Add failing tests.** Replace the import line at the top of `layout.test.tsx` with:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";
import { PageHero } from "./PageHero";
import { AboutSection } from "./AboutSection";
import { SiteFooter } from "./SiteFooter";
```

Append at the end of the file:

```tsx
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/layout.test.tsx`
Expected: FAIL, cannot resolve the three new modules.

- [ ] **Step 3: Create `frontend/src/components/PageHero.tsx`**

```tsx
export function PageHero() {
  return (
    <section className="page-hero">
      <div className="container">
        <h1>Powerlifting Leaderboard</h1>
        <p>
          Compare the strongest lifters by their combined Squat, Bench Press and
          Deadlift total. Sign in to add your own lifts.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/AboutSection.tsx`**

```tsx
export function AboutSection() {
  return (
    <section id="about" className="about-section">
      <h2>How the ranking works</h2>
      <dl className="about-list">
        <div>
          <dt>Total</dt>
          <dd>
            Your total is your best Squat, Bench Press and Deadlift added
            together.
          </dd>
        </div>
        <div>
          <dt>Top 10</dt>
          <dd>The table shows the ten lifters with the highest totals.</dd>
        </div>
        <div>
          <dt>Your lifts</dt>
          <dd>
            Create an account or log in, then use the form to change your name
            and lifts. The table updates at once.
          </dd>
        </div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/SiteFooter.tsx`**

```tsx
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <span>© {new Date().getFullYear()} Powerlifting Leaderboard</span>
        <a href="#top">Back to top</a>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/components/layout.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components
git commit -m "feat(frontend): add hero, about section and footer"
```

---

### Task 4: LeaderboardTable podium classes and anchor (TDD)

**Files:**
- Create: `frontend/src/components/LeaderboardTable.test.tsx`
- Modify: `frontend/src/components/LeaderboardTable.tsx`

- [ ] **Step 1: Write the failing test** `frontend/src/components/LeaderboardTable.test.tsx`

```tsx
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/LeaderboardTable.test.tsx`
Expected: FAIL (no `#leaderboard`, no `rank-1` class).

- [ ] **Step 3: Edit `LeaderboardTable.tsx`.**

Change the section tag (line 19):

```tsx
    <section id="leaderboard" className="card leaderboard-card">
```

Change the rank cell (line 58):

```tsx
                    <td className={`rank-cell${idx < 3 ? ` rank-${idx + 1}` : ""}`}>
                      #{idx + 1}
                    </td>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/LeaderboardTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LeaderboardTable.tsx src/components/LeaderboardTable.test.tsx
git commit -m "feat(frontend): podium ranks and anchor on leaderboard"
```

---

### Task 5: New App layout

**Files:**
- Modify: `frontend/src/App.tsx` (lines 8-12 imports, lines 60-104 JSX)

- [ ] **Step 1: Add imports.** After the existing `UserManagementPanel` import add:

```tsx
import { AboutSection } from "./components/AboutSection";
import { PageHero } from "./components/PageHero";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
```

- [ ] **Step 2: Replace the `return (...)` block** (from `return (` to the closing `);`) with:

```tsx
  return (
    <div className="app-shell" id="top">
      <SiteHeader />
      <PageHero />

      <main className="container page-stack">
        <LeaderboardTable
          entries={entries}
          currentUserId={currentUserId}
          loading={loading}
          error={error}
          onRefresh={() => void loadLeaderboard()}
        />

        <div id="account" className="account-stack">
          {token && currentUserId ? (
            <>
              <ProfileEditor
                userId={currentUserId}
                token={token}
                onUpdated={() => void loadLeaderboard()}
                onLogout={handleLogout}
              />
              {isAdmin && (
                <UserManagementPanel
                  token={token}
                  onChanged={() => void loadLeaderboard()}
                  onLogout={handleLogout}
                />
              )}
            </>
          ) : (
            <AuthCard
              onLoginSuccess={handleLoginSuccess}
              onUserCreated={() => void loadLeaderboard()}
            />
          )}
        </div>

        <AboutSection />
      </main>

      <SiteFooter />
    </div>
  );
```

All logic above the `return` stays unchanged.

- [ ] **Step 3: Run all tests (behaviour must be unchanged)**

Run: `npx vitest run && npx tsc -b`
Expected: all PASS, no type errors. If `App.test.tsx` fails on "multiple elements", re-read the Constraints section.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(frontend): single-column page layout"
```

---

### Task 6: Layout styles (header, hero, page, about, footer)

**Files:**
- Replace contents of: `frontend/src/styles/layout.css`

- [ ] **Step 1: Write `frontend/src/styles/layout.css`**

```css
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ---------- Header ---------- */
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--nav-bg);
  border-bottom: 1px solid var(--nav-bg-2);
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 3.5rem;
}

.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--nav-text);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.01em;
}

.site-brand:hover {
  text-decoration: none;
}

.site-brand-mark {
  color: var(--accent);
}

.site-nav {
  display: flex;
  gap: 0.25rem;
}

.site-nav a {
  color: var(--nav-muted);
  font-weight: 500;
  font-size: 0.95rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius);
}

.site-nav a:hover {
  color: var(--nav-text);
  background: var(--nav-bg-2);
  text-decoration: none;
}

/* ---------- Hero ---------- */
.page-hero {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 2.5rem 0 2rem;
}

.page-hero h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
  font-weight: 700;
}

.page-hero p {
  margin: 0;
  max-width: 40rem;
  color: var(--text);
  font-size: 1.05rem;
}

/* ---------- Page body ---------- */
.page-stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 1.5rem;
  padding-bottom: 3rem;
}

.account-stack {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.account-stack > .auth-card,
.account-stack > .profile-card {
  width: 100%;
  max-width: 560px;
}

/* ---------- About ---------- */
.about-section h2 {
  margin: 0 0 1rem;
  font-size: 1.4rem;
}

.about-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 0;
}

.about-list > div {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.1rem;
}

.about-list dt {
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 0.25rem;
}

.about-list dd {
  margin: 0;
  color: var(--text);
  font-size: 0.95rem;
}

/* ---------- Footer ---------- */
.site-footer {
  background: var(--nav-bg);
  color: var(--nav-muted);
  padding: 1.5rem 0;
  font-size: 0.9rem;
}

.site-footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.site-footer a {
  color: var(--nav-text);
}

/* ---------- Responsive ---------- */
@media (max-width: 720px) {
  .page-hero h1 {
    font-size: 1.6rem;
  }

  .about-list {
    grid-template-columns: 1fr;
  }

  .account-stack > .auth-card,
  .account-stack > .profile-card {
    max-width: none;
  }
}
```

- [ ] **Step 2: Run the build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/styles/layout.css
git commit -m "style: header, hero, about and footer layout"
```

---

### Task 7: Component styles (cards, tables, tabs, forms, buttons, alerts)

All existing class names stay. Only their look changes.

**Files:**
- Replace contents of: `frontend/src/styles/components.css`

- [ ] **Step 1: Write `frontend/src/styles/components.css`**

```css
/* ---------- Card ---------- */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.card-header h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
}

.subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--muted);
}

/* ---------- Table ---------- */
.table-wrapper {
  overflow-x: auto;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.leaderboard-table th,
.leaderboard-table td {
  padding: 0.7rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
}

.leaderboard-table thead th {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border);
  white-space: nowrap;
}

.leaderboard-table tbody tr:hover {
  background: var(--row-hover);
}

.leaderboard-table tbody tr:last-child td {
  border-bottom: none;
}

.leaderboard-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rank-cell {
  width: 3.5rem;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.rank-cell.rank-1 {
  color: var(--gold);
}

.rank-cell.rank-2 {
  color: var(--silver);
}

.rank-cell.rank-3 {
  color: var(--bronze);
}

.lifter-name {
  font-weight: 600;
  color: var(--ink);
}

.total-cell {
  font-weight: 700;
  color: var(--accent-dark);
}

.row-current-user,
.leaderboard-table tbody tr.row-current-user:hover {
  background: var(--accent-soft);
}

.badge-you {
  margin-left: 0.5rem;
  background: var(--accent);
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  vertical-align: middle;
}

.leaderboard-table input[type="text"],
.leaderboard-table input[type="number"] {
  width: 100%;
  min-width: 4rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.9rem;
}

.row-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

/* ---------- Tabs (underline style like the reference) ---------- */
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.7rem 0.5rem;
  margin-bottom: -1px;
  font: inherit;
  font-weight: 600;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.tab-btn:hover {
  color: var(--ink);
}

.tab-btn.active {
  color: var(--link);
  border-bottom-color: var(--link);
}

/* ---------- Forms ---------- */
.form-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lifts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
}

.field input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font: inherit;
  font-size: 0.95rem;
  color: var(--ink);
  background: var(--surface);
}

.field input:focus {
  outline: none;
  border-color: var(--link);
  box-shadow: 0 0 0 3px rgba(72, 95, 199, 0.25);
}

/* ---------- Buttons ---------- */
.btn {
  padding: 0.55rem 1rem;
  border-radius: var(--radius);
  font: inherit;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-dark);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}

.btn-secondary:hover:not(:disabled) {
  border-color: #b5b5b5;
  color: var(--ink);
}

/* ---------- Alerts / empty ---------- */
.alert {
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.alert-error {
  background: var(--danger-soft);
  color: #cc0f35;
  border: 1px solid #fcc;
}

.alert-success {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid #b7e3c6;
}

.empty-state {
  text-align: center;
  color: var(--muted);
  padding: 2rem 0;
}

/* ---------- Responsive ---------- */
@media (max-width: 720px) {
  .card {
    padding: 1rem;
  }

  .card-header {
    flex-direction: column;
  }

  .lifts-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Run everything**

Run: `npx vitest run && npx tsc -b && npx vite build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/styles/components.css
git commit -m "style: restyle cards, tables, tabs, forms and buttons"
```

---

### Task 8: Visual check in a browser (manual)

Tests do not check looks. Do this by eye.

- [ ] **Step 1: Start the stack.** Backend per the repo README / `docker-compose.yml`, then:

Run: `npm run dev`
Open the printed URL.

- [ ] **Step 2: Check each state against the reference page**

| Check | Expected |
|---|---|
| Top bar | Near-black, sticky, brand left, 3 links right |
| Hero | White band, big title, one summary paragraph |
| Leaderboard | White card, thin grey row lines, rank 1-3 in gold/silver/bronze, total in deep blue |
| Logged-out | Auth card with underline tabs (Login / Sign Up), max 560px wide |
| Logged-in | Profile form, "You" badge on own row |
| Admin login | User Management table is full width; Edit/Delete/Confirm still work |
| About + footer | 3 cards in a row, dark footer, "Back to top" works |
| Nav links | Smooth scroll to Rankings / Account / About |
| 375px wide (devtools) | No horizontal page scroll; table scrolls inside its card; about cards stack |

- [ ] **Step 3: Fix any visual bug in the matching CSS file, re-run `npx vitest run`, then commit**

```bash
git add -A
git commit -m "style: visual polish after browser check"
```

(Skip the commit if nothing changed.)

---

### Task 9: Final verification

- [ ] **Step 1: Full run**

Run: `npx vitest run && npx tsc -b && npx vite build`
Expected: all tests PASS (old tests untouched plus new `layout` and `LeaderboardTable` tests), no type errors, build OK.

- [ ] **Step 2: Confirm old tests were not edited**

Run (repo root): `git diff main --stat -- frontend/src/App.test.tsx frontend/src/components/UserManagementPanel.test.tsx frontend/src/api.test.ts`
Expected: no output, or only changes from the Task 0 commit.

- [ ] **Step 3: Check Docker build still works (frontend image)**

Run (repo root): `docker build -t leaderboard-frontend-check frontend`
Expected: build succeeds.

---

## Self-review

- **Scope coverage:** nav, hero, cards, table, tabs, forms, info section, footer, responsive: Tasks 2-7. All features kept: leaderboard + refresh (Task 4 only adds classes), login / sign up (AuthCard untouched), profile editor (untouched), admin panel (untouched), logout (ProfileEditor button kept).
- **Placeholders:** none. Every code step has full code.
- **Name consistency:** `SiteHeader`, `PageHero`, `AboutSection`, `SiteFooter`, ids `#top`, `#leaderboard`, `#account`, `#about`, classes `rank-1..3` match between tests, components and CSS.
- **Risk:** the biggest risk is the "duplicate text" rule in the Constraints section. Tasks 5 and 7 re-run the old tests to catch it.

## Out of scope (not in this plan)

Lift tabs, standards tables, bodyweight/age filters, kg/lb switch, language switch, exercise picker, dark mode, new backend endpoints.
