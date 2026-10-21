"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Calendar,
  Phone,
  Save,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Headphones,
  Check,
  XCircle,
  PhoneOff,
} from "lucide-react";

export type HouseholdRecord = {
  id: string;
  questionnaire_n?: string | number | null;
  household_id?: string | null;
  respondent_name?: string | null;
  contact_number?: string | null;
  telephone_number?: string | null;
  call_status?: string | null;
  scheduled_date?: string | null;
  installation_status?: string | null;
  appointment_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type HouseholdDraft = {
  call_status: string;
  scheduled_date: string;
  installation_status: string;
};

export const CALL_STATUS_OPTIONS = [
  { value: "call successful", label: "Call successful" },
  { value: "Not reachable", label: "Not reachable" },
  { value: "Number does not connect", label: "Number does not connect" },
] as const;

export const INSTALLATION_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "installed", label: "Installed" },
  { value: "rejected", label: "Rejected" },
] as const;

function createDraft(record: HouseholdRecord): HouseholdDraft {
  // Format scheduled_date for HTML datetime-local input (YYYY-MM-DDTHH:mm)
  let formattedDate = "";
  if (record.scheduled_date) {
    try {
      const d = new Date(record.scheduled_date);
      if (!Number.isNaN(d.getTime())) {
        // Pad numbers for datetime-local
        const pad = (n: number) => String(n).padStart(2, "0");
        formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else {
        formattedDate = record.scheduled_date.slice(0, 16);
      }
    } catch {
      formattedDate = String(record.scheduled_date).slice(0, 16);
    }
  }

  return {
    call_status: record.call_status ?? "",
    scheduled_date: formattedDate,
    installation_status: record.installation_status ?? "pending",
  };
}

function createDrafts(
  records: HouseholdRecord[]
): Record<string, HouseholdDraft> {
  const result: Record<string, HouseholdDraft> = {};
  for (const record of records) {
    result[record.id] = createDraft(record);
  }
  return result;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function formatDisplayDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return value;
  }
}

/**
 * Determine if a household is considered completed for the sequential workflow.
 *
 * Rules:
 * 1. If already installed -> complete.
 * 2. If call is "Not reachable" or "Number does not connect" -> complete.
 * 3. If call is "call successful" and schedule time is set -> complete.
 */
function isHouseholdComplete(record: HouseholdRecord): boolean {
  if (record.installation_status === "installed") {
    return true;
  }

  const call = record.call_status?.trim().toLowerCase();
  if (call === "not reachable" || call === "number does not connect") {
    return true;
  }

  if (call === "call successful") {
    return Boolean(record.scheduled_date && record.scheduled_date.trim() !== "");
  }

  return false;
}

