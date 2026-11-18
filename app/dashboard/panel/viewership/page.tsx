"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Tv,
  CheckCircle2,
  XCircle,
  Radio,
  Search,
  RefreshCw,
  Maximize2,
  Minimize2,
  Download,
  Users,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Layers,
  Sparkles,
  BarChart3,
  SlidersHorizontal,
  Flame,
  Volume2,
  Image as ImageIcon,
} from "lucide-react";
import {
  api,
  HouseholdViewershipRow,
  ViewershipSummary,
  ViewershipMember,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TimeWindow = "24h" | "7d" | "30d" | "all";
type StatusFilter =
  | "ALL"
  | "VIEWERSHIP"
  | "NO_VIEWERSHIP"
  | "IMAGE_ONLY"
  | "AUDIO_ONLY"
  | "DUAL";

export default function ViewershipPage() {
  const [data, setData] = useState<ViewershipSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedHhid, setExpandedHhid] = useState<string | null>(null);
  const [isExtendedView, setIsExtendedView] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<
    "hhid" | "region" | "meter_id" | "member_count" | "has_viewership"
  >("hhid");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Fetch Viewership data
  const fetchData = async (bypassCache: boolean = false) => {
    try {
      if (bypassCache) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await api.getPanelViewership(timeWindow, bypassCache);
      setData(res as ViewershipSummary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load viewership data";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [timeWindow]);

  // Unique regions for filter
  const regions = useMemo(() => {
    if (!data?.households) return [];
    return Array.from(new Set(data.households.map((h) => h.region))).sort();
  }, [data]);

  // Filtered & Sorted households
  const filteredHouseholds = useMemo(() => {
    if (!data?.households) return [];

    let list = data.households;

    // Search query (HHID or meter_id)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.hhid.toLowerCase().includes(q) ||
          (h.meter_id && h.meter_id.toLowerCase().includes(q))
      );
    }

    // Region filter
    if (selectedRegion !== "ALL") {
      list = list.filter((h) => h.region === selectedRegion);
    }

    // Status filter
    if (statusFilter === "VIEWERSHIP") {
      list = list.filter((h) => h.has_viewership);
    } else if (statusFilter === "NO_VIEWERSHIP") {
      list = list.filter((h) => !h.has_viewership);
    } else if (statusFilter === "IMAGE_ONLY") {
      list = list.filter(
        (h) => h.image_viewership.status === "POSITIVE" && h.audio_viewership.status !== "POSITIVE"
      );
    } else if (statusFilter === "AUDIO_ONLY") {
      list = list.filter(
        (h) => h.audio_viewership.status === "POSITIVE" && h.image_viewership.status !== "POSITIVE"
      );
    } else if (statusFilter === "DUAL") {
      list = list.filter(
        (h) => h.image_viewership.status === "POSITIVE" && h.audio_viewership.status === "POSITIVE"
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      let comparison = 0;
      if (sortField === "hhid") {
        comparison = a.hhid.localeCompare(b.hhid);
      } else if (sortField === "region") {
        comparison = a.region.localeCompare(b.region);
      } else if (sortField === "meter_id") {
        comparison = (a.meter_id || "").localeCompare(b.meter_id || "");
      } else if (sortField === "member_count") {
        comparison = a.member_count - b.member_count;
      } else if (sortField === "has_viewership") {
        comparison = (a.has_viewership ? 1 : 0) - (b.has_viewership ? 1 : 0);
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [data, searchQuery, selectedRegion, statusFilter, sortField, sortDir]);

  // Export to TSV / CSV
  const exportData = (format: "csv" | "tsv") => {
    if (!filteredHouseholds.length) return;

    const separator = format === "tsv" ? "\t" : ",";
    const headers = [
      "HHID",
      "Region",
      "Meter ID",
      "Viewership Status",
      "Image Viewership",
      "Image Recognized Events",
      "Image Latest Channel",
      "Audio Viewership",
      "Audio Matched Events",
      "Audio Unmatched Events",
      "Audio Latest Channel",
      "Top Channel",
      "Member Count",
      "Members (Gender/Age)",
    ];

    const rows = filteredHouseholds.map((h) => {
      const memberStr = h.members
        .map((m) => `${m.gender || "U"}:${m.age ?? "N/A"}`)
        .join("; ");
      const escape = (val: string) =>
        format === "csv" && val.includes(",") ? `"${val}"` : val;

      return [
        h.hhid,
        escape(h.region),
        h.meter_id || "N/A",
        h.has_viewership ? "Viewership" : "No Viewership",
        h.image_viewership.status,
        h.image_viewership.positive_count,
        escape(h.image_viewership.latest_channel || "None"),
        h.audio_viewership.status,
        h.audio_viewership.matched_count,
        h.audio_viewership.unmatched_count,
        escape(h.audio_viewership.latest_channel || "None"),
        escape(h.top_channels[0]?.channel || "None"),
        h.member_count,
        escape(memberStr),
      ].join(separator);
    });

    const content = [headers.join(separator), ...rows].join("\n");
    const blob = new Blob([content], {
      type: format === "tsv" ? "text/tab-separated-values" : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `viewership_${timeWindow}_${Date.now()}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (
    field: "hhid" | "region" | "meter_id" | "member_count" | "has_viewership"
  ) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Tv className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Viewership Monitoring
              </h1>
              <p className="text-sm text-muted-foreground">
                Live image recognition (Type 29) & audio fingerprint matches (Type 42) for PRODUCTION households.
              </p>
            </div>
          </div>
        </div>

        {/* Time Window & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Window Buttons */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs font-medium shadow-sm">
            {(
              [
                { id: "24h", label: "Last 24h" },
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((w) => (
              <button
                key={w.id}
                onClick={() => setTimeWindow(w.id)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  timeWindow === w.id
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
            title="Bypass cache and query live RDS events"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
            <span>{refreshing ? "Querying RDS..." : "Refresh"}</span>
          </button>

          {/* TSV Export */}
          <button
            onClick={() => exportData("tsv")}
            disabled={!filteredHouseholds.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="size-3.5" />
            <span>Export TSV</span>
          </button>

          {/* Extended View Toggle */}
          <button
            onClick={() => setIsExtendedView(!isExtendedView)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
              isExtendedView
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {isExtendedView ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span>{isExtendedView ? "Standard View" : "Extended View"}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="font-semibold">Failed to fetch viewership data</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      )}

      {/* Executive Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Production Households */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Production Panel</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {loading ? "..." : data?.total_production_households ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-muted-foreground font-medium">
              100% Active Production
            </div>
          </CardContent>
        </Card>

        {/* Positive Viewership */}
        <Card className="border border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Viewership
              </CardDescription>
              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
              {loading ? "..." : data?.positive_viewership_count ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : `${data?.positive_pct ?? 0}% positive`}
            </div>
          </CardContent>
        </Card>

        {/* No Viewership */}
        <Card className="border border-slate-300/60 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium">No Viewership</CardDescription>
              <XCircle className="size-3.5 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {loading ? "..." : data?.negative_viewership_count ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] text-muted-foreground font-medium">
              {loading
                ? "..."
                : `${(
                    100 - (Number(data?.positive_pct) || 0)
                  ).toFixed(1)}% inactive / off`}
            </div>
          </CardContent>
        </Card>

        {/* Image Recognition (Type 29) */}
        <Card className="border border-blue-500/30 bg-blue-500/5 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-blue-700 dark:text-blue-400">
                Type 29 Image
              </CardDescription>
              <ImageIcon className="size-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-300">
              {loading ? "..." : data?.image_positive_count ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
              Recognized broadcast
            </div>
          </CardContent>
        </Card>

        {/* Audio Fingerprint (Type 42) */}
        <Card className="border border-teal-500/30 bg-teal-500/5 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-teal-700 dark:text-teal-400">
                Type 42 Audio
              </CardDescription>
              <Volume2 className="size-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-teal-700 dark:text-teal-300">
              {loading ? "..." : data?.audio_positive_count ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] font-medium text-teal-600 dark:text-teal-400">
              Matched fingerprint
            </div>
          </CardContent>
        </Card>

        {/* Dual Positive (Both Image & Audio) */}
        <Card className="border border-indigo-500/30 bg-indigo-500/5 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                Dual Verified
              </CardDescription>
              <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
              {loading ? "..." : data?.dual_positive_count ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              Both Type 29 & 42
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts (Hidden in full extended table mode if user wants pure table) */}
      {!isExtendedView && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Regional Viewership Chart */}
          <Card className="border border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Regional Viewership Rates
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Percentage of production households showing active viewership.
                  </CardDescription>
                </div>
                <MapPin className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
                  Loading regional analytics...
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.regional_breakdown || []}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis
                        dataKey="region"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-18}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "#334155",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#fff",
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val}% (${item.payload.positive_households}/${item.payload.total_households} HHs)`,
                          "Viewership Rate",
                        ]}
                      />
                      <Bar dataKey="positive_pct" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Channels Leaderboard */}
          <Card className="border border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Top Broadcast Channels
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Recognized broadcast events across Type 29 and Type 42.
                  </CardDescription>
                </div>
                <Flame className="size-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
                  Loading top channels...
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {(data?.top_channels || []).slice(0, 6).map((ch, idx) => {
                    const maxCount = data?.top_channels[0]?.count || 1;
                    const pct = Math.round((ch.count / maxCount) * 100);

                    return (
                      <div key={ch.channel} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground w-4">
                              #{idx + 1}
                            </span>
                            {ch.channel}
                          </span>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {ch.count.toLocaleString()} matches ({ch.image_count} img / {ch.audio_count} aud)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-600 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {(!data?.top_channels || data.top_channels.length === 0) && (
                    <div className="text-xs text-muted-foreground py-8 text-center">
                      No positive channel matches recorded in this time window.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Table Section */}
      <Card
        className={`border border-border shadow-xs transition-all ${
          isExtendedView ? "fixed inset-4 z-50 overflow-auto bg-card p-6 shadow-2xl rounded-2xl" : ""
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">
                  Production Households Viewership Breakdown
                </CardTitle>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {filteredHouseholds.length} of {data?.total_production_households ?? 0}
                </span>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Detailed view of each household&apos;s meter, members (gender & age), image status, audio status, and top channel.
              </CardDescription>
            </div>

            {/* In-table Extended View Close button if maximized */}
            {isExtendedView && (
              <button
                onClick={() => setIsExtendedView(false)}
                className="self-start md:self-auto inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                <Minimize2 className="size-3.5" />
                <span>Exit Extended View</span>
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search HHID or Meter ID (e.g. IM000...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
              {(
                [
                  { id: "ALL", label: "All Statuses" },
                  { id: "VIEWERSHIP", label: "Viewership" },
                  { id: "NO_VIEWERSHIP", label: "No Viewership" },
                  { id: "DUAL", label: "Dual Matched" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Region Filter */}
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Regions ({regions.length})</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-y border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-2.5 px-3 w-8"></th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("hhid")}
                  >
                    HHID {sortField === "hhid" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("meter_id")}
                  >
                    Meter ID {sortField === "meter_id" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("region")}
                  >
                    Region {sortField === "region" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("member_count")}
                  >
                    Members {sortField === "member_count" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-2.5 px-3">Type 29 (Image)</th>
                  <th className="py-2.5 px-3">Type 42 (Audio)</th>
                  <th
                    className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("has_viewership")}
                  >
                    Overall Status {sortField === "has_viewership" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="py-2.5 px-3">Top Channel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                      <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                      Loading live viewership status from RDS...
                    </td>
                  </tr>
                )}

                {!loading && filteredHouseholds.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                      No production households match the selected filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredHouseholds.map((hh) => {
                    const isExpanded = expandedHhid === hh.hhid;

                    // Members gender count
                    const maleMembers = hh.members.filter(
                      (m) => String(m.gender).trim().toLowerCase() === "male"
                    ).length;
                    const femaleMembers = hh.members.filter(
                      (m) => String(m.gender).trim().toLowerCase() === "female"
                    ).length;
                    const ages = hh.members
                      .map((m) => m.age)
                      .filter((a): a is number => a != null);
                    const minAge = ages.length ? Math.min(...ages) : null;
                    const maxAge = ages.length ? Math.max(...ages) : null;

                    return (
                      <tbody key={hh.hhid} className="divide-y divide-border contents">
                        <tr
                          className={`hover:bg-muted/30 transition-colors ${
                            isExpanded ? "bg-muted/20" : ""
                          }`}
                        >
                          {/* Expand toggle */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setExpandedHhid(isExpanded ? null : hh.hhid)}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Toggle member details"
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </button>
                          </td>

                          {/* HHID */}
                          <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                            {hh.hhid}
                          </td>

                          {/* Meter ID */}
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {hh.meter_id || "Unmapped"}
                          </td>

                          {/* Region */}
                          <td className="py-2.5 px-3 text-foreground font-medium">
                            {hh.region}
                          </td>

                          {/* Members summary */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-foreground">
                                {hh.member_count} member{hh.member_count !== 1 ? "s" : ""}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                M: {maleMembers} • F: {femaleMembers}
                                {minAge != null && ` • ${minAge}-${maxAge} yrs`}
                              </span>
                            </div>
                          </td>

                          {/* Type 29 (Image) */}
                          <td className="py-2.5 px-3">
                            {hh.image_viewership.status === "POSITIVE" ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 w-fit rounded bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                                  <CheckCircle2 className="size-3" />
                                  Positive ({hh.image_viewership.positive_count})
                                </span>
                                {hh.image_viewership.latest_channel && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                                    {hh.image_viewership.latest_channel}
                                  </span>
                                )}
                              </div>
                            ) : hh.image_viewership.status === "NEGATIVE" ? (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                <XCircle className="size-3" />
                                Unrecognized ({hh.image_viewership.total_count})
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                No events
                              </span>
                            )}
                          </td>

                          {/* Type 42 (Audio) */}
                          <td className="py-2.5 px-3">
                            {hh.audio_viewership.status === "POSITIVE" ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 w-fit rounded bg-teal-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                                  <CheckCircle2 className="size-3" />
                                  Matched ({hh.audio_viewership.matched_count})
                                </span>
                                {hh.audio_viewership.latest_channel && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                                    {hh.audio_viewership.latest_channel}
                                  </span>
                                )}
                              </div>
                            ) : hh.audio_viewership.status === "NEGATIVE" ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                <XCircle className="size-3" />
                                Unmatched ({hh.audio_viewership.unmatched_count})
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                No events
                              </span>
                            )}
                          </td>

                          {/* Overall Status */}
                          <td className="py-2.5 px-3">
                            {hh.has_viewership ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Viewership
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                <span className="size-1.5 rounded-full bg-slate-400" />
                                No Viewership
                              </span>
                            )}
                          </td>

                          {/* Top Channel */}
                          <td className="py-2.5 px-3">
                            {hh.top_channels.length > 0 ? (
                              <span className="font-semibold text-foreground">
                                {hh.top_channels[0].channel}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr className="bg-muted/10">
                            <td colSpan={9} className="py-3 px-6 border-b border-border">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Member List */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    <Users className="size-3.5 text-primary" />
                                    <span>Household Members ({hh.members.length})</span>
                                  </div>
                                  <div className="rounded-md border border-border bg-card p-2">
                                    {hh.members.length === 0 ? (
                                      <div className="text-[11px] text-muted-foreground">
                                        No individual member records available.
                                      </div>
                                    ) : (
                                      <div className="space-y-1 divide-y divide-border">
                                        {hh.members.map((m, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between pt-1 first:pt-0 text-[11px]"
                                          >
                                            <span className="font-mono text-muted-foreground">
                                              {m.member_code || `Member #${idx + 1}`}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                                                  String(m.gender).toLowerCase() === "male"
                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                                    : String(m.gender).toLowerCase() === "female"
                                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                                    : "bg-muted text-muted-foreground"
                                                }`}
                                              >
                                                {m.gender || "Unknown"}
                                              </span>
                                              <span className="font-mono text-foreground">
                                                {m.age != null ? `${m.age} yrs` : "Age N/A"}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Recognition Breakdown */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    <SlidersHorizontal className="size-3.5 text-primary" />
                                    <span>Event Statistics ({timeWindow})</span>
                                  </div>
                                  <div className="rounded-md border border-border bg-card p-2 text-[11px] space-y-1.5">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Image Recognition (Type 29):</span>
                                      <span className="font-mono font-semibold">
                                        {hh.image_viewership.positive_count} recognized / {hh.image_viewership.total_count} total
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Audio Fingerprinting (Type 42):</span>
                                      <span className="font-mono font-semibold">
                                        {hh.audio_viewership.matched_count} matched / {hh.audio_viewership.total_count} total
                                      </span>
                                    </div>
                                    {hh.top_channels.length > 0 && (
                                      <div className="pt-1 border-t border-border">
                                        <span className="text-muted-foreground block mb-0.5">Top Channels Detected:</span>
                                        <div className="flex flex-wrap gap-1">
                                          {hh.top_channels.map((c) => (
                                            <span
                                              key={c.channel}
                                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                                            >
                                              {c.channel} ({c.count})
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
