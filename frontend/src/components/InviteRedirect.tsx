import type { ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

interface InviteRedirectProps {
  children: ReactNode;
}

// An invite link is <origin>/?invite=<token>. Send it to the login page and keep the token.
export function InviteRedirect({ children }: InviteRedirectProps) {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get("invite");

  if (invite) {
    const query = new URLSearchParams({ invite }).toString();
    return <Navigate to={`/login?${query}`} replace />;
  }

  return <>{children}</>;
}
