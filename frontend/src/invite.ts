import { parseJwtType } from "./api";

// Must match MAX_INVITE_HOURS in the backend .env.
export const INVITE_MAX_HOURS = 168;
export const INVITE_DEFAULT_HOURS = 24;

// The link points at the root of the frontend that the admin is using now.
export function buildInviteUrl(
  inviteToken: string,
  origin: string = window.location.origin
): string {
  const url = new URL("/", origin);
  url.searchParams.set("invite", inviteToken);
  return url.toString();
}

// Client-side check only: type and expiry. The server checks the signature.
export function isInviteTokenUsable(inviteToken: string | null): boolean {
  if (!inviteToken) return false;
  return parseJwtType(inviteToken) === "invite";
}
