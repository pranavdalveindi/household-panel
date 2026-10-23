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
  Plus,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

export type HouseholdAppointment = {
  id: string;
  scheduled_at: string;
  created_by?: string | null;
  created_at?: string;
};

export type HouseholdRecord = {
  id: string;
  questionnaire_n?: string | number | null;
  household_id?: string | null;
  respondent_name?: string | null;
  contact_number?: string | null;
  telephone_number?: string | null;
  call_status?: string | null;
  appointment_call_status?: string | null;
  scheduled_date?: string | null;
  installation_status?: string | null;
  appointment_status?: string | null;
  appointments?: HouseholdAppointment[];
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type HouseholdDraft = {
  call_status: string;
  appointment_call_status: string;
  installation_status: string;
};

export const CALL_STATUS_OPTIONS = [
  { value: "call successful", label: "Call successful" },
  { value: "Not reachable", label: "Not reachable" },
  { value: "Number does not connect", label: "Number does not connect" },
] as const;

export const APPOINTMENT_CALL_STATUS_OPTIONS = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "Rejected", label: "Rejected" },
] as const;

export const INSTALLATION_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "installed", label: "Installed" },
  { value: "rejected", label: "Rejected" },
] as const;

function createDraft(record: HouseholdRecord): HouseholdDraft {
  return {
    call_status: record.call_status ?? "",
    appointment_call_status: record.appointment_call_status ?? "",
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
 * Determine if a household is considered completed for the Call Center sequential workflow.
 *
 * Rules:
 * 1. If already installed -> complete.
 * 2. If call is "Not reachable" or "Number does not connect" -> complete.
 * 3. If call is "call successful":
 *    - If appointment_call_status is "Rejected" -> complete.
 *    - If appointment_call_status is "Scheduled", requires at least 1 scheduled appointment entry.
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
    const apptStatus = record.appointment_call_status?.trim();
    if (apptStatus === "Rejected") {
      return true;
    }
    if (apptStatus === "Scheduled") {
      return Boolean(record.appointments && record.appointments.length > 0);
    }
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

  // New appointment addition state per household row
  const [addingApptId, setAddingApptId] = useState<string | null>(null);
  const [newApptTime, setNewApptTime] = useState<string>("");
  const [apptSubmitting, setApptSubmitting] = useState<boolean>(false);
  const [deletingApptId, setDeletingApptId] = useState<string | null>(null);

  // Role permissions
  const isCallCenter = userRole === "call_center";
  const isFieldExecutive = userRole === "field_executive";
  const isDataTeam = userRole === "data_team";
  const isAdmin = userRole === "admin";
  const hasActionColumn = isCallCenter || isFieldExecutive;

  // Synchronize component with server updates
  useEffect(() => {
    setRecords(initialRecords);
    setDrafts(createDrafts(initialRecords));
  }, [initialRecords]);

  /**
   * Unlocking rules for Call Center:
   * 1. Completed households remain accessible.
   * 2. The first household is always accessible.
   * 3. A subsequent household is accessible only when all preceding
   *    households have been completed.
   */
  function isUnlocked(index: number): boolean {
    if (!isCallCenter) {
      return true;
    }

    const currentRecord = records[index];
    if (!currentRecord) {
      return false;
    }

    if (isHouseholdComplete(currentRecord)) {
      return true;
    }

    if (index === 0) {
      return true;
    }

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
        appointment_call_status: "",
        installation_status: "pending",
      };

      const updated = { ...current, [field]: value };

      // If call status changed away from "call successful",
      // reset appointment_call_status to "Rejected"
      if (field === "call_status" && value !== "call successful") {
        updated.appointment_call_status = "Rejected";
      }

      return {
        ...prev,
        [id]: updated,
      };
    });
  }

  // Handle saving row changes:
  // - Call Center saves call_status and appointment_call_status
  // - Field Executive saves installation_status
  async function handleSaveRow(index: number, record: HouseholdRecord) {
    if (!hasActionColumn) return;

    if (isCallCenter && !isUnlocked(index)) {
      setErrorMsg("Please complete the preceding households first.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const draft = drafts[record.id] ?? createDraft(record);

    if (isCallCenter) {
      if (!draft.call_status.trim()) {
        setErrorMsg(
          `Household #${startIndex + index + 1}: Please select a Call Status.`
        );
        return;
      }

      if (
        draft.call_status === "call successful" &&
        !draft.appointment_call_status
      ) {
        setErrorMsg(
          `Household #${startIndex + index + 1}: Please select an Appointment Call Status (Scheduled or Rejected).`
        );
        return;
      }
    }

    setSavingId(record.id);

    try {
      const payload: Record<string, unknown> = {};

      if (isCallCenter) {
        payload.call_status = draft.call_status;
        payload.appointment_call_status =
          draft.call_status === "call successful"
            ? draft.appointment_call_status
            : "Rejected";
      } else if (isFieldExecutive) {
        payload.installation_status = draft.installation_status;
      }

      const response = await fetch(`/api/households/${record.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update household.");
      }

      const savedRecord: HouseholdRecord = {
        ...record,
        ...(result.household ?? {}),
        call_status:
          result.household?.call_status ??
          (isCallCenter ? draft.call_status : record.call_status),
        appointment_call_status:
          result.household?.appointment_call_status ??
          (isCallCenter
            ? draft.appointment_call_status
            : record.appointment_call_status),
        installation_status:
          result.household?.installation_status ??
          (isFieldExecutive
            ? draft.installation_status
            : record.installation_status),
        appointments: record.appointments ?? [],
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
        isCallCenter && nextRow < records.length
          ? ` Household #${startIndex + nextRow + 1} is now unlocked.`
          : "";

      setSuccessMsg(
        `Household #${startIndex + index + 1} (${
          record.respondent_name || record.household_id || "Record"
        }) updated successfully.${nextUnlockedNote}`
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Error saving household."
      );
    } finally {
      setSavingId(null);
    }
  }

  // Handle adding a new appointment (Call Center only)
  async function handleAddAppointment(householdId: string) {
    if (!newApptTime.trim()) {
      setErrorMsg("Please pick a valid date and time for the appointment.");
      return;
    }

    setApptSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(
        `/api/households/${householdId}/appointments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_at: newApptTime }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add appointment.");
      }

      const newAppt: HouseholdAppointment = result.appointment;

      setRecords((prev) =>
        prev.map((rec) => {
          if (rec.id === householdId) {
            const updatedAppts = [...(rec.appointments ?? []), newAppt];
            return {
              ...rec,
              appointments: updatedAppts,
            };
          }
          return rec;
        })
      );

      setAddingApptId(null);
      setNewApptTime("");
      setSuccessMsg("Scheduled appointment added successfully.");
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Error adding appointment."
      );
    } finally {
      setApptSubmitting(false);
    }
  }

  // Handle deleting an appointment (Call Center only)
  async function handleDeleteAppointment(
    householdId: string,
    appointmentId: string
  ) {
    setDeletingApptId(appointmentId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(
        `/api/households/${householdId}/appointments/${appointmentId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete appointment.");
      }

      setRecords((prev) =>
        prev.map((rec) => {
          if (rec.id === householdId) {
            return {
              ...rec,
              appointments: (rec.appointments ?? []).filter(
                (a) => a.id !== appointmentId
              ),
            };
          }
          return rec;
        })
      );

      setSuccessMsg("Appointment removed.");
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Error deleting appointment."
      );
    } finally {
      setDeletingApptId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Role Banner */}
      {isAdmin ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-foreground sm:text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              Administrator View (Read-Only):
            </span>{" "}
            Viewing in supervisor read-only mode. Updating Call Status and
            Appointment Call Status is restricted exclusively to Call Center,
            and Installation Status is updated by Field Executives.
          </div>
        </div>
      ) : isFieldExecutive ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-foreground sm:text-sm">
          <Wrench className="mt-0.5 size-4 shrink-0 text-purple-600 dark:text-purple-400" />
          <div>
            <span className="font-semibold text-purple-700 dark:text-purple-300">
              Field Executive Workspace:
            </span>{" "}
            You have permissions to update the Installation Status (Pending,
            Installed, Rejected) for households with a Scheduled appointment.
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
      ) : isCallCenter ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground sm:text-sm">
          <Headphones className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="font-semibold text-primary">
              Call Center Workspace (Sequential Order):
            </span>{" "}
            Update Call Status and Appointment Call Status. If scheduled, you
            can add multiple future appointment times. Installation Status is
            viewable in read-only mode and updated by Field Executives.
            Preceding households must be completed to unlock the next row.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-muted bg-muted/20 p-3 text-xs text-foreground sm:text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <span className="font-semibold">Read-Only View:</span> Changes are
            restricted by role.
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

              {/* 7. Appointment Call Status */}
              <th className="min-w-44 px-4 py-3 text-left font-semibold text-primary">
                Appointment Call Status
              </th>

              {/* 8. Schedule Time (Multiple Appointments) */}
              <th className="min-w-64 px-4 py-3 text-left font-semibold text-primary">
                Schedule Time
              </th>

              {/* 9. Installation Status */}
              <th className="min-w-40 px-4 py-3 text-left font-semibold text-primary">
                Installation Status
              </th>

              {/* 10. Action */}
              {hasActionColumn && (
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
                record.installation_status === "installed";

              const isCallSuccessful = draft.call_status === "call successful";
              const currentApptCallStatus = isCallCenter
                ? draft.appointment_call_status
                : record.appointment_call_status;

              // Appointment Call Status is Scheduled vs Rejected
              const isApptScheduled =
                isCallSuccessful && currentApptCallStatus === "Scheduled";
              const isApptRejected =
                !isCallSuccessful || currentApptCallStatus === "Rejected";

              // Row appointments list
              const appointments = record.appointments ?? [];

              return (
                <tr
                  key={record.id}
                  className={`transition-colors ${
                    isCallCenter && !unlocked
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
                      ) : isCallCenter && unlocked ? (
                        <span
                          title="Active household"
                          className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary"
                        >
                          <Unlock className="size-3" />
                        </span>
                      ) : isCallCenter ? (
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
                    {isCallCenter ? (
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

                  {/* 7. Appointment Call Status (New Column) */}
                  <td className="px-4 py-3 align-top">
                    {isCallCenter ? (
                      <div className="space-y-1">
                        <select
                          aria-label={`Appointment call status for household ${
                            startIndex + index + 1
                          }`}
                          disabled={
                            !unlocked ||
                            isSaving ||
                            isAlreadyInstalled ||
                            !isCallSuccessful
                          }
                          value={
                            isCallSuccessful
                              ? draft.appointment_call_status
                              : "Rejected"
                          }
                          onChange={(e) =>
                            handleDraftChange(
                              record.id,
                              "appointment_call_status",
                              e.target.value
                            )
                          }
                          className="h-9 w-full min-w-36 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                        >
                          <option value="" disabled>
                            Select Status
                          </option>
                          {APPOINTMENT_CALL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {!isCallSuccessful ? (
                          <span className="text-[10px] text-muted-foreground">
                            Requires Call successful
                          </span>
                        ) : draft.appointment_call_status === "Scheduled" ? (
                          <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Scheduled
                          </span>
                        ) : draft.appointment_call_status === "Rejected" ? (
                          <span className="inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            Rejected (Locked)
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          record.appointment_call_status === "Scheduled"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : record.appointment_call_status === "Rejected"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "border"
                        }`}
                      >
                        {displayValue(record.appointment_call_status)}
                      </span>
                    )}
                  </td>

                  {/* 8. Schedule Time (Multiple Appointments with Add button) */}
                  <td className="px-4 py-3 align-top">
                    {isApptRejected ? (
                      <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/30 px-2.5 py-2 text-center text-xs text-muted-foreground">
                        Not accessible (Appointment Rejected)
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* List of existing scheduled appointments */}
                        {appointments.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {appointments.map((appt) => (
                              <div
                                key={appt.id}
                                className="flex items-center justify-between gap-2 rounded-md border bg-background/80 px-2 py-1 text-xs"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="size-3.5 shrink-0 text-primary" />
                                  <span className="font-medium">
                                    {formatDisplayDateTime(appt.scheduled_at)}
                                  </span>
                                </div>

                                {isCallCenter && !isAlreadyInstalled && (
                                  <button
                                    type="button"
                                    title="Delete appointment"
                                    disabled={
                                      !unlocked ||
                                      deletingApptId === appt.id
                                    }
                                    onClick={() =>
                                      handleDeleteAppointment(
                                        record.id,
                                        appt.id
                                      )
                                    }
                                    className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                  >
                                    {deletingApptId === appt.id ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            No schedule time added yet.
                          </div>
                        )}

                        {/* Add Schedule Time Section for Call Center */}
                        {isCallCenter && !isAlreadyInstalled && unlocked && (
                          <div>
                            {addingApptId === record.id ? (
                              <div className="mt-2 space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-2">
                                <label className="block text-[11px] font-medium text-foreground">
                                  Select Future Date & Time:
                                </label>
                                <input
                                  type="datetime-local"
                                  aria-label="Add future scheduled appointment"
                                  value={newApptTime}
                                  onChange={(e) =>
                                    setNewApptTime(e.target.value)
                                  }
                                  className="h-8 w-full rounded border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />

                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    disabled={
                                      apptSubmitting || !newApptTime
                                    }
                                    onClick={() =>
                                      handleAddAppointment(record.id)
                                    }
                                    className="inline-flex h-7 items-center justify-center gap-1 rounded bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {apptSubmitting ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Plus className="size-3" />
                                    )}
                                    Add Time
                                  </button>

                                  <button
                                    type="button"
                                    disabled={apptSubmitting}
                                    onClick={() => {
                                      setAddingApptId(null);
                                      setNewApptTime("");
                                    }}
                                    className="inline-flex h-7 items-center justify-center rounded border px-2 text-[11px] font-medium hover:bg-muted"
                                  >
                                    <X className="size-3" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingApptId(record.id);
                                  setNewApptTime("");
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                              >
                                <Plus className="size-3" />
                                Add Schedule Time
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* 9. Installation Status */}
                  <td className="px-4 py-3 align-top">
                    {isApptRejected ? (
                      <div className="rounded border border-dashed border-muted-foreground/30 bg-muted/30 px-2.5 py-2 text-center text-xs text-muted-foreground">
                        Not accessible
                      </div>
                    ) : isFieldExecutive ? (
                      /* Field Executive: Can edit installation status */
                      <div className="space-y-1">
                        <select
                          aria-label={`Installation status for household ${
                            startIndex + index + 1
                          }`}
                          disabled={isSaving}
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
                      /* Call Center and all other roles: Read-Only view of installation status */
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

                  {/* 10. Action Button */}
                  {hasActionColumn && (
                    <td className="whitespace-nowrap px-4 py-3 text-center align-top">
                      {isCallCenter ? (
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
                      ) : isFieldExecutive ? (
                        <button
                          type="button"
                          disabled={isSaving || isApptRejected}
                          onClick={() => handleSaveRow(index, record)}
                          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all ${
                            isApptRejected
                              ? "cursor-not-allowed border bg-muted text-muted-foreground opacity-50"
                              : "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                          }`}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="size-3.5" />
                              Save Status
                            </>
                          )}
                        </button>
                      ) : null}
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
