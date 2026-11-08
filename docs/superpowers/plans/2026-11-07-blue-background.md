# Blue Page Background With Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the image `~/jordanpetersjp.png` in the page background, centred at the top and behind the page content, like the Strength Level reference page. Fill the rest of the page with `#008aff`.

**Architecture:** CSS only. The reference page puts the image and the fill colour on the `html` element, with `body` transparent. We do the same. The PNG has exactly `#008aff` at its edges, so it joins the fill colour with no visible seam. The top bar stays a solid dark sticky bar. The hero band becomes transparent so the figure shows behind the title.

**Tech Stack:** Plain CSS, Vite (bundles the image), Vitest.

**Decisions (approved):** figure in the centre. Solid dark top bar.

---

## Rules

- Keep the image as PNG. Do NOT convert it to JPEG or lossy WebP. Lossy formats can shift the edge colour and show a seam.
- Do not change any `.tsx` or test file.
- All node commands run through the nix shell (node is NOT on PATH):

```bash
cd /home/blau/Projects/apps/leaderboard-api
nix develop --command bash -c 'cd frontend && npx vitest run && npx tsc -b && npx vite build'
```
The warning "Git tree is dirty" is harmless.

## File structure

| File | Action |
|---|---|
| `frontend/src/assets/jordanpetersjp.png` | Create (copy of `~/jordanpetersjp.png`) |
| `frontend/src/styles/tokens.css` | Modify |
| `frontend/src/styles/layout.css` | Modify |

---

### Task 1: Image, page background and hero

- [ ] **Step 1: Branch and baseline**

```bash
git status --short        # must be empty
git checkout -b feat/blue-background
```
Run the verify command above. Expected: 36 tests PASS, tsc clean, build OK.

- [ ] **Step 2: Copy the image**

```bash
mkdir -p frontend/src/assets
cp ~/jordanpetersjp.png frontend/src/assets/jordanpetersjp.png
```

- [ ] **Step 3: Edit `frontend/src/styles/tokens.css`**

3a. In the `:root` block, change the line
`  --page-bg: #f5f5f5;`
to
`  --page-bg: #008aff;`

3b. In the same `:root` block, add this line directly after the `--page-bg` line:
`  --header-height: 3.5rem;`

3c. In the `body` rule, change
`  background: var(--page-bg);`
to
`  background: transparent;`

3d. Append this rule at the END of the file:

```css

/* Image and fill colour live on <html>, like the reference page. */
html {
  background-color: var(--page-bg);
  background-image: url("../assets/jordanpetersjp.png");
  background-repeat: no-repeat;
  background-position: center var(--header-height);
  background-size: clamp(640px, 100%, 1280px) auto;
}
```

- [ ] **Step 4: Edit `frontend/src/styles/layout.css`**

4a. In the `.site-header-inner` rule, change `  height: 3.5rem;` to `  height: var(--header-height);`

4b. Replace the whole `/* ---------- Hero ---------- */` block (the `.page-hero`, `.page-hero h1` and `.page-hero p` rules, from the comment down to the closing brace of `.page-hero p`) with:

```css
/* ---------- Hero ---------- */
.page-hero {
  min-height: 22rem;
  padding: 3rem 0 2rem;
}

.page-hero h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 4px rgba(10, 10, 10, 0.45);
}

.page-hero p {
  margin: 0;
  max-width: 40rem;
  color: #ffffff;
  font-size: 1.05rem;
  text-shadow: 0 1px 4px rgba(10, 10, 10, 0.45);
}
```

4c. In the `@media (max-width: 720px)` block, add this rule above the existing `.page-hero h1` rule:

```css
  .page-hero {
    min-height: 14rem;
  }
```

- [ ] **Step 5: Verify.** Run the verify command from the Rules section. Expected: 36 tests PASS, tsc clean, build succeeds and the build output lists the PNG in `dist/assets/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/assets/jordanpetersjp.png frontend/src/styles/tokens.css frontend/src/styles/layout.css
git commit -m "style: blue page background with centred image"
```

---

### Task 2: Check by eye (manual, after the commit)

| Check | Expected |
|---|---|
| 1440px wide, `/` | Figure centred behind the title and the card. Flat blue around it. No seam. |
| 1920px wide | Image stops growing at 1280px. Blue continues on both sides with no seam. |
| Scroll down | Blue continues below the image. Top bar stays dark and sticky. |
| 375px wide | Figure still large. No sideways scroll. Hero text readable. |
| `/login`, `/profile` | Image behind the page title. Cards stay white. |
| Hero text | White, readable. |
