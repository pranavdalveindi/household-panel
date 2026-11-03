"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  XCircle,
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
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
  recorded_at?: string | null;
  member_count?: number | null;
  members?: PanelMemberDetail[];
};

type StatusFilter = "ALL" | "UNASSIGNED" | "DEINSTALLED" | "RETIRED";
type SortField = "recorded_at" | "hhid" | "region" | "sec" | "mos" | "member_count";
type SortDir = "asc" | "desc";

/* ─────────────────────── Constants ─────────────────────── */

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode; slaLabel?: string }
> = {
  UNASSIGNED: {
    label: "Unassigned",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
    icon: <Clock className="size-3" />,
    slaLabel: "→ Deinstalled in",
  },
  DEINSTALLED: {
    label: "Deinstalled",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
    icon: <Trash2 className="size-3" />,
    slaLabel: "→ Retired in",
  },
  RETIRED: {
    label: "Retired",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600",
    icon: <Archive className="size-3" />,
  },
};

/* ─────────────────────── Helpers ─────────────────────── */

function formatDate(value?: string | null, short = false) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (short) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
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

function getDaysRemaining(deadline?: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysSince(recorded?: string | null): number {
  if (!recorded) return 0;
  const diff = Date.now() - new Date(recorded).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function genderSummary(members: PanelMemberDetail[]) {
  const m = members.filter((x) => x.gender?.toUpperCase() === "M").length;
  const f = members.filter((x) => x.gender?.toUpperCase() === "F").length;
  const other = members.length - m - f;
  const parts: string[] = [];
  if (m) parts.push(`${m}M`);
  if (f) parts.push(`${f}F`);
  if (other) parts.push(`${other}?`);
  return parts.join(" · ") || "—";
}

function ageSummary(members: PanelMemberDetail[]) {
  const ages = members.map((x) => x.age).filter((a): a is number => a !== null && a !== undefined);
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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${meta.color} ${meta.bg}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function SlaTag({ row }: { row: PanelUpdateRow }) {
  const days = getDaysRemaining(row.sla_deadline);
  const meta = STATUS_META[row.current_status];
  if (!meta?.slaLabel || days === null) return null;

  if (row.sla_breached || days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
        <XCircle className="size-3" /> SLA breached
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-400">
        <AlertTriangle className="size-3" /> Due today
      </span>
    );
  }
  const urgency =
    days <= 1
      ? "text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
      : days <= 3
      ? "text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20"
      : "text-muted-foreground border-border bg-muted/50";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${urgency}`}>
      <Clock className="size-2.5" />
      {meta.slaLabel} {days}d
    </span>
  );
}

function ExpandedMemberRow({ row }: { row: PanelUpdateRow }) {
  const members = row.members ?? [];
  if (!members.length) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3 text-sm text-muted-foreground italic">
          No member details available for this HHID.
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={7} className="bg-muted/30 px-6 py-4">
        <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">
            Members
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-separate border-spacing-y-0.5">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-2 py-1">#</th>
                  <th className="text-left px-2 py-1">Member Code</th>
                  <th className="text-left px-2 py-1">Gender</th>
                  <th className="text-left px-2 py-1">Age</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: PanelMemberDetail, idx: number) => (
                  <tr key={idx} className="rounded-md">
                    <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                    <td className="px-2 py-1 font-mono font-medium">{m.member_code ?? "—"}</td>
                    <td className="px-2 py-1">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          m.gender?.toUpperCase() === "M"
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                            : m.gender?.toUpperCase() === "F"
                            ? "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m.gender ?? "?"}
                      </span>
                    </td>
                    <td className="px-2 py-1">{m.age ?? "—"}</td>
                  </tr>
                ))}
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
  const [activeTab, setActiveTab] = useState<StatusFilter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("recorded_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

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
    const unassigned = rows.filter((r) => r.current_status === "UNASSIGNED");
    const deinstalled = rows.filter((r) => r.current_status === "DEINSTALLED");
    const retired = rows.filter((r) => r.current_status === "RETIRED");
    const slaBreached = rows.filter((r) => r.sla_breached || getDaysRemaining(r.sla_deadline) !== null && (getDaysRemaining(r.sla_deadline) ?? 1) < 0);
    const dueToday = rows.filter((r) => getDaysRemaining(r.sla_deadline) === 0);
    return { total: rows.length, unassigned: unassigned.length, deinstalled: deinstalled.length, retired: retired.length, slaBreached: slaBreached.length, dueToday: dueToday.length };
  }, [rows]);

  /* ── Filtered + Sorted ── */
  const displayRows = useMemo(() => {
    let filtered = rows;
    if (activeTab !== "ALL") filtered = filtered.filter((r) => r.current_status === activeTab);
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
          av = a.recorded_at ?? "";
          bv = b.recorded_at ?? "";
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
  }, [rows, activeTab, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="size-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="size-3 text-primary" /> : <ChevronDown className="size-3 text-primary" />;
  };

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: stats.total },
    { key: "UNASSIGNED", label: "Unassigned", count: stats.unassigned },
    { key: "DEINSTALLED", label: "Deinstalled", count: stats.deinstalled },
    { key: "RETIRED", label: "Retired", count: stats.retired },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="size-5 text-red-500" />
            Panel Updates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Households removed from active stages — track lifecycle, SLA deadlines and member details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadUpdates()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Unable to load panel updates.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* ── Table Card ── */}
      {loading ? (
        <div className="flex min-h-60 flex-col items-center justify-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading panel updates...</p>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3 border-b">
            {/* Tabs + Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.key
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        activeTab === tab.key
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search HHID, region, SEC, MOSR…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-md border bg-transparent px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-56"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {displayRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="text-sm font-medium">No records found</p>
                <p className="text-xs">{search ? "Try a different search." : "No households in this status."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {/* Expand toggle */}
                      <th className="w-8 px-2 py-2.5" />
                      {(
                        [
                          { field: "hhid" as SortField, label: "HHID" },
                          { field: "region" as SortField, label: "Region" },
                          { field: "sec" as SortField, label: "SEC" },
                          { field: "mos" as SortField, label: "MOSR" },
                          { field: "member_count" as SortField, label: "Members" },
                        ] as { field: SortField; label: string }[]
                      ).map((col) => (
                        <th
                          key={col.field}
                          className="px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort(col.field)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            <SortIcon field={col.field} />
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayRows.map((row) => {
                      const memberCount = row.member_count ?? row.members?.length ?? 0;
                      const members = row.members ?? [];
                      const isExpanded = expandedId === row.id;

                      return (
                        <>
                          <tr
                            key={row.id}
                            className={`group align-middle transition-colors ${
                              isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                            }`}
                          >
                            {/* Expand button */}
                            <td className="px-2 py-3 w-8">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title={isExpanded ? "Collapse" : "Expand members"}
                              >
                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </button>
                            </td>
                            <td className="px-3 py-3 font-mono font-semibold text-xs tracking-wide">{row.hhid}</td>
                            <td className="px-3 py-3 text-xs">{row.region || "—"}</td>
                            <td className="px-3 py-3 text-xs text-center">{row.sec ?? "—"}</td>
                            <td className="px-3 py-3 text-xs text-center">{row.mos ?? "—"}</td>
                            <td className="px-3 py-3">
                              {memberCount > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1 text-xs font-medium">
                                    <Users className="size-3 text-muted-foreground" />
                                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                                  </span>
                                  {members.length > 0 && (
                                    <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                                      <span>{genderSummary(members)}</span>
                                      <span className="text-[9px]">Age: {ageSummary(members)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={row.current_status} />
                            </td>
                          </tr>
                          {isExpanded && (
                            <ExpandedMemberRow key={`${row.id}-exp`} row={row} />
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer count */}
            {displayRows.length > 0 && (
              <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                Showing {displayRows.length} of {rows.length} records
                {activeTab !== "ALL" && ` · filtered by ${activeTab}`}
                {search && ` · search: "${search}"`}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
