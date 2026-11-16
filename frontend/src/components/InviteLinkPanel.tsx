import { useState, type FormEvent } from "react";
import { UnauthorizedError, createInviteToken } from "../api";
import { INVITE_DEFAULT_HOURS, INVITE_MAX_HOURS, buildInviteUrl } from "../invite";

interface InviteLinkPanelProps {
  token: string;
  onLogout: () => void;
}

interface CreatedLink {
  url: string;
  hours: number;
}

interface CopyResult {
  ok: boolean;
  text: string;
}

export function InviteLinkPanel({ token, onLogout }: InviteLinkPanelProps) {
  const [hours, setHours] = useState(String(INVITE_DEFAULT_HOURS));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<CreatedLink | null>(null);
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCopyResult(null);

    const parsed = Number(hours);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > INVITE_MAX_HOURS) {
      setError(`Hours must be a whole number between 1 and ${INVITE_MAX_HOURS}.`);
      return;
    }

    setCreating(true);
    try {
      const inviteToken = await createInviteToken(token, parsed);
      setLink({ url: buildInviteUrl(inviteToken), hours: parsed });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to create invite link");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopyResult({ ok: true, text: "Link copied." });
    } catch {
      setCopyResult({
        ok: false,
        text: "Could not copy. Select the link and copy it by hand.",
      });
    }
  }

  return (
    <section className="card invite-card">
      <div className="card-header">
        <div>
          <h2>Invite Links</h2>
          <p className="subtitle">Create a link that lets a new lifter sign up</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        <div className="field">
          <label htmlFor="invite-hours">Valid for (hours)</label>
          <input
            id="invite-hours"
            type="number"
            min={1}
            max={INVITE_MAX_HOURS}
            step={1}
            required
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Creating..." : "Create invite link"}
        </button>
      </form>

      {link && (
        <div className="invite-result">
          <label htmlFor="invite-url">Invite link</label>
          <div className="invite-link-row">
            <input
              id="invite-url"
              type="text"
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void handleCopy()}>
              Copy
            </button>
          </div>
          <p className="subtitle">
            Valid for {link.hours} {link.hours === 1 ? "hour" : "hours"}. Anyone with this link
            can create an account until it expires.
          </p>
          {copyResult && (
            <div
              className={`alert ${copyResult.ok ? "alert-success" : "alert-error"}`}
              role="status"
            >
              {copyResult.text}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
