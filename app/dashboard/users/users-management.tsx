"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  UserPlus,
  Users,
  ShieldCheck,
  Trash2,
  RefreshCw,
} from "lucide-react";

const ROLES = [
  { value: "data_team", label: "Data Team" },
  { value: "call_center", label: "Call Center" },
  { value: "field_executive", label: "Field Executive" },
  { value: "developer", label: "Developer" },
  { value: "admin", label: "Admin" },
] as const;

type AppRole = (typeof ROLES)[number]["value"];

type ManagedUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  role: AppRole | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function roleLabel(role: string | null) {
  return ROLES.find((item) => item.value === role)?.label ?? "Unassigned";
}

export default function UsersManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, AppRole | "">
  >({});

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("data_team");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load users.");
      }

      const loadedUsers = result.users as ManagedUser[];

      setUsers(loadedUsers);

      const drafts: Record<string, AppRole | ""> = {};

      for (const user of loadedUsers) {
        drafts[user.id] = user.role ?? "";
      }

      setRoleDrafts(drafts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          role: newRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to create user.");
      }

      setEmail("");
      setPassword("");
      setNewRole("data_team");

      setSuccess(`User ${result.user.email} was created successfully.`);

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create user."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleUpdate(user: ManagedUser) {
    const role = roleDrafts[user.id];

    if (!role || role === user.role) return;

    setBusyUserId(user.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update role.");
      }

      setSuccess(`Role updated for ${user.email ?? "the user"}.`);

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update role."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDeleteUser(user: ManagedUser) {
    const confirmed = window.confirm(
      `Delete the account ${user.email ?? user.id}?\n\n` +
        "The user will lose access to the application. " +
        "Household records will be retained."
    );

    if (!confirmed) return;

    setBusyUserId(user.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete user.");
      }

      setSuccess(`User ${user.email ?? ""} was deleted successfully.`);

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete user."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => void loadUsers()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </div>

      {/* Feedback messages */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border p-4 text-sm"
        >
          {success}
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registered Users
            </CardTitle>

            <Users className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : users.length}
            </div>

            <CardDescription>
              Accounts registered in Supabase Auth.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Roles
            </CardTitle>

            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">5</div>

            <CardDescription>
              Data Team, Call Center, Field Executive, Developer, and Admin.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Create user form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Add User
          </CardTitle>

          <CardDescription>
            Create an internal account and assign its role.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleCreateUser}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="space-y-2">
              <label
                htmlFor="new-user-email"
                className="text-sm font-medium"
              >
                Email Address
              </label>

              <input
                id="new-user-email"
                type="email"
                required
                autoComplete="off"
                placeholder="user@inditronics.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="new-user-password"
                className="text-sm font-medium"
              >
                Initial Password
              </label>

              <input
                id="new-user-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="new-user-role"
                className="text-sm font-medium"
              >
                Assign Role
              </label>

              <select
                id="new-user-role"
                value={newRole}
                onChange={(event) =>
                  setNewRole(event.target.value as AppRole)
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              >
                <UserPlus className="size-4" />
                {creating ? "Creating User..." : "Create User"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing users */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Users</CardTitle>

          <CardDescription>
            Change a user's role or delete their account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium">
                      Email
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Current Role
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Change Role
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Created
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => {
                    const draft = roleDrafts[user.id] ?? "";

                    return (
                      <tr
                        key={user.id}
                        className="border-b last:border-b-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {user.email ?? "No email"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {roleLabel(user.role)}
                        </td>

                        <td className="px-4 py-3">
                          <select
                            aria-label={`Role for ${user.email ?? user.id}`}
                            value={draft}
                            onChange={(event) =>
                              setRoleDrafts((current) => ({
                                ...current,
                                [user.id]: event.target.value as AppRole | "",
                              }))
                            }
                            className="h-9 min-w-36 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="" disabled>
                              Unassigned
                            </option>

                            {ROLES.map((role) => (
                              <option
                                key={role.value}
                                value={role.value}
                              >
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(user.created_at)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleRoleUpdate(user)}
                              disabled={
                                !draft ||
                                draft === user.role ||
                                busyUserId === user.id
                              }
                              className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Save Role
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(user)}
                              disabled={busyUserId === user.id}
                              aria-label={`Delete ${user.email ?? user.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Changes to roles take effect on subsequent authorization checks.
            Existing sessions may need to refresh before the updated role is
            reflected in the interface.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}