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

type HouseholdDraft = {
  call_status: string;
  scheduled_date: string;
};

const CALL_STATUS_OPTIONS = [
  { value: "Not called", label: "Not called" },
  { value: "Called", label: "Called" },
  { value: "Busy", label: "Busy" },
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
  {
    key: "household_size",
    label: "Size",
    sensitive: false,
  },
  {
    key: "preferred_date",
    label: "Preferred Date",
    sensitive: false,
  },
  {
    key: "preferred_time",
    label: "Preferred Time",
    sensitive: false,
  },
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
  {
    key: "created_at",
    label: "Created At",
    sensitive: false,
  },
] as const;

function createDraft(record: HouseholdRecord): HouseholdDraft {
  return {
    call_status: record.call_status ?? "",
    scheduled_date: record.scheduled_date
      ? record.scheduled_date.slice(0, 10)
      : "",
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

/**
 * Completion rules:
 * - A Call Status must be selected.
 * - A scheduled date is optional.
 *
 * Because appointment_status must remain unchanged, this component
 * does not use it to determine whether an appointment is scheduled.
 *
 * Note: this means saving a Call Status without a date completes the
 * row as well. A separate database field is needed if you want to
 * distinguish "not scheduled" from "not yet decided".
 */
function isHouseholdComplete(record: HouseholdRecord): boolean {
  return Boolean(record.call_status?.trim());
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
  const [records, setRecords] =
    useState<HouseholdRecord[]>(initialRecords);

  const [drafts, setDrafts] = useState<
    Record<string, HouseholdDraft>
  >(() => createDrafts(initialRecords));

  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Only Call Center users can edit call status and scheduled date.
  const canEdit = userRole === "call_center";
  const isDataTeam = userRole === "data_team";

  const visibleAdditionalColumns = ALL_ADDITIONAL_COLUMNS.filter(
    (column) => !(isDataTeam && column.sensitive)
  );

  useEffect(() => {
    setRecords(initialRecords);
    setDrafts(createDrafts(initialRecords));
  }, [initialRecords]);

  function isUnlocked(index: number): boolean {
    if (!canEdit) {
      return false;
    }

    // The first household is always available.
    if (index === 0) {
      return true;
    }

    // Every preceding household must have a saved Call Status.
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
    setDrafts((previous) => {
      const current = previous[id] ?? {
        call_status: "",
        scheduled_date: "",
      };

      return {
        ...previous,
        [id]: {
          ...current,
          [field]: value,
        },
      };
    });
  }

  async function handleSaveRow(
    index: number,
    record: HouseholdRecord
  ) {
    if (!canEdit) {
      return;
    }

    if (!isUnlocked(index)) {
      setErrorMsg(
        "Please complete the preceding households first."
      );
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

    setSavingId(record.id);

    try {
      const response = await fetch(`/api/households/${record.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },

        // IMPORTANT:
        // appointment_status is intentionally not included.
        body: JSON.stringify({
          call_status: draft.call_status,
          scheduled_date: draft.scheduled_date || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to update household."
        );
      }

      // Use the returned record where available.
      // Preserve appointment_status exactly as it was in the database.
      const savedRecord: HouseholdRecord = {
        ...record,
        ...(result.household ?? {}),
        appointment_status: record.appointment_status,
        call_status:
          result.household?.call_status ?? draft.call_status,
        scheduled_date:
          result.household?.scheduled_date ??
          (draft.scheduled_date || null),
      };

      setRecords((previous) =>
        previous.map((item) =>
          item.id === record.id
            ? {
                ...item,
                ...savedRecord,
                appointment_status: item.appointment_status,
              }
            : item
        )
      );

      setDrafts((previous) => ({
        ...previous,
        [record.id]: createDraft(savedRecord),
      }));

      const nextRow = index + 1;

      const nextUnlockedNote =
        nextRow < records.length
          ? ` Household #${startIndex + nextRow + 1} is now unlocked.`
          : "";

      setSuccessMsg(
        `Household #${startIndex + index + 1} (${
          record.respondent_name ||
          record.household_id ||
          "Record"
        }) saved successfully.${nextUnlockedNote}`
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Error saving household."
      );
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
            Viewing in read-only mode. Confidential personal data,
            including respondent names, contact phone numbers, and
            street addresses, are hidden from this view.
          </div>
        </div>
      ) : canEdit ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground sm:text-sm">
          <Headphones className="mt-0.5 size-4 shrink-0 text-primary" />

          <div>
            <span className="font-semibold text-primary">
              Call Center Workspace:
            </span>{" "}
            Update Call Status and, when applicable, select a
            Scheduled Date. Appointment Status remains unchanged.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-muted bg-muted/20 p-3 text-xs text-foreground sm:text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

          <div>
            <span className="font-semibold">Read-Only View:</span>{" "}
            Only Call Center users can edit Call Status and Scheduled
            Date. Appointment Status displays its original database
            value.
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

      {/* Table */}
      <div className="max-w-full overflow-x-auto rounded-md border bg-card">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-3 text-center font-medium">
                #
              </th>

              <th className="px-4 py-3 text-left font-medium">
                Household ID
              </th>

              {!isDataTeam && (
                <th className="px-4 py-3 text-left font-medium">
                  Respondent Name
                </th>
              )}

              {!isDataTeam && (
                <th className="px-4 py-3 text-left font-medium">
                  Contact
                </th>
              )}

              <th className="min-w-40 px-4 py-3 text-left font-semibold text-primary">
                Call Status
              </th>

              <th className="min-w-48 px-4 py-3 text-left font-semibold text-primary">
                Appointment Status
              </th>

              <th className="min-w-48 px-4 py-3 text-left font-semibold text-primary">
                Scheduled Date
              </th>

              {canEdit && (
                <th className="px-4 py-3 text-center font-medium">
                  Action
                </th>
              )}

              {visibleAdditionalColumns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap px-4 py-3 text-left font-medium"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {records.map((record, index) => {
              const unlocked = isUnlocked(index);
              const completed = isHouseholdComplete(record);
              const draft =
                drafts[record.id] ?? createDraft(record);
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
                  {/* Serial Number */}
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

                  {/* Household ID and Questionnaire Number */}
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <div className="font-mono text-xs text-foreground">
                      {displayValue(record.household_id)}
                    </div>

                    {record.questionnaire_n && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Q#: {record.questionnaire_n}
                      </div>
                    )}
                  </td>

                  {/* Respondent Name */}
                  {!isDataTeam && (
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <div className="font-medium text-foreground">
                        {displayValue(record.respondent_name)}
                      </div>
                    </td>
                  )}

                  {/* Contact */}
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
                        <span className="text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                  )}

                  {/* Call Status */}
                  <td className="px-4 py-3 align-top">
                    {canEdit ? (
                      <div className="space-y-1">
                        <select
                          aria-label={`Call status for household ${startIndex + index + 1}`}
                          disabled={!unlocked || isSaving}
                          value={draft.call_status}
                          onChange={(event) =>
                            handleDraftChange(
                              record.id,
                              "call_status",
                              event.target.value
                            )
                          }
                          className="h-9 w-full min-w-36 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
                        >
                          <option value="" disabled>
                            Select Call Status
                          </option>

                          {CALL_STATUS_OPTIONS.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
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
                      <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium">
                        {displayValue(record.call_status)}
                      </span>
                    )}
                  </td>

                  {/* Appointment Status: display the original database value */}
                  <td className="px-4 py-3 align-top">
                    <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium">
                      {displayValue(record.appointment_status)}
                    </span>
                  </td>

                  {/* Scheduled Date: scheduling is handled in this column */}
                  <td className="px-4 py-3 align-top">
                    {canEdit ? (
                      <div className="min-w-44 space-y-2">
                        {draft.scheduled_date ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <Calendar className="size-3.5 text-muted-foreground" />
                            Scheduled
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not scheduled
                          </span>
                        )}

                        <input
                          type="date"
                          aria-label={`Scheduled date for household ${startIndex + index + 1}`}
                          disabled={!unlocked || isSaving}
                          value={draft.scheduled_date}
                          onChange={(event) =>
                            handleDraftChange(
                              record.id,
                              "scheduled_date",
                              event.target.value
                            )
                          }
                          className="h-9 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
                        />

                        {draft.scheduled_date && (
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
                            className="text-xs text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Clear scheduled date
                          </button>
                        )}
                      </div>
                    ) : record.scheduled_date ? (
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Calendar className="size-3.5 text-muted-foreground" />
                          Scheduled
                        </span>

                        <span className="pl-[22px] text-muted-foreground">
                          {record.scheduled_date.slice(0, 10)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>

                  {/* Save Button: Call Center Only */}
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-center align-top">
                      <button
                        type="button"
                        disabled={!unlocked || isSaving}
                        onClick={() =>
                          handleSaveRow(index, record)
                        }
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

                  {/* Additional Columns */}
                  {visibleAdditionalColumns.map((column) => {
                    const value = displayValue(record[column.key]);

                    return (
                      <td
                        key={column.key}
                        title={value}
                        className="max-w-64 whitespace-normal break-words px-4 py-3 align-top text-xs text-muted-foreground"
                      >
                        {value}
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