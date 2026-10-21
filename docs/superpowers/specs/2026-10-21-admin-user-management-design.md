# Admin User Management Panel Design Spec

**Date:** 2026-10-21
**Topic:** Frontend admin feature for the Powerlifting Leaderboard app

## 1. Overview and Goal

Add an admin-only panel to the existing React frontend. This panel lets an
admin view every registered user, edit any user's name and lift numbers, and
delete any user. The design adds no new backend code. The backend already
has the role check for these actions.

The app already puts a `role` value in each user's JWT token. The app sets
this value to `"Admin"` only for admin accounts. (A later task will add a
way to promote a user to the Admin role. This spec does not cover that
task.)

## 2. Constraints

- **Backend untouched:** No file under `src/api/` changes.
- **Existing patterns reused:** The new code follows the file layout,
  naming, and style of the existing frontend code.
- **Lift validation bounds:** Squat, Bench, and Deadlift must each be a
  whole number from 0 to 9999. This matches the existing "Update Your
  Lifts" form and the backend's own rule.

## 3. Architecture and File Structure

```text
frontend/
└── src/
    ├── api.ts                            # Add parseJwtRole, fetchUsersWithPerformance,
    │                                      # deleteUser. Refactor fetchTop10Leaderboard
    │                                      # to call fetchUsersWithPerformance.
    ├── api.test.ts                        # Add tests for the three new functions.
    ├── App.tsx                            # Add isAdmin check. Render UserManagementPanel
    │                                      # under ProfileEditor when isAdmin is true.
    ├── App.test.tsx                       # Add admin-visibility test cases.
    └── components/
        ├── UserManagementPanel.tsx         # New component.
        └── UserManagementPanel.test.tsx    # New test file.
```

No other existing file changes. `LeaderboardTable.tsx`, `AuthCard.tsx`, and
`types.ts` stay the same. The existing `LeaderboardEntry` type (in
`types.ts`) already holds the fields this feature needs: `id`, `name`,
`squat`, `bench`, `deadlift`, and `total`.

## 4. Data Flow and API Integration

### 4.1 Reading the Admin Role from the Token

`parseJwtRole(token: string): string | null`

This function reads the `role` field from the token's payload. It returns
`null` when the token is broken, missing a `role` field, or expired. It
shares its base64url-decode step with the existing `parseJwtUserId`
function, through one small private helper. This refactor does not change
the output of `parseJwtUserId` for any existing test case.

In `App.tsx`:

```typescript
const currentUserRole = token ? parseJwtRole(token) : null;
const isAdmin = currentUserRole === "Admin";
```

### 4.2 Fetching Every User and Every User's Lift Data

`fetchUsersWithPerformance(): Promise<LeaderboardEntry[]>`

This function does the following steps:
1. Calls `GET /api/v1/users`. This call returns every registered user.
2. Calls `GET /api/v1/users/{id}/performance` for every user, at the same
   time.
3. Joins each user with their lift data into one `LeaderboardEntry` record.
4. Returns the list in the same order the backend sent it. The function
   does not sort the list. The function does not cut the list down to a
   fixed size.

`fetchTop10Leaderboard()` changes to call `fetchUsersWithPerformance()`
first, then pass the result through the existing `buildTop10()` function.
The output of `fetchTop10Leaderboard()` does not change.

### 4.3 Saving an Edited Row

The panel reuses the existing `updateUserPerformance(userId, token, payload)`
function. No change to this function is needed. It already accepts any
`userId` value, and the backend already accepts this call for any user
when the caller's token carries the Admin role.

### 4.4 Deleting a User

`deleteUser(userId: string, token: string): Promise<void>`

This function sends `DELETE /api/v1/users/{userId}` with the header
`Authorization: Bearer <token>`. It throws `UnauthorizedError` on a 401
response. It throws a plain `Error`, carrying the server's message, on any
other failed response.

### 4.5 Keeping the Leaderboard in Sync

`UserManagementPanel` takes an `onChanged: () => void` prop. The panel
calls this prop after a successful Save or a successful Delete (of a user
other than the admin). `App.tsx` passes `loadLeaderboard` as this prop, so
the Top 10 Leaderboard refreshes right after an admin action changes the
data.

### 4.6 Self-Delete

