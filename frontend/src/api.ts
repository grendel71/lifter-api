import type {
  CreateUserPayload,
  InviteTokenResponse,
  LeaderboardEntry,
  LifterResponse,
  LoginPayload,
  LoginResponse,
  UpdateUserPayload,
  UserPublic,
} from "./types";

export const TOKEN_STORAGE_KEY = "leaderboard_jwt";

interface DecodedJwt {
  sub?: string;
  exp?: number;
  role?: string;
  type?: string;
}

function decodeJwtPayload(token: string): DecodedJwt | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as DecodedJwt;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function parseJwtUserId(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub || typeof payload.sub !== "string") return null;
  return payload.sub;
}

export function parseJwtRole(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.role !== "string" || payload.role.length === 0) {
    return null;
  }
  return payload.role;
}

export function parseJwtType(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.type !== "string" || payload.type.length === 0) {
    return null;
  }
  return payload.type;
}

export function buildTop10(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: unknown } | undefined;
      if (first && typeof first.msg === "string") return first.msg;
    }
  } catch {
    // ignore JSON parse error
  }
  return fallback;
}

export async function fetchUser(userId: string): Promise<UserPublic> {
  const res = await fetch(`/api/v1/users/${userId}`);
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to load user"));
  }
  return (await res.json()) as UserPublic;
}

export async function fetchUserPerformance(userId: string): Promise<LifterResponse> {
  const res = await fetch(`/api/v1/users/${userId}/performance`);
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to load performance"));
  }
  return (await res.json()) as LifterResponse;
}

export async function fetchUsersWithPerformance(): Promise<LeaderboardEntry[]> {
  const usersRes = await fetch("/api/v1/users");
  if (!usersRes.ok) {
    throw new Error(await parseErrorDetail(usersRes, "Failed to fetch users"));
  }
  const users = (await usersRes.json()) as UserPublic[];

  return Promise.all(
    users.map(async (user): Promise<LeaderboardEntry> => {
      try {
        const perf = await fetchUserPerformance(user.id);
        return {
          id: user.id,
          name: user.name,
          squat: perf.squat,
          bench: perf.bench,
          deadlift: perf.deadlift,
          total: perf.total ?? perf.squat + perf.bench + perf.deadlift,
        };
      } catch {
        return {
          id: user.id,
          name: user.name,
          squat: 0,
          bench: 0,
          deadlift: 0,
          total: 0,
        };
      }
    })
  );
}

export async function fetchTop10Leaderboard(): Promise<LeaderboardEntry[]> {
  const entries = await fetchUsersWithPerformance();
  return buildTop10(entries);
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch("/api/v1/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Login failed"));
  }
  return (await res.json()) as LoginResponse;
}

export async function registerUser(payload: CreateUserPayload): Promise<{ user_id: string }> {
  const res = await fetch("/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Registration failed"));
  }
  return (await res.json()) as { user_id: string };
}

export class UnauthorizedError extends Error {
  constructor(message = "Invalid or expired token") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function updateUserPerformance(
  userId: string,
  token: string,
  payload: UpdateUserPayload
): Promise<void> {
  const res = await fetch(`/api/v1/users/${userId}/updatePerformance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    throw new UnauthorizedError(await parseErrorDetail(res, "Invalid or expired token"));
  }
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to update performance"));
  }
}

export async function deleteUser(userId: string, token: string): Promise<void> {
  const res = await fetch(`/api/v1/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    throw new UnauthorizedError(await parseErrorDetail(res, "Invalid or expired token"));
  }
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to delete user"));
  }
}

export async function createInviteToken(
  token: string,
  durationHours: number
): Promise<string> {
  const res = await fetch(`/api/v1/createInviteToken?duration=${durationHours}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    throw new UnauthorizedError(await parseErrorDetail(res, "Invalid or expired token"));
  }
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Failed to create invite link"));
  }
  const body = (await res.json()) as InviteTokenResponse;
  return body.invite_token;
}
