"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Shield,
  Users,
  Search,
  Calendar,
  MapPin,
  Clock,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ─────────────────────── Types ─────────────────────── */

export type PanelMemberDetail = {
  member_code?: string | null;
  gender?: string | null;
  age?: number | null;
};

export type PanelUpdateRow = {
  id: string;
  household_id?: string | null;
  hhid: string;
  region?: string | null;
  current_status: string;
  mos?: number | null;
  sec?: number | null;
  environment?: string | null;
  is_rejected?: boolean | null;
  recorded_at?: string | null;
  member_count?: number | null;
  members?: PanelMemberDetail[];
};

type SortField = "recorded_at" | "hhid" | "region" | "sec" | "mos" | "member_count";
type SortDir = "asc" | "desc";

/* ─────────────────────── Constants ─────────────────────── */

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  RETIRED: {
    label: "Retired",
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700",
    icon: <Archive className="size-3" />,
  },
  DEINSTALLED: {
    label: "Deinstalled",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
    icon: <Trash2 className="size-3" />,
  },
  UNASSIGNED: {
    label: "Unassigned",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
    icon: <Clock className="size-3" />,
  },
};

/* ─────────────────────── Helpers ─────────────────────── */

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function genderSummary(members: PanelMemberDetail[]) {
  const m = members.filter((x) => x.gender?.toUpperCase() === "M" || x.gender?.toLowerCase() === "male").length;
  const f = members.filter((x) => x.gender?.toUpperCase() === "F" || x.gender?.toLowerCase() === "female").length;
  const other = members.length - m - f;
  const parts: string[] = [];
  if (m) parts.push(`${m}M`);
  if (f) parts.push(`${f}F`);
  if (other) parts.push(`${other}?`);
  return parts.join(" · ") || "—";
}

function ageSummary(members: PanelMemberDetail[]) {
  const ages = members.map((x) => x.age).filter((a): a is number => a !== null && a !== undefined && !isNaN(a));
  if (!ages.length) return "—";
  const avg = Math.round(ages.reduce((s, a) => s + a, 0) / ages.length);
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  return `${min}–${max} (avg ${avg})`;
}

/* ─────────────────────── Sub-components ─────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none ${meta.color} ${meta.bg}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function ExpandedMemberRow({ row }: { row: PanelUpdateRow }) {
  const members = row.members ?? [];
  if (!members.length) {
    return (
      <tr>
        <td colSpan={8} className="px-6 py-4 text-xs text-muted-foreground italic bg-muted/20">
          No individual member records found for this household.
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={8} className="bg-muted/30 px-6 py-4 border-b">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Household Members Profile ({members.length})
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              HHID: {row.hhid} • Region: {row.region || "Unknown"}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Member Code</th>
                  <th className="text-left px-3 py-2">Gender</th>
                  <th className="text-left px-3 py-2">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m: PanelMemberDetail, idx: number) => {
                  const isMale = m.gender?.toUpperCase() === "M" || m.gender?.toLowerCase() === "male";
                  const isFemale = m.gender?.toUpperCase() === "F" || m.gender?.toLowerCase() === "female";
                  return (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-medium text-foreground">{m.member_code ?? "—"}</td>
                      <td className="px-3 py-2">
                        {isMale ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            <span className="size-1 rounded-full bg-blue-600" /> Male
                          </span>
                        ) : isFemale ? (
                          <span className="inline-flex items-center gap-1 rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                            <span className="size-1 rounded-full bg-teal-600" /> Female
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{m.gender || "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-foreground">{m.age ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────────────── Main Page ─────────────────────── */

