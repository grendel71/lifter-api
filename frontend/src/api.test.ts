import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  UnauthorizedError,
  buildTop10,
  deleteUser,
  fetchTop10Leaderboard,
  fetchUsersWithPerformance,
  parseJwtRole,
  parseJwtUserId,
} from "./api";
import type { LeaderboardEntry } from "./types";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.signature`;
}

describe("parseJwtUserId", () => {
  it("extracts sub UUID when token is valid and not expired", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: futureExp,
    });
    expect(parseJwtUserId(token)).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("returns null when token is expired", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: pastExp,
    });
    expect(parseJwtUserId(token)).toBeNull();
  });

  it("returns null for malformed token", () => {
    expect(parseJwtUserId("not-a-jwt")).toBeNull();
  });
});

describe("parseJwtRole", () => {
  it("extracts the role when the token is valid and not expired", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: futureExp,
      role: "Admin",
    });
    expect(parseJwtRole(token)).toBe("Admin");
  });

  it("returns null when the token has no role field", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: futureExp,
    });
    expect(parseJwtRole(token)).toBeNull();
  });

  it("returns null when the token is expired", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const token = makeFakeJwt({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      exp: pastExp,
      role: "Admin",
    });
    expect(parseJwtRole(token)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(parseJwtRole("not-a-jwt")).toBeNull();
  });
});

describe("buildTop10", () => {
  it("sorts descending by total, breaks ties by name, and limits to 10 items", () => {
    const entries: LeaderboardEntry[] = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${i + 1}`,
      name: `Lifter ${String(i + 1).padStart(2, "0")}`,
      squat: (i + 1) * 10,
      bench: (i + 1) * 10,
      deadlift: (i + 1) * 10,
      total: (i + 1) * 30,
    }));

    const top10 = buildTop10(entries);
    expect(top10).toHaveLength(10);
    expect(top10[0].id).toBe("id-12");
    expect(top10[0].total).toBe(360);
    expect(top10[9].id).toBe("id-3");
    expect(top10[9].total).toBe(90);
  });

  it("breaks ties alphabetically by name", () => {
    const entries: LeaderboardEntry[] = [
      { id: "1", name: "Zack", squat: 100, bench: 100, deadlift: 100, total: 300 },
      { id: "2", name: "Alice", squat: 100, bench: 100, deadlift: 100, total: 300 },
    ];
    const top10 = buildTop10(entries);
    expect(top10.map((e) => e.name)).toEqual(["Alice", "Zack"]);
  });
});

describe("fetchTop10Leaderboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches users and their performance in parallel and returns sorted top 10", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/users") {
        return new Response(
          JSON.stringify([
            { id: "u1", name: "Weak Lifter" },
            { id: "u2", name: "Strong Lifter" },
          ]),
          { status: 200 }
        );
      }
      if (url === "/api/v1/users/u1/performance") {
        return new Response(
          JSON.stringify({ lifter_id: "u1", squat: 100, bench: 80, deadlift: 120, total: 300 }),
          { status: 200 }
        );
      }
      if (url === "/api/v1/users/u2/performance") {
        return new Response(
          JSON.stringify({ lifter_id: "u2", squat: 250, bench: 180, deadlift: 300, total: 730 }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await fetchTop10Leaderboard();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual([
      { id: "u2", name: "Strong Lifter", squat: 250, bench: 180, deadlift: 300, total: 730 },
      { id: "u1", name: "Weak Lifter", squat: 100, bench: 80, deadlift: 120, total: 300 },
    ]);
  });
});

describe("fetchUsersWithPerformance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches every user and does not sort or limit the result", async () => {
    const userList = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${i + 1}`,
      name: `Lifter ${String(i + 1).padStart(2, "0")}`,
    }));

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/users") {
        return new Response(JSON.stringify(userList), { status: 200 });
      }
      const match = url.match(/^\/api\/v1\/users\/(id-\d+)\/performance$/);
      if (match) {
        const index = Number(match[1].split("-")[1]);
        return new Response(
          JSON.stringify({
            lifter_id: match[1],
            squat: index,
            bench: index,
            deadlift: index,
            total: index * 3,
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await fetchUsersWithPerformance();
    expect(result).toHaveLength(12);
    expect(result.map((e) => e.id)).toEqual(userList.map((u) => u.id));
  });
});

describe("deleteUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a DELETE request with the Authorization header and resolves on success", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

    await expect(deleteUser("user-1", "token-abc")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/users/user-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer token-abc" },
    });
  });

  it("throws UnauthorizedError on a 401 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid or expired token" }), { status: 401 })
    );

    await expect(deleteUser("user-1", "bad-token")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws a plain Error carrying the server message on another failed response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "User not found" }), { status: 404 })
    );

    await expect(deleteUser("user-1", "token-abc")).rejects.toThrow("User not found");
  });
});
