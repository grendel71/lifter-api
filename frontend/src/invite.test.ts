import { describe, expect, it } from "vitest";
import { buildInviteUrl, isInviteTokenUsable } from "./invite";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.signature`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 60;

describe("buildInviteUrl", () => {
  it("builds /?invite=<token> from the given origin", () => {
    expect(buildInviteUrl("aaa.bbb.ccc", "https://lifters.example.com")).toBe(
      "https://lifters.example.com/?invite=aaa.bbb.ccc"
    );
  });

  it("uses the current window origin by default", () => {
    expect(buildInviteUrl("tok")).toBe(`${window.location.origin}/?invite=tok`);
  });

  it("drops any path and query of the origin value", () => {
    expect(buildInviteUrl("tok", "https://example.com/profile?x=1")).toBe(
      "https://example.com/?invite=tok"
    );
  });
});

describe("isInviteTokenUsable", () => {
  it("is true for a token of type invite that has not expired", () => {
    expect(isInviteTokenUsable(makeFakeJwt({ sub: "a", type: "invite", exp: future() }))).toBe(true);
  });

  it("is false for a login token", () => {
    expect(isInviteTokenUsable(makeFakeJwt({ sub: "a", type: "login", exp: future() }))).toBe(false);
  });

  it("is false for an expired invite token", () => {
    expect(isInviteTokenUsable(makeFakeJwt({ sub: "a", type: "invite", exp: past() }))).toBe(false);
  });

  it("is false for a malformed token", () => {
    expect(isInviteTokenUsable("garbage")).toBe(false);
  });

  it("is false when there is no token", () => {
    expect(isInviteTokenUsable(null)).toBe(false);
  });
});