Before sending a delete request, the panel compares the target row's `id`
to `parseJwtUserId(token)`. When these two values match, the admin is
deleting their own account. After this delete call succeeds, the panel
calls its `onLogout: () => void` prop instead of calling `onChanged`. This
prop clears the stored token and returns the app to the Login/Sign Up
screen, matching `ProfileEditor`'s existing logout pattern.

## 5. Component Behavior: `UserManagementPanel`

### 5.1 Props

```typescript
interface UserManagementPanelProps {
  token: string;
  onChanged: () => void;
  onLogout: () => void;
}
```

### 5.2 Row States

Each row is in exactly one of three states at any time: **Normal**,
**Editing**, or **Confirming Delete**. Only one row across the whole panel
may be in Editing or Confirming Delete state at a time. Opening a second
row's Edit or Delete state closes any other open row first, and throws
away any unsaved input in that other row.

- **Normal:** Shows Name, Squat, Bench, Deadlift, Total, and two buttons:
  **Edit** and **Delete**.
- **Editing:** Shows input boxes for Name, Squat, Bench, and Deadlift,
  pre-filled with the row's current values. Shows two buttons: **Save**
  and **Cancel**.
  - **Save** first checks the typed values: the name must not be empty,
    and Squat, Bench, and Deadlift must each be a whole number from 0 to
    9999. A failed check shows an inline error message under the row and
    sends no request. A passed check sends the update request.
  - **Cancel** returns the row to Normal state and sends no request.
- **Confirming Delete:** Shows the text "Delete this user?" and two
  buttons: **Confirm** and **Cancel**.
  - **Confirm** sends the delete request.
  - **Cancel** returns the row to Normal state and sends no request.

### 5.3 List-Level Controls

The panel has a **Refresh** button at the top, in the same style as the
Top 10 Leaderboard's Refresh button. This button re-runs
`fetchUsersWithPerformance()` and replaces the panel's list.

### 5.4 Placement in `App.tsx`

The side panel shows, in this order, when a user is logged in:
1. `ProfileEditor` (unchanged, lets the user edit their own account).
2. `UserManagementPanel` (new, shown only when `isAdmin` is `true`).

## 6. Error Handling

- **401 response (expired or invalid token), on any admin action:** The
  panel calls `onLogout`. The app shows the Login/Sign Up screen again.
- **404 response (user already deleted elsewhere), on Edit or Delete:**
  The panel removes that row from its list and shows the message "This
  user no longer exists."
- **403, network, or other server error:** The panel shows the server's
  error message under the affected row. The row stays in its current
  state (Editing or Confirming Delete), so the admin can retry or cancel.
- **The full list fails to load:** The panel shows an error message and a
  Retry action, in the same style as the Top 10 Leaderboard's error state.

## 7. Testing Strategy

### 7.1 `frontend/src/api.test.ts` (new cases)

- `parseJwtRole` returns `"Admin"` for a token carrying that role. It
  returns `null` for a token with no role field, a malformed token, and an
  expired token.
- `fetchUsersWithPerformance` fetches every user and every user's lift
  data. A test with more than 10 fake users checks that the function
  returns every one of them, unsorted, in the same order the fake `fetch`
  mock returned them.
- `deleteUser` sends the right URL and the right `Authorization` header.
  Tests cover a normal success, a 401 response (throws
  `UnauthorizedError`), and another failed response (throws a plain
  `Error` carrying the server's message).

### 7.2 `frontend/src/components/UserManagementPanel.test.tsx` (new file)

- Renders every row from a fake list of more than 10 users. This test
  proves the panel does not cut the list down, unlike the Top 10
  Leaderboard.
- Clicking **Edit** on a row shows input boxes pre-filled with the
  current values. Clicking **Save** sends the right update request and
  returns the row to Normal state.
- Clicking **Delete** shows the confirm question. Clicking **Confirm**
  sends the delete request and removes the row. Clicking **Cancel**
  removes the confirm question and sends no request.
- A failed validation check (for example, a squat value of `-1`) blocks
  the save action and shows an inline error message.
- Deleting the admin's own row calls the `onLogout` prop instead of the
  `onChanged` prop.

### 7.3 `frontend/src/App.test.tsx` (new cases)

- Logging in with a token that carries the Admin role shows the "User
  Management" panel.
- Logging in with a token that carries a normal role does NOT show the
  "User Management" panel.
