import { Fragment, useCallback, useEffect, useState } from "react";
import {
  UnauthorizedError,
  deleteUser,
  fetchUsersWithPerformance,
  parseJwtUserId,
  updateUserPerformance,
} from "../api";
import type { LeaderboardEntry } from "../types";

interface UserManagementPanelProps {
  token: string;
  onChanged: () => void;
  onLogout: () => void;
}

interface EditableFields {
  name: string;
  squat: string;
  bench: string;
  deadlift: string;
}

type RowMode = "editing" | "confirming-delete";

export function UserManagementPanel({
  token,
  onChanged,
  onLogout,
}: UserManagementPanelProps) {
  const [users, setUsers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<RowMode | null>(null);
  const [editFields, setEditFields] = useState<EditableFields>({
    name: "",
    squat: "0",
    bench: "0",
    deadlift: "0",
  });
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const currentUserId = parseJwtUserId(token);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const list = await fetchUsersWithPerformance();
      setUsers(list);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function startEdit(entry: LeaderboardEntry) {
    setActiveRowId(entry.id);
    setActiveMode("editing");
    setRowError(null);
    setEditFields({
      name: entry.name,
      squat: String(entry.squat),
      bench: String(entry.bench),
      deadlift: String(entry.deadlift),
    });
  }

  function startDeleteConfirm(entryId: string) {
    setActiveRowId(entryId);
    setActiveMode("confirming-delete");
    setRowError(null);
  }

  function cancelActiveRow() {
    setActiveRowId(null);
    setActiveMode(null);
    setRowError(null);
  }

  async function saveEdit(entryId: string) {
    const trimmedName = editFields.name.trim();
    if (!trimmedName) {
      setRowError("Display name cannot be empty.");
      return;
    }

    const parsedSquat = Number(editFields.squat);
    const parsedBench = Number(editFields.bench);
    const parsedDeadlift = Number(editFields.deadlift);

    for (const [label, val] of [
      ["Squat", parsedSquat],
      ["Bench", parsedBench],
      ["Deadlift", parsedDeadlift],
    ] as const) {
      if (!Number.isInteger(val) || val < 0 || val >= 10000) {
        setRowError(`${label} must be a whole number between 0 and 9999.`);
        return;
      }
    }

    setBusyRowId(entryId);
    setRowError(null);
    try {
      await updateUserPerformance(entryId, token, {
        name: trimmedName,
        squat: parsedSquat,
        bench: parsedBench,
        deadlift: parsedDeadlift,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === entryId
            ? {
                ...u,
                name: trimmedName,
                squat: parsedSquat,
                bench: parsedBench,
                deadlift: parsedDeadlift,
                total: parsedSquat + parsedBench + parsedDeadlift,
              }
            : u
        )
      );
      cancelActiveRow();
      onChanged();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      if (err instanceof Error && err.message === "User not found") {
        setUsers((prev) => prev.filter((u) => u.id !== entryId));
        cancelActiveRow();
        setListError("This user no longer exists.");
        return;
      }
      setRowError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyRowId(null);
    }
  }

  async function confirmDelete(entryId: string) {
    setBusyRowId(entryId);
    setRowError(null);
    try {
      await deleteUser(entryId, token);
      if (entryId === currentUserId) {
        onLogout();
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== entryId));
      cancelActiveRow();
      onChanged();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      if (err instanceof Error && err.message === "User not found") {
        setUsers((prev) => prev.filter((u) => u.id !== entryId));
        cancelActiveRow();
        setListError("This user no longer exists.");
        return;
      }
      setRowError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <section className="card user-management-card">
      <div className="card-header">
        <div>
          <h2>User Management</h2>
          <p className="subtitle">Edit or remove any registered user</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadUsers()}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {listError && (
        <div className="alert alert-error" role="alert">
          <span>{listError}</span>
        </div>
      )}

      {loading && users.length === 0 ? (
        <p className="empty-state">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="empty-state">No users found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Squat</th>
                <th className="num">Bench</th>
                <th className="num">Deadlift</th>
                <th className="num">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => {
                const isActive = activeRowId === entry.id;
                const mode = isActive ? activeMode : null;
                const isBusy = busyRowId === entry.id;

                return (
                  <Fragment key={entry.id}>
                    <tr>
                      {mode === "editing" ? (
                        <>
                          <td>
                            <input
                              aria-label="Manage name"
                              type="text"
                              value={editFields.name}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, name: e.target.value }))
                              }
                            />
                          </td>
                          <td className="num">
                            <input
                              aria-label="Manage squat"
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              value={editFields.squat}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, squat: e.target.value }))
                              }
                            />
                          </td>
                          <td className="num">
                            <input
                              aria-label="Manage bench"
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              value={editFields.bench}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, bench: e.target.value }))
                              }
                            />
                          </td>
                          <td className="num">
                            <input
                              aria-label="Manage deadlift"
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              value={editFields.deadlift}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, deadlift: e.target.value }))
                              }
                            />
                          </td>
                          <td colSpan={2}>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => void saveEdit(entry.id)}
                                disabled={isBusy}
                              >
                                {isBusy ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={cancelActiveRow}
                                disabled={isBusy}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : mode === "confirming-delete" ? (
                        <td colSpan={6}>
                          <div className="row-actions">
                            <span>Delete this user?</span>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => void confirmDelete(entry.id)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Deleting..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={cancelActiveRow}
                              disabled={isBusy}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td>{entry.name}</td>
                          <td className="num">{entry.squat}</td>
                          <td className="num">{entry.bench}</td>
                          <td className="num">{entry.deadlift}</td>
                          <td className="num">{entry.total}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                aria-label={`Edit ${entry.name}`}
                                onClick={() => startEdit(entry)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                aria-label={`Delete ${entry.name}`}
                                onClick={() => startDeleteConfirm(entry.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                    {isActive && rowError && (
                      <tr>
                        <td colSpan={6}>
                          <div className="alert alert-error" role="alert">
                            {rowError}
                          </div>
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
