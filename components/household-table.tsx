"use client";

import { useState } from "react";
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
} from "lucide-react";

export type HouseholdRecord = {
  id: string;
  questionnaire_n?: string | null;
  household_id?: string | null;
  respondent_name?: string | null;
  contact_number?: string | null;
  telephone_number?: string | null;
  call_status?: string | null;
  appointment_status?: string | null;
  scheduled_date?: string | null;
  city_town_village_and_region?: string | null;
  household_address_or_nearest_landmark?: string | null;
  household_size?: string | number | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  preferred_time_specific_time?: string | null;
  preferred_contact_person?: string | null;
  full_address_or_landmark?: string | null;
  special_instructions_for_field_team?: string | null;
  confirmation_respondent_name?: string | null;
  confirmation_address_or_location?: string | null;
  preferred_appointment_time?: string | null;
  is_confirmation_correct?: string | null;
  project_consent_and_device_acknowledgement?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

const CALL_STATUS_OPTIONS = [
  { value: "Not called", label: "Not called" },
  { value: "Called", label: "Called" },
  { value: "Busy", label: "Busy" },
] as const;

const APPOINTMENT_STATUS_OPTIONS = [
  { value: "not scheduled", label: "Not Scheduled" },
  { value: "scheduled", label: "Scheduled" },
] as const;

const ALL_ADDITIONAL_COLUMNS = [
  {
    key: "city_town_village_and_region",
    label: "City / Town / Village",
    sensitive: false,
  },
  {
    key: "household_address_or_nearest_landmark",
    label: "Address / Landmark",
    sensitive: true,
  },
  { key: "household_size", label: "Size", sensitive: false },
  { key: "preferred_date", label: "Preferred Date", sensitive: false },
  { key: "preferred_time", label: "Preferred Time", sensitive: false },
  {
    key: "preferred_time_specific_time",
    label: "Preferred Specific Time",
    sensitive: false,
  },
  {
    key: "preferred_contact_person",
    label: "Preferred Contact Person",
    sensitive: true,
  },
  {
    key: "special_instructions_for_field_team",
    label: "Special Instructions",
    sensitive: true,
  },
  { key: "created_at", label: "Created At", sensitive: false },
] as const;

function isHouseholdComplete(record: {
  call_status?: string | null;
  appointment_status?: string | null;
  scheduled_date?: string | null;
}): boolean {
  if (!record.call_status) return false;
  if (!record.appointment_status) return false;

  const appt = record.appointment_status.toLowerCase();
  if (appt === "scheduled") {
    return Boolean(record.scheduled_date && record.scheduled_date.trim() !== "");
  }
  if (appt === "not scheduled") {
    return true;
  }

  return false;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
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

  // Call Center users and Admins have editing permissions.
  // Data Team and other roles have read-only access.
  const canEdit = userRole === "call_center" || userRole === "admin";
  const isDataTeam = userRole === "data_team";

  // Visible additional columns (sensitive address & contact person hidden for data_team)
  const visibleAdditionalColumns = ALL_ADDITIONAL_COLUMNS.filter(
    (col) => !(isDataTeam && col.sensitive)
  );

  // Draft edits keyed by record id
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        call_status: string;
        appointment_status: string;
        scheduled_date: string;
      }
    >
  >(() => {
    const map: Record<
      string,
      {
        call_status: string;
        appointment_status: string;
        scheduled_date: string;
      }
    > = {};

    for (const r of initialRecords) {
      let normAppt = r.appointment_status ?? "";
      if (normAppt !== "scheduled" && normAppt !== "not scheduled") {
        normAppt = "";
      }
      map[r.id] = {
        call_status: r.call_status ?? "",
        appointment_status: normAppt,
        scheduled_date: r.scheduled_date
          ? r.scheduled_date.slice(0, 10)
          : "",
      };
    }
    return map;
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if row index i is unlocked
  function isUnlocked(index: number): boolean {
    if (!canEdit) return false;
    if (index === 0) return true;
    for (let j = 0; j < index; j++) {
      if (!isHouseholdComplete(records[j])) {
        return false;
      }
    }
    return true;
  }

  function handleDraftChange(
    id: string,
    field: "call_status" | "appointment_status" | "scheduled_date",
    value: string
  ) {
    setDrafts((prev) => {
      const current = prev[id] ?? {
        call_status: "",
        appointment_status: "",
        scheduled_date: "",
      };
      const updated = { ...current, [field]: value };
      if (field === "appointment_status" && value !== "scheduled") {
        updated.scheduled_date = "";
      }
      return { ...prev, [id]: updated };
    });
  }

  async function handleSaveRow(index: number, record: HouseholdRecord) {
    if (!canEdit) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const draft = drafts[record.id] ?? {
      call_status: "",
      appointment_status: "",
      scheduled_date: "",
    };

    if (!draft.call_status) {
      setErrorMsg(`Household #${startIndex + index + 1}: Please select a Call Status.`);
      return;
    }

    if (!draft.appointment_status) {
      setErrorMsg(
        `Household #${startIndex + index + 1}: Please select an Appointment Status.`
      );
      return;
    }

    if (draft.appointment_status === "scheduled" && !draft.scheduled_date) {
      setErrorMsg(
        `Household #${startIndex + index + 1}: Please pick a date for the scheduled appointment.`
      );
      return;
    }

    setSavingId(record.id);

    try {
      const response = await fetch(`/api/households/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_status: draft.call_status,
          appointment_status: draft.appointment_status,
          scheduled_date: draft.scheduled_date || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update household.");
      }

      // Update state for this record
      setRecords((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                call_status: draft.call_status,
                appointment_status: draft.appointment_status,
                scheduled_date: draft.scheduled_date || null,
              }
            : r
        )
      );

      const nextRow = index + 1;
      const nextUnlockedNote =
        nextRow < records.length
          ? ` Household #${startIndex + nextRow + 1} is now unlocked.`
          : "";

      setSuccessMsg(
        `Household #${startIndex + index + 1} (${
          record.respondent_name || record.household_id || "Record"
        }) saved to Supabase successfully!${nextUnlockedNote}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error saving household.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Role Banner */}
      {isDataTeam ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-foreground sm:text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Data Team Privacy View:
            </span>{" "}
            Viewing in read-only mode. Confidential personal data (respondent names,
            contact phone numbers, and street addresses) are hidden from this view.
          </div>
        </div>
      ) : canEdit ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground sm:text-sm">
          <Headphones className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="font-semibold text-primary">
              Call Center Workspace (Sequential Order):
            </span>{" "}
            Fill and save <span className="font-medium">Call Status</span> and{" "}
            <span className="font-medium">Appointment Status</span> for the active household
            to unlock the next one. Saved information persists directly to Supabase.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-muted bg-muted/20 p-3 text-xs text-foreground sm:text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <span className="font-semibold">Read-Only View:</span> Insertion and editing of
            call and appointment status is restricted to the Call Center role.
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success alert */}
      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Table Container with Horizontal Scroll */}
      <div className="max-w-full overflow-x-auto rounded-md border bg-card">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-3 text-center font-medium">#</th>

              {/* Household ID Column: visible to all roles */}
              <th className="px-4 py-3 text-left font-medium">Household ID</th>

              {/* Respondent Name Column: hidden for Data Team */}
              {!isDataTeam && (
                <th className="px-4 py-3 text-left font-medium">Respondent Name</th>
              )}

              {/* Contact Column: Completely hidden for data_team */}
              {!isDataTeam && (
                <th className="px-4 py-3 text-left font-medium">Contact</th>
              )}

              {/* Call Status Column */}
              <th className="min-w-40 px-4 py-3 text-left font-semibold text-primary">
                Call Status
              </th>

              {/* Appointment Status & Date Column */}
              <th className="min-w-60 px-4 py-3 text-left font-semibold text-primary">
                Appointment Status & Date
              </th>

              {/* Action Column: only for Call Center / Admin */}
              {canEdit && (
                <th className="px-4 py-3 text-center font-medium">Action</th>
              )}

              {/* Additional Columns (with address hidden for data_team) */}
              {visibleAdditionalColumns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-3 text-left font-medium"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {records.map((record, index) => {
              const unlocked = isUnlocked(index);
              const completed = isHouseholdComplete(record);
              const draft = drafts[record.id] ?? {
                call_status: "",
                appointment_status: "",
                scheduled_date: "",
              };
              const isSaving = savingId === record.id;

              return (
                <tr
                  key={record.id}
                  className={`transition-colors ${
                    canEdit && !unlocked
                      ? "bg-muted/15 opacity-60"
                      : completed
                      ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* Sequence Number & Status Icon */}
                  <td className="px-3 py-3 text-center align-top font-mono text-xs">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold text-muted-foreground">
                        {startIndex + index + 1}
                      </span>
                      {completed ? (
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

                  {/* Household ID Column */}
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <div className="font-mono text-xs text-foreground">
                      {record.household_id || "—"}
                    </div>
                    {record.questionnaire_n && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Q#: {record.questionnaire_n}
                      </div>
                    )}
                  </td>

                  {/* Respondent Name Column: hidden for Data Team */}
                  {!isDataTeam && (
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <div className="font-medium text-foreground">
                        {record.respondent_name || "—"}
                      </div>
                    </td>
                  )}

                  {/* Contact Number (Hidden for data_team) */}
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

                  {/* Call Status Column */}
                  <td className="px-4 py-3 align-top">
                    {canEdit ? (
                      <div className="space-y-1">
                        <select
                          aria-label={`Call status for household ${
                            startIndex + index + 1
                          }`}
                          disabled={!unlocked || isSaving}
                          value={draft.call_status}
                          onChange={(e) =>
                            handleDraftChange(
                              record.id,
                              "call_status",
                              e.target.value
                            )
                          }
                          className="h-9 w-full min-w-36 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                        >
                          <option value="" disabled>
                            Select Call Status
                          </option>
                          {CALL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {draft.call_status === "Called" && (
                          <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Called
                          </span>
                        )}
                        {draft.call_status === "Busy" && (
                          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Busy
                          </span>
                        )}
                        {draft.call_status === "Not called" && (
                          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Not called
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        {record.call_status ? (
                          <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium">
                            {record.call_status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Appointment Status & Scheduled Date Column */}
                  <td className="px-4 py-3 align-top">
                    {canEdit ? (
                      <div className="space-y-2">
                        <select
                          aria-label={`Appointment status for household ${
                            startIndex + index + 1
                          }`}
                          disabled={!unlocked || isSaving}
                          value={draft.appointment_status}
                          onChange={(e) =>
                            handleDraftChange(
                              record.id,
                              "appointment_status",
                              e.target.value
                            )
                          }
                          className="h-9 w-full min-w-44 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                        >
                          <option value="" disabled>
                            Select Appointment Status
                          </option>
                          {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {/* Date Picker shown only if Scheduled */}
                        {draft.appointment_status === "scheduled" && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                            <input
                              type="date"
                              aria-label={`Scheduled date for household ${
                                startIndex + index + 1
                              }`}
                              disabled={!unlocked || isSaving}
                              value={draft.scheduled_date}
                              onChange={(e) =>
                                handleDraftChange(
                                  record.id,
                                  "scheduled_date",
                                  e.target.value
                                )
                              }
                              className="h-8 w-full min-w-36 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div>
                          {record.appointment_status === "scheduled" ? (
                            <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Scheduled
                            </span>
                          ) : record.appointment_status === "not scheduled" ? (
                            <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium">
                              Not Scheduled
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        {record.scheduled_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {record.scheduled_date.slice(0, 10)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Action Button (Visible only to Call Center / Admin) */}
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-center align-top">
                      <button
                        type="button"
                        disabled={!unlocked || isSaving}
                        onClick={() => handleSaveRow(index, record)}
                        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all ${
                          !unlocked
                            ? "cursor-not-allowed border bg-muted text-muted-foreground opacity-50"
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

                  {/* Visible Additional Columns */}
                  {visibleAdditionalColumns.map((col) => {
                    const val = displayValue(record[col.key]);
                    return (
                      <td
                        key={col.key}
                        title={val}
                        className="max-w-64 whitespace-normal break-words px-4 py-3 align-top text-xs text-muted-foreground"
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
