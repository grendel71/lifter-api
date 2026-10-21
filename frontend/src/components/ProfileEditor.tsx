import { useEffect, useState, type FormEvent } from "react";
import {
  UnauthorizedError,
  fetchUser,
  fetchUserPerformance,
  updateUserPerformance,
} from "../api";

interface ProfileEditorProps {
  userId: string;
  token: string;
  onUpdated: () => void;
  onLogout: () => void;
}

export function ProfileEditor({
  userId,
  token,
  onUpdated,
  onLogout,
}: ProfileEditorProps) {
  const [name, setName] = useState("");
  const [squat, setSquat] = useState("0");
  const [bench, setBench] = useState("0");
  const [deadlift, setDeadlift] = useState("0");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingProfile(true);
      setError(null);
      try {
        const [user, perf] = await Promise.all([
          fetchUser(userId),
          fetchUserPerformance(userId),
        ]);
        if (!cancelled) {
          setName(user.name);
          setSquat(String(perf.squat));
          setBench(String(perf.bench));
          setDeadlift(String(perf.deadlift));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Display name cannot be empty.");
      return;
    }

    const parsedSquat = Number(squat);
    const parsedBench = Number(bench);
    const parsedDeadlift = Number(deadlift);

    for (const [label, val] of [
      ["Squat", parsedSquat],
      ["Bench", parsedBench],
      ["Deadlift", parsedDeadlift],
    ] as const) {
      if (!Number.isInteger(val) || val < 0 || val >= 10000) {
        setError(`${label} must be a whole number between 0 and 9999.`);
        return;
      }
    }

    setSaving(true);
    try {
      await updateUserPerformance(userId, token, {
        name: trimmedName,
        squat: parsedSquat,
        bench: parsedBench,
        deadlift: parsedDeadlift,
      });
      setSuccessMsg("Profile and lifts updated!");
      onUpdated();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card profile-card">
      <div className="card-header">
        <div>
          <h2>Update Your Lifts</h2>
          <p className="subtitle">Edit your display name and personal records</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </div>

      {loadingProfile ? (
        <p className="empty-state">Loading your profile...</p>
      ) : (
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="field">
            <label htmlFor="profile-name">Display Name</label>
            <input
              id="profile-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="lifts-grid">
            <div className="field">
              <label htmlFor="profile-squat">Squat</label>
              <input
                id="profile-squat"
                type="number"
                min={0}
                max={9999}
                step={1}
                required
                value={squat}
                onChange={(e) => setSquat(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-bench">Bench</label>
              <input
                id="profile-bench"
                type="number"
                min={0}
                max={9999}
                step={1}
                required
                value={bench}
                onChange={(e) => setBench(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="profile-deadlift">Deadlift</label>
              <input
                id="profile-deadlift"
                type="number"
                min={0}
                max={9999}
                step={1}
                required
                value={deadlift}
                onChange={(e) => setDeadlift(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success" role="status">
              {successMsg}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}
    </section>
  );
}