export default function PanelUpdatesPage() {
  const [rows, setRows] = useState<PanelUpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("recorded_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [envFilter, setEnvFilter] = useState<string>("ALL");

  const loadUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPanelUpdates();
      const data = Array.isArray(res?.rows) ? res.rows : [];
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load panel updates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUpdates();
  }, []);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const retired = rows.filter((r) => r.current_status === "RETIRED");
    const totalMembersAffected = rows.reduce(
      (sum, r) => sum + (r.member_count ?? r.members?.length ?? 0),
      0
    );
    const uniqueRegions = new Set(rows.map((r) => r.region).filter(Boolean)).size;
    const prodCount = rows.filter((r) => r.environment?.toUpperCase() === "PROD").length;

    return {
      total: rows.length,
      retired: retired.length,
      membersAffected: totalMembersAffected,
      uniqueRegions,
      prodCount,
    };
  }, [rows]);

  /* ── Filtered + Sorted ── */
  const displayRows = useMemo(() => {
    let filtered = rows;

    if (statusFilter !== "ALL") {
      filtered = filtered.filter((r) => r.current_status === statusFilter);
    }

    if (envFilter !== "ALL") {
      filtered = filtered.filter((r) => r.environment?.toUpperCase() === envFilter.toUpperCase());
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.hhid.toLowerCase().includes(q) ||
          (r.region ?? "").toLowerCase().includes(q) ||
          String(r.sec ?? "").includes(q) ||
          String(r.mos ?? "").includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sortField) {
        case "recorded_at":
          av = a.recorded_at ? new Date(a.recorded_at).getTime() : 0;
          bv = b.recorded_at ? new Date(b.recorded_at).getTime() : 0;
          break;
        case "hhid":
          av = a.hhid ?? "";
          bv = b.hhid ?? "";
          break;
        case "region":
          av = a.region ?? "";
          bv = b.region ?? "";
          break;
        case "sec":
          av = a.sec ?? 0;
          bv = b.sec ?? 0;
          break;
        case "mos":
          av = a.mos ?? 0;
          bv = b.mos ?? 0;
          break;
        case "member_count":
          av = a.member_count ?? a.members?.length ?? 0;
          bv = b.member_count ?? b.members?.length ?? 0;
          break;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, statusFilter, envFilter, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="size-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="size-3 text-primary" /> : <ChevronDown className="size-3 text-primary" />;
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Panel Updates (Retired Households)
            </h1>
            <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-500/20">
              RETIRED Tracking
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Historical lifecycle logs of retired panel households and corresponding member details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadUpdates()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold text-card-foreground shadow-sm hover:bg-accent transition-colors disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Updates
        </button>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-semibold">Unable to load panel updates.</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {/* ── Metric Summary Cards ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Card className="w-[160px] sm:w-[175px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Records</CardTitle>
            <Archive className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">{stats.total.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Logged in updates</p>
          </CardContent>
        </Card>

        <Card className="w-[160px] sm:w-[175px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Retired Status</CardTitle>
            <Shield className="size-3.5 text-slate-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
              {stats.retired.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Status = RETIRED</p>
          </CardContent>
        </Card>

        <Card className="w-[160px] sm:w-[175px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Members Logged</CardTitle>
            <Users className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">
              {stats.membersAffected.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Individual profiles</p>
          </CardContent>
        </Card>

        <Card className="w-[160px] sm:w-[175px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Regions</CardTitle>
            <MapPin className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">{stats.uniqueRegions}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Armenian regions</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Table Card ── */}
      {loading ? (
        <div className="flex min-h-60 flex-col items-center justify-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading updates from RDS...</p>
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search & Environment Filters */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search HHID, region, SEC, MOS…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 w-full rounded-lg border bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 rounded-lg border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Statuses ({rows.length})</option>
                  <option value="RETIRED">Retired Only ({stats.retired})</option>
                  <option value="DEINSTALLED">Deinstalled</option>
                  <option value="UNASSIGNED">Unassigned</option>
                </select>

                <select
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value)}
                  className="h-8 rounded-lg border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Environments</option>
                  <option value="PROD">PROD</option>
                  <option value="DEV">DEV</option>
                </select>
              </div>

              <span className="text-xs text-muted-foreground font-mono self-end sm:self-auto">
                Showing {displayRows.length} of {rows.length} records
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {displayRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <CheckCircle2 className="size-8 text-muted-foreground/60" />
                <p className="text-sm font-medium">No records found</p>
                <p className="text-xs">{search ? "Try adjusting your search criteria." : "No households logged in this status."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <tr>
                      <th className="w-8 px-2 py-3" />
                      {(
                        [
                          { field: "hhid" as SortField, label: "HHID" },
                          { field: "region" as SortField, label: "Region" },
                          { field: "sec" as SortField, label: "SEC" },
                          { field: "mos" as SortField, label: "MOS" },
                          { field: "member_count" as SortField, label: "Members" },
                          { field: "recorded_at" as SortField, label: "Recorded At" },
                        ] as { field: SortField; label: string }[]
                      ).map((col) => (
                        <th
                          key={col.field}
                          className="px-3.5 py-3 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors"
                          onClick={() => handleSort(col.field)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            <SortIcon field={col.field} />
                          </span>
                        </th>
                      ))}
                      <th className="px-3.5 py-3 font-semibold whitespace-nowrap">Status</th>
                      <th className="px-3.5 py-3 font-semibold whitespace-nowrap">Env</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayRows.map((row) => {
                      const memberCount = row.member_count ?? row.members?.length ?? 0;
                      const members = row.members ?? [];
                      const isExpanded = expandedId === row.id;

                      return (
                        <tr key={row.id} className="contents">
                          <tr
                            className={`group align-middle transition-colors ${
                              isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                            }`}
                          >
                            {/* Expand toggle */}
                            <td className="px-2 py-3 w-8 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title={isExpanded ? "Collapse" : "Expand members"}
                              >
                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </button>
                            </td>
                            <td className="px-3.5 py-3 font-mono font-semibold text-xs tracking-wide text-foreground">
                              {row.hhid}
                            </td>
                            <td className="px-3.5 py-3 text-xs text-foreground font-medium">
                              {row.region || "—"}
                            </td>
                            <td className="px-3.5 py-3 text-xs text-center font-mono">
                              {row.sec ?? "—"}
                            </td>
                            <td className="px-3.5 py-3 text-xs text-center font-mono">
                              {row.mos ?? "—"}
                            </td>
                            <td className="px-3.5 py-3">
                              {memberCount > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                                    <Users className="size-3 text-muted-foreground" />
                                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                                  </span>
                                  {members.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {genderSummary(members)} • {ageSummary(members)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="size-3 text-muted-foreground" />
                                {formatDate(row.recorded_at)}
                              </span>
                            </td>
                            <td className="px-3.5 py-3">
                              <StatusBadge status={row.current_status} />
                            </td>
                            <td className="px-3.5 py-3 text-xs font-mono text-muted-foreground">
                              {row.environment || "PROD"}
                            </td>
                          </tr>

                          {/* Expanded Member Details */}
                          {isExpanded && (
                            <ExpandedMemberRow row={row} />
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer summary */}
            {displayRows.length > 0 && (
              <div className="border-t px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  Showing {displayRows.length} of {rows.length} records
                </span>
                <span className="font-mono text-[11px]">
                  RDS Database Source
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
