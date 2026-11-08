import type { LeaderboardEntry } from "../types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function LeaderboardTable({
  entries,
  currentUserId,
  loading,
  error,
  onRefresh,
}: LeaderboardTableProps) {
  return (
    <section id="leaderboard" className="card leaderboard-card">
      <div className="card-header">
        <div>
          <h2>Top 10 Lifters</h2>
          <p className="subtitle">Ranked by combined Squat, Bench, and Deadlift total</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <p className="empty-state">Loading leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No lifters registered yet. Sign up to claim #1!</p>
      ) : (
        <div className="table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Lifter</th>
                <th className="num">Squat</th>
                <th className="num">Bench</th>
                <th className="num">Deadlift</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isCurrentUser = currentUserId === entry.id;
                return (
                  <tr key={entry.id} className={isCurrentUser ? "row-current-user" : undefined}>
                    <td className={`rank-cell${idx < 3 ? ` rank-${idx + 1}` : ""}`}>
                      #{idx + 1}
                    </td>
                    <td>
                      <span className="lifter-name">{entry.name}</span>
                      {isCurrentUser && <span className="badge-you">You</span>}
                    </td>
                    <td className="num">{entry.squat}</td>
                    <td className="num">{entry.bench}</td>
                    <td className="num">{entry.deadlift}</td>
                    <td className="num total-cell">{entry.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