export function HouseholdTable({
  initialRecords,
  startIndex = 0,
  userRole = null,
}: {
  initialRecords: HouseholdRecord[];
  startIndex?: number;
  userRole?: string | null;
}) {
  const [records, setRecords] = useState<HouseholdRecord[]>(initialRecords);
  const [drafts, setDrafts] = useState<Record<string, HouseholdDraft>>(() =>
    createDrafts(initialRecords)
  );

  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ONLY Call Center role can make changes. Admins, Data Team, and other roles have read-only access.
  const canEdit = userRole === "call_center";
  const isDataTeam = userRole === "data_team";

  // Synchronize component with server updates
  useEffect(() => {
    setRecords(initialRecords);
    setDrafts(createDrafts(initialRecords));
  }, [initialRecords]);

  /**
   * Unlocking rules:
   * 1. Only Call Center users can edit.
   * 2. Previously completed households remain accessible.
   * 3. The first household is always accessible.
   * 4. A subsequent household is accessible only when all preceding
   *    households have been completed.
   */
  function isUnlocked(index: number): boolean {
    if (!canEdit) {
      return false;
    }

    const currentRecord = records[index];
    if (!currentRecord) {
      return false;
    }

    // Completed households remain accessible.
    if (isHouseholdComplete(currentRecord)) {
      return true;
    }

    // The first household is always unlocked.
    if (index === 0) {
      return true;
    }

    // Check all preceding households.
    for (let i = 0; i < index; i++) {
      if (!isHouseholdComplete(records[i])) {
        return false;
      }
    }

    return true;
  }

  function handleDraftChange(
    id: string,
    field: keyof HouseholdDraft,
    value: string
  ) {
    setDrafts((prev) => {
      const current = prev[id] ?? {
        call_status: "",
        scheduled_date: "",
        installation_status: "pending",
      };

      const updated = { ...current, [field]: value };

      // If call status is changed to anything other than "call successful",
      // clear the scheduled date and reset installation status.
      if (field === "call_status" && value !== "call successful") {
        updated.scheduled_date = "";
        updated.installation_status = "pending";
      }

      return {
        ...prev,
        [id]: updated,
      };
    });
  }

  async function handleSaveRow(index: number, record: HouseholdRecord) {
    if (!canEdit) return;

    if (!isUnlocked(index)) {
      setErrorMsg("Please complete the preceding households first.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const draft = drafts[record.id] ?? createDraft(record);

    if (!draft.call_status.trim()) {
      setErrorMsg(
        `Household #${startIndex + index + 1}: Please select a Call Status.`
      );
      return;
    }

    if (draft.call_status === "call successful" && !draft.scheduled_date) {
      setErrorMsg(
        `Household #${startIndex + index + 1}: Please select a Scheduled Date and Time.`
      );
      return;
    }

    setSavingId(record.id);

    try {
      const response = await fetch(`/api/households/${record.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          call_status: draft.call_status,
          scheduled_date: draft.scheduled_date || null,
          installation_status: draft.installation_status || "pending",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update household.");
      }

      const savedRecord: HouseholdRecord = {
        ...record,
        ...(result.household ?? {}),
        call_status: result.household?.call_status ?? draft.call_status,
        scheduled_date:
          result.household?.scheduled_date ?? (draft.scheduled_date || null),
        installation_status:
          result.household?.installation_status ?? draft.installation_status,
      };

      setRecords((prev) =>
        prev.map((item) => (item.id === record.id ? savedRecord : item))
      );

      setDrafts((prev) => ({
        ...prev,
        [record.id]: createDraft(savedRecord),
      }));

      const nextRow = index + 1;
      const nextUnlockedNote =
        nextRow < records.length
          ? ` Household #${startIndex + nextRow + 1} is now unlocked.`
          : "";

      setSuccessMsg(
        `Household #${startIndex + index + 1} (${
          record.respondent_name || record.household_id || "Record"
        }) saved successfully.${nextUnlockedNote}`
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Error saving household."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Role Banner */}
      {userRole === "admin" ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-foreground sm:text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              Administrator View (Read-Only):
            </span>{" "}
            Viewing in supervisor read-only mode. Entering and updating Call Status,
            Schedule Time, and Installation Status is restricted exclusively to the
            Call Center role.
          </div>
        </div>
      ) : isDataTeam ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-foreground sm:text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Data Team Privacy View:
            </span>{" "}
            Viewing in read-only mode. Confidential personal data (respondent
            names and contact numbers) are hidden from this view.
          </div>
        </div>
      ) : canEdit ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground sm:text-sm">
          <Headphones className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="font-semibold text-primary">
              Call Center Workspace (Sequential Order):
            </span>{" "}
            Update Call Status. If call is successful, select the scheduled date
            and time, then specify installation status. Preceding households
            must be completed to unlock the next household.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-muted bg-muted/20 p-3 text-xs text-foreground sm:text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <span className="font-semibold">Read-Only View:</span> Only Call
            Center users can edit Call Status, Schedule Time, and Installation
            Status.
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Household Table */}
      <div className="max-w-full overflow-x-auto rounded-md border bg-card">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b">
              {/* 1. Sr. No. */}
              <th className="px-3 py-3 text-center font-medium">Sr No.</th>

              {/* 2. Questionnaire No. */}
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                Questionnaire
              </th>

              {/* 3. Household ID */}
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                Household ID
              </th>

              {/* 4. Respondent Name */}
              {!isDataTeam && (
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  Respondent Name
                </th>
              )}

              {/* 5. Contact */}
              {!isDataTeam && (
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                  Contact
                </th>
              )}

              {/* 6. Call Status */}
              <th className="min-w-44 px-4 py-3 text-left font-semibold text-primary">
                Call Status
              </th>

              {/* 7. Schedule Time */}
              <th className="min-w-56 px-4 py-3 text-left font-semibold text-primary">
                Schedule Time
              </th>

              {/* 8. Installation Status */}
              <th className="min-w-40 px-4 py-3 text-left font-semibold text-primary">
                Installation Status
              </th>

              {/* 9. Action */}
              {canEdit && (
                <th className="px-4 py-3 text-center font-medium">Action</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {records.map((record, index) => {
              const unlocked = isUnlocked(index);
              const completed = isHouseholdComplete(record);
              const draft = drafts[record.id] ?? createDraft(record);
              const isSaving = savingId === record.id;

              // Check if household is already installed
              const isAlreadyInstalled =
                record.installation_status === "installed" ||
                draft.installation_status === "installed";

              const isCallSuccessful = draft.call_status === "call successful";
              const hasScheduledTime = Boolean(draft.scheduled_date);

              return (
                <tr
                  key={record.id}
                  className={`transition-colors ${
                    canEdit && !unlocked
                      ? "bg-muted/15 opacity-60"
                      : isAlreadyInstalled
                      ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                      : completed
                      ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* 1. Sr No. & Status Icon */}
                  <td className="px-3 py-3 text-center align-top font-mono text-xs">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold text-muted-foreground">
                        {startIndex + index + 1}
                      </span>

                      {isAlreadyInstalled ? (
                        <span
                          title="Household installed"
                          className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </span>
                      ) : completed ? (
                        <span
                          title="Household completed"
                          className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </span>
                      ) : canEdit && unlocked ? (
                        <span
                          title="Active household"
                          className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary"
                        >
                          <Unlock className="size-3" />
                        </span>
                      ) : canEdit ? (
                        <span
                          title="Locked - complete preceding households first"
                          className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        >
                          <Lock className="size-3" />
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* 2. Questionnaire */}
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <span className="font-mono text-xs text-foreground">
                      {displayValue(record.questionnaire_n)}
                    </span>
                  </td>

                  {/* 3. Household ID */}
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {displayValue(record.household_id)}
                    </span>
                  </td>

                  {/* 4. Respondent Name */}
                  {!isDataTeam && (
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <div className="font-medium text-foreground">
                        {displayValue(record.respondent_name)}
                      </div>
                    </td>
                  )}

                  {/* 5. Contact */}
                  {!isDataTeam && (
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      {record.contact_number ? (
                        <a
                          href={`tel:${record.contact_number}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                        >
                          <Phone className="size-3" />
                          {record.contact_number}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}

                  {/* 6. Call Status */}
                  <td className="px-4 py-3 align-top">
                    {canEdit ? (
                      <div className="space-y-1">
                        <select
                          aria-label={`Call status for household ${
                            startIndex + index + 1
                          }`}
                          disabled={
                            !unlocked || isSaving || isAlreadyInstalled
                          }
                          value={draft.call_status}
                          onChange={(e) =>
                            handleDraftChange(
                              record.id,
                              "call_status",
                              e.target.value
                            )
                          }
                          className="h-9 w-full min-w-40 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                        >
                          <option value="" disabled>
                            Select Call Status
                          </option>
                          {CALL_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        {isAlreadyInstalled ? (
                          <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Installed (Locked)
                          </span>
                        ) : draft.call_status === "call successful" ? (
                          <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Call successful
                          </span>
                        ) : draft.call_status === "Not reachable" ? (
                          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Not reachable
                          </span>
                        ) : draft.call_status ===
                          "Number does not connect" ? (
                          <span className="inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            No connection
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium">
                        {displayValue(record.call_status)}
                      </span>
                    )}
                  </td>

                  {/* 7. Schedule Time (Appointment Scheduled) */}
                  <td className="px-4 py-3 align-top">
                    {canEdit ? (
                      <div className="space-y-1.5">
                        <input
                          type="datetime-local"
                          aria-label={`Scheduled date and time for household ${
                            startIndex + index + 1
                          }`}
                          disabled={
                            !unlocked ||
                            isSaving ||
                            !isCallSuccessful ||
                            isAlreadyInstalled
                          }
                          value={draft.scheduled_date}
                          onChange={(e) =>
                            handleDraftChange(
                              record.id,
                              "scheduled_date",
                              e.target.value
                            )
                          }
                          className="h-9 w-full min-w-48 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                        />

                        {isAlreadyInstalled ? (
                          <span className="text-[11px] text-muted-foreground">
                            Scheduled time locked
                          </span>
                        ) : !isCallSuccessful ? (
                          <span className="text-[11px] text-muted-foreground">
                            Requires Call successful
                          </span>
                        ) : draft.scheduled_date ? (
                          <button
                            type="button"
                            disabled={!unlocked || isSaving}
                            onClick={() =>
                              handleDraftChange(
                                record.id,
                                "scheduled_date",
                                ""
                              )
                            }
                            className="text-[11px] text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Clear schedule time
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400">
                            Pick date & time
                          </span>
                        )}
                      </div>
                    ) : record.scheduled_date ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        <span>
                          {formatDisplayDateTime(record.scheduled_date)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* 8. Installation Status */}
                  <td className="px-4 py-3 align-top">
                    {canEdit ? (
                      <div className="space-y-1">
                        <select
                          aria-label={`Installation status for household ${
                            startIndex + index + 1
                          }`}
                          disabled={
                            !unlocked ||
                            isSaving ||
                            (!hasScheduledTime && !isAlreadyInstalled)
                          }
                          value={draft.installation_status}
                          onChange={(e) =>
                            handleDraftChange(
                              record.id,
                              "installation_status",
                              e.target.value
                            )
                          }
                          className="h-9 w-full min-w-36 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                        >
                          {INSTALLATION_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {draft.installation_status === "installed" ? (
                          <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Installed
                          </span>
                        ) : draft.installation_status === "rejected" ? (
                          <span className="inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Pending
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        {record.installation_status === "installed" ? (
                          <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Installed
                          </span>
                        ) : record.installation_status === "rejected" ? (
                          <span className="inline-block rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium">
                            {displayValue(record.installation_status) ||
                              "Pending"}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 9. Action Button */}
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-center align-top">
                      <button
                        type="button"
                        disabled={!unlocked || isSaving}
                        onClick={() => handleSaveRow(index, record)}
                        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all ${
                          !unlocked
                            ? "cursor-not-allowed border bg-muted text-muted-foreground opacity-50"
                            : isAlreadyInstalled
                            ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                            : completed
                            ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                        }`}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Saving...
                          </>
                        ) : isAlreadyInstalled ? (
                          <>
                            <Check className="size-3.5" />
                            Saved
                          </>
                        ) : completed ? (
                          <>
                            <CheckCircle2 className="size-3.5" />
                            Update
                          </>
                        ) : (
                          <>
                            <Save className="size-3.5" />
                            Save
                          </>
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
