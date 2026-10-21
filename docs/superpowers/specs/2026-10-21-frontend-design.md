# Frontend Leaderboard & User Portal Design Spec

**Date:** 2026-10-21
**Topic:** React + Vite Frontend for Powerlifting Leaderboard API

## 1. Overview & Goals

Build a single-page React + TypeScript + Vite web application in `frontend/` that connects to the existing FastAPI backend without modifying any backend Python code.

Core user capabilities:
1. View a **Top 10 Leaderboard** ranked descending by `total` (`squat + bench + deadlift`).
2. **Sign Up** (`POST /api/v1/users`) and **Log In** (`POST /api/v1/login`).
3. **Update Profile & Lifts** (`PUT /api/v1/users/{user_id}/updatePerformance`) for the authenticated user's `name`, `squat`, `bench`, and `deadlift`.

## 2. Constraints

- **Backend untouched:** `src/api/` files must not be modified.
- **No CORS middleware in FastAPI:** All browser requests must hit `/api/...` on the same origin as the frontend and be proxied to the FastAPI backend (`http://127.0.0.1:8000` via Vite dev server in development, and `http://api:8000` via Nginx in Docker).
- **Lift validation bounds:** The backend enforces `ge=0, lt=10000` (`0` to `9999`) for `squat`, `bench`, and `deadlift`. The frontend form must validate these bounds before submission.

## 3. Architecture & File Structure

```text
leaderboard-api/
├── docker-compose.yml              # Add frontend service (port 3000 -> 80)
├── flake.nix                       # Add nodejs_22 to devShell packages
└── frontend/
    ├── Dockerfile                  # Multi-stage Node build -> nginx:alpine
    ├── nginx.conf                  # Serves SPA & proxies /api/ to http://api:8000
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts              # Dev proxy /api -> http://127.0.0.1:8000 + Vitest config
    └── src/
        ├── main.tsx                # Application entry point
        ├── App.tsx                 # Top-level state (auth token, leaderboard refresh trigger)
        ├── index.css               # Clean layout and table/form styling
        ├── types.ts                # API request/response TypeScript interfaces
        ├── api.ts                  # Fetch functions, JWT sub/exp parser, Top 10 aggregator
        ├── api.test.ts             # Unit tests for JWT parsing & Top 10 aggregation/sorting
        ├── components/
        │   ├── LeaderboardTable.tsx
        │   ├── AuthCard.tsx
        │   └── ProfileEditor.tsx
        └── test-setup.ts           # @testing-library/jest-dom setup
```

## 4. Data Flow & API Integration

### 4.1 Top 10 Leaderboard Aggregation (`fetchTop10Leaderboard`)
Because `GET /api/v1/users` returns `[{ id, name }]` and performance metrics live at `GET /api/v1/users/{user_id}/performance`, the frontend client performs:
1. `GET /api/v1/users` -> `UserPublic[]`
2. `Promise.all` over all users calling `GET /api/v1/users/{user.id}/performance` -> `LifterResponse` (`{ lifter_id, squat, bench, deadlift, total }`). If a user's performance call returns 404, default their lifts to `0`.
3. Combine into `LeaderboardEntry` (`{ id, name, squat, bench, deadlift, total }`).
4. Sort by `total` descending, then by `name` ascending (`localeCompare`) for deterministic tie-breaking.
5. Return `.slice(0, 10)`.

### 4.2 Authentication & JWT Decoding (`parseJwtUserId`)
1. `POST /api/v1/login` with `{ username, password }` returns `{ access_token, token_type }`.
2. `parseJwtUserId(token)` splits the JWT on `.`, base64url-decodes the payload segment, checks that `exp * 1000 > Date.now()`, and extracts `sub` (the user's UUID).
3. Token is persisted in `localStorage` under `leaderboard_jwt`. On app startup, if the stored token is missing or expired, it is cleared.
4. `POST /api/v1/users` with `{ name, username, password }` creates the user (`201 Created`) and immediately calls `loginUser({ username, password })` so the new user is logged right in.

### 4.3 Profile & Performance Update (`ProfileEditor`)
1. On mount (when `userId` and `token` are active), fetch `GET /api/v1/users/{userId}` and `GET /api/v1/users/{userId}/performance` to populate initial values for `name`, `squat`, `bench`, and `deadlift`.
2. On form submit, validate:
   - `name.trim().length > 0`
   - `squat`, `bench`, `deadlift` are integers with `0 <= value < 10000`
3. Send `PUT /api/v1/users/{userId}/updatePerformance` with header `Authorization: Bearer <token>` and JSON body `{ name, squat, bench, deadlift }`.
4. After `200 OK`, trigger a leaderboard refresh in `App.tsx` and show a confirmation banner.

## 5. Error Handling

- **401 Unauthorized on Login:** Display `"Incorrect username or password"` inside `AuthCard`.
- **409 Conflict on Sign Up:** Display `"Username already taken"` inside `AuthCard`.
- **401 Unauthorized on Update:** Clear expired/invalid token, log out user, and prompt them to log in again.
- **Network / 5xx Errors:** Display user-friendly error alert with a retry button on the leaderboard and non-destructive error message on forms.

## 6. Testing Strategy

- **Unit tests (`src/api.test.ts`):**
  - Verify `parseJwtUserId` extracts `sub` for valid tokens and returns `null` for expired or malformed tokens.
  - Verify `buildTop10` sorts descending by `total`, breaks ties alphabetically by `name`, and caps results at 10 entries even when 15+ users exist.
- **Component tests (`src/App.test.tsx`):**
  - Renders Top 10 Leaderboard rows from mocked API responses.
  - Allows switching between Login and Sign Up, logging in, and submitting updated lift numbers via `PUT /api/v1/users/{id}/updatePerformance`.
