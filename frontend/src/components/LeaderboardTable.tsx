import { Fragment, useState } from "react";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

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
        <p className="empty-state">No lifters registered yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Lifter</th>
                <th className="num lift-col">Squat</th>
                <th className="num lift-col">Bench</th>
                <th className="num lift-col">Deadlift</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isCurrentUser = currentUserId === entry.id;
                const isExpanded = expandedId === entry.id;
                return (
                  <Fragment key={entry.id}>
                    <tr className={isCurrentUser ? "row-current-user" : undefined}>
                      <td className={`rank-cell${idx < 3 ? ` rank-${idx + 1}` : ""}`}>
                        #{idx + 1}
                      </td>
                      <td className="lifter-cell">
                        <button
                          type="button"
                          className="lifter-name-btn"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpand(entry.id)}
                        >
                          <span className="lifter-name">{entry.name}</span>
                          <svg
                            className="expand-chevron"
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {isCurrentUser && <span className="badge-you">You</span>}
                      </td>
                      <td className="num lift-col">{entry.squat}</td>
                      <td className="num lift-col">{entry.bench}</td>
                      <td className="num lift-col">{entry.deadlift}</td>
                      <td className="num total-cell">{entry.total}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="detail-row">
                        <td colSpan={3}>
                          <dl className="detail-list">
                            <div>
                              <dt>Squat</dt>
                              <dd>{entry.squat}</dd>
                            </div>
                            <div>
                              <dt>Bench</dt>
                              <dd>{entry.bench}</dd>
                            </div>
                            <div>
                              <dt>Deadlift</dt>
                              <dd>{entry.deadlift}</dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
