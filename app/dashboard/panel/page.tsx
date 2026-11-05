"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  TrendingDown,
  Target,
  Activity,
  Layers,
  ChevronRight,
  Filter,
  Copy,
  Check,
  Download,
  Search,
  Building2,
  Flame,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  ExternalLink,
  Wrench,
  GraduationCap,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type HeatmapCell = {
  sec: number;
  mosr: number;
  target: number;
  live: number;
  shortfall: number;
  shortfall_pct: number;
};

type RegionBarData = {
  region_code: number;
  region_name: string;
  target: number;
  live: number;
  shortfall: number;
  shortfall_pct: number;
};

type StackedBarData = {
  region_code: number;
  region_name: string;
  sec1_live: number;
  sec2_live: number;
  sec3_live: number;
};

type RegionCell = {
  sec: number;
  mosr: number;
  target: number;
  live: number;
  shortfall: number;
  shortfall_pct: number;
};

type RegionDrillDownData = {
  region_code: number;
  region_name: string;
  total_target?: number;
  total_live?: number;
  total_shortfall?: number;
  cells: RegionCell[];
};

type UnclassifiedRow = {
  id?: string;
  hhid: string;
  region?: string | null;
  region_name?: string | null;
  sec: number | null;
  mosr: number | null;
};

type RegionPreview = {
  region_code: number;
  region_name: string;
  total_target?: number;
  total_live?: number;
  total_shortfall?: number;
  cells: RegionCell[];
};

type InstalledHouseholdsRow = {
  region_code: number;
  region_name: string;
  [key: string]: string | number | undefined;
};

type InstalledHouseholdsTotalRow = {
  region_name: string;
  [key: string]: string | number | undefined;
};

type ShortfallReason = {
  key:
    | "region_missing"
    | "sec_missing"
    | "mosr_missing"
    | "sec_out_of_range"
    | "mosr_out_of_range";
  label: string;
  count: number;
  description: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function cellBg(target: number, live: number, shortfallPct: number): string {
  if (target === 0) {
    return "bg-muted text-muted-foreground border-border/40";
  }
  if (live >= target) {
    return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800";
  }
  if (shortfallPct < 30) {
    return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800";
  }
  return "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800";
}

function nullDisplay(val: string | number | null | undefined) {
  if (val === null || val === undefined || val === "") {
    return <span className="font-semibold text-rose-500">—</span>;
  }
  return <>{val}</>;
}

const SEC_LABELS = [1, 2, 3];
const MOSR_LABELS = [1, 2, 3, 4];

// ─── 1. Summary Cards ────────────────────────────────────────────────────────

function SummaryCards({
  totalTarget,
  totalLive,
  totalShortfall,
  unclassifiedCount,
  productionCount,
  installedCount,
  trainingCount,
}: {
  totalTarget: number;
  totalLive: number;
  totalShortfall: number;
  unclassifiedCount: number;
  productionCount: number;
  installedCount: number;
  trainingCount: number;
}) {
  return (
    <div  className="auto-rows-[160px] grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* Total Target */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Target</CardTitle>
          <Target className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalTarget.toLocaleString()}</div>
          <CardDescription className="mt-1">Master target households</CardDescription>
        </CardContent>
      </Card>

      {/* Production */}
      <Card className="border-emerald-200 dark:border-emerald-900/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Production
          </CardTitle>
          <Activity className="size-4 text-emerald-600 dark:text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {productionCount.toLocaleString()}
          </div>
          <CardDescription className="mt-1">Live production households</CardDescription>
        </CardContent>
      </Card>

      {/* Installed */}
      <Card className="border-cyan-200 dark:border-cyan-900/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
            Installed
          </CardTitle>
          <Wrench className="size-4 text-cyan-600 dark:text-cyan-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {installedCount.toLocaleString()}
          </div>
          <CardDescription className="mt-1">Installed stage</CardDescription>
        </CardContent>
      </Card>

      {/* Training */}
      <Card className="border-blue-200 dark:border-blue-900/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
            Training
          </CardTitle>
          <GraduationCap className="size-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {trainingCount.toLocaleString()}
          </div>
          <CardDescription className="mt-1">Training 1 & 2 stages</CardDescription>
        </CardContent>
      </Card>

      {/* Total Shortfall (in red) */}
      <Card className="border-rose-200 dark:border-rose-900/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400">
            Total Shortfall
          </CardTitle>
          <TrendingDown className="size-4 text-rose-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {totalShortfall.toLocaleString()}
          </div>
          <CardDescription className="mt-1">Target vs Production</CardDescription>
        </CardContent>
      </Card>

      {/* Unclassified Households (in amber with warning icon) */}
      <Card className="border-amber-300 dark:border-amber-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Unclassified
          </CardTitle>
          <AlertTriangle className="size-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {unclassifiedCount.toLocaleString()}
          </div>
          <CardDescription className="mt-1">Missing SEC or MOSR</CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 2. Grouped Bar Chart ─────────────────────────────────────────────────────

function GroupedBarChartSection({
  data,
  activeRegion,
  onRegionClick,
  onBarClick,
}: {
  data: RegionBarData[];
  activeRegion: number | null;
  onRegionClick: (regionCode: number) => void;
  onBarClick: (regionCode: number) => void;
}) {
  const chartData = data.map((r) => ({
    name: r.region_name || `Region ${r.region_code}`,
    region_code: r.region_code,
    Target: num(r.target),
    Live: num(r.live),
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Grouped Bar Chart — Target vs Live</CardTitle>
            <CardDescription>
              Master target (blue) vs live count (green) per region. Click a bar or pill to open Region Drill Down.
            </CardDescription>
          </div>
          {activeRegion !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Active: Region {activeRegion}
            </span>
          )}
        </div>

        {/* Quick Region Pills */}
        {data.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {data.map((r) => {
              const isSelected = activeRegion === r.region_code;
              return (
                <button
                  key={r.region_code}
                  type="button"
                  onClick={() => onRegionClick(r.region_code)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border bg-muted/40 hover:bg-muted text-foreground"
                  }`}
                >
                  <span>{r.region_name || `Reg ${r.region_code}`}</span>
                  <ChevronRight className="size-3" />
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1">
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No region data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              <Bar
                dataKey="Target"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const rc = (entry as any)?.payload?.region_code;
                  if (rc != null) onBarClick(Number(rc));
                }}
              />
              <Bar
                dataKey="Live"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const rc = (entry as any)?.payload?.region_code;
                  if (rc != null) onBarClick(Number(rc));
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 3. Heatmap Grid ──────────────────────────────────────────────────────────

function HeatmapGridSection({
  cells,
  highlight,
  onCellClick,
}: {
  cells: HeatmapCell[];
  highlight: { sec: number; mosr: number } | null;
  onCellClick: (sec: number, mosr: number) => void;
}) {
  const [isExtended, setIsExtended] = useState(false);

  useEffect(() => {
    if (!isExtended) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExtended(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExtended]);

  function getCell(sec: number, mosr: number) {
    return cells.find((c) => Number(c.sec) === sec && Number(c.mosr) === mosr);
  }

  return (
    <>
      {isExtended && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsExtended(false)}
        />
      )}
      <Card
        className={`transition-all duration-200 ${
          isExtended
            ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 flex flex-col bg-card shadow-2xl rounded-xl border-2 border-primary/40 overflow-hidden"
            : ""
        }`}
      >
        {isExtended && (
          <div className="flex items-center justify-between px-4 py-2 bg-primary text-primary-foreground text-xs font-medium shrink-0">
            <div className="flex items-center gap-2">
              <Maximize2 className="size-3.5" />
              <span className="font-semibold">Heatmap Grid — SEC × MOSR (Extended View)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExtended(false)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity text-xs font-semibold"
            >
              <span>Press Esc or click to exit</span>
              <X className="size-3.5 ml-1" />
            </button>
          </div>
        )}

        <CardHeader className={isExtended ? "pb-3 shrink-0" : undefined}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Heatmap Grid — SEC × MOSR</CardTitle>
              <CardDescription>
                SEC (rows 1,2,3) × MOSR (columns 1,2,3,4). Each cell shows Target / Live and Shortfall %.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {highlight && (
                <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <Filter className="size-3.5" />
                  <span>Highlighted: SEC {highlight.sec} × MOSR {highlight.mosr}</span>
                  <button
                    type="button"
                    onClick={() => onCellClick(highlight.sec, highlight.mosr)}
                    className="ml-1 rounded p-0.5 hover:bg-primary/20"
                    title="Clear highlight"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}

              <Button
                type="button"
                variant={isExtended ? "default" : "outline"}
                size="sm"
                onClick={() => setIsExtended(!isExtended)}
                className={`h-8 gap-1.5 text-xs font-medium ${
                  isExtended ? "bg-primary text-primary-foreground" : ""
                }`}
                title={isExtended ? "Exit Extended View (Esc)" : "Expand Heatmap Grid into Extended View"}
              >
                {isExtended ? (
                  <>
                    <Minimize2 className="size-3.5" />
                    <span>Exit Extended</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="size-3.5" />
                    <span>Extended View</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded border border-emerald-400 bg-emerald-100 dark:bg-emerald-950/60" />
              Live ≥ Target
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded border border-amber-400 bg-amber-100 dark:bg-amber-950/60" />
              Shortfall &lt; 30%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded border border-rose-400 bg-rose-100 dark:bg-rose-950/60" />
              Shortfall ≥ 30%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded border border-border bg-muted" />
              Target = 0
            </span>
            <span className="text-muted-foreground/70">
              (Click any cell to highlight that SEC across region charts)
            </span>
          </div>
        </CardHeader>

        <CardContent className={isExtended ? "flex-1 overflow-auto p-4 sm:p-6" : undefined}>
          <div className={`overflow-x-auto rounded-lg border ${isExtended ? "h-full flex flex-col justify-center" : ""}`}>
            <table className={`w-full text-sm ${isExtended ? "text-base" : ""}`}>
              <thead>
                <tr className="bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className={`text-left font-semibold ${isExtended ? "px-6 py-4" : "px-4 py-3"}`}>
                    SEC \ MOSR
                  </th>
                  {MOSR_LABELS.map((m) => (
                    <th key={m} className={`text-center font-semibold ${isExtended ? "px-6 py-4" : "px-4 py-3"}`}>
                      MOSR {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SEC_LABELS.map((sec) => (
                  <tr key={sec} className="divide-x divide-border">
                    <td className={`whitespace-nowrap bg-muted/30 font-bold text-foreground ${isExtended ? "px-6 py-4 text-sm" : "px-4 py-3 text-xs"}`}>
                      SEC {sec}
                    </td>
                    {MOSR_LABELS.map((mosr) => {
                      const cell = getCell(sec, mosr);
                      const target = cell ? num(cell.target) : 0;
                      const live = cell ? num(cell.live) : 0;
                      const shortfall = cell ? num(cell.shortfall) : Math.max(0, target - live);
                      const shortfallPct =
                        cell && cell.shortfall_pct !== undefined
                          ? num(cell.shortfall_pct)
                          : target > 0
                          ? (shortfall / target) * 100
                          : 0;

                      const isHighlighted =
                        highlight?.sec === sec && highlight?.mosr === mosr;

                      return (
                        <td
                          key={mosr}
                          onClick={() => onCellClick(sec, mosr)}
                          className={`cursor-pointer border text-center transition-all hover:scale-[1.01] hover:brightness-95 ${
                            isExtended ? "p-4 sm:p-6" : "p-3"
                          } ${cellBg(
                            target,
                            live,
                            shortfallPct
                          )} ${
                            isHighlighted
                              ? "ring-2 ring-primary ring-offset-2 font-bold shadow-md"
                              : ""
                          }`}
                        >
                          <div className="space-y-1">
                            <div className={`font-mono font-bold ${isExtended ? "text-lg" : "text-sm"}`}>
                              {live} <span className="opacity-60">/</span> {target}
                            </div>
                            {target > 0 ? (
                              <div className={`font-medium opacity-85 ${isExtended ? "text-xs" : "text-[11px]"}`}>
                                {live >= target ? (
                                  <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                                    Achieved
                                  </span>
                                ) : (
                                  <span>{Math.round(shortfallPct)}% short</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] opacity-50">Target 0</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── 4. Stacked Bar Chart ─────────────────────────────────────────────────────

const SEC_COLORS = {
  sec1: "#6366f1", // Indigo
  sec2: "#ec4899", // Pink
  sec3: "#f59e0b", // Amber
};

function StackedBarChartSection({
  data,
  highlightSec,
}: {
  data: StackedBarData[];
  highlightSec: number | null;
}) {
  const chartData = data.map((r) => ({
    name: r.region_name || `Region ${r.region_code}`,
    region_code: r.region_code,
    "SEC 1": num(r.sec1_live),
    "SEC 2": num(r.sec2_live),
    "SEC 3": num(r.sec3_live),
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Stacked Bar Chart — Live Distribution by SEC</CardTitle>
            <CardDescription>
              Live panel distribution across regions with 3 stacked segments (SEC 1, 2, 3).
            </CardDescription>
          </div>
          {highlightSec && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Focusing SEC {highlightSec}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No stacked distribution data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              <Bar
                dataKey="SEC 1"
                stackId="live"
                fill={SEC_COLORS.sec1}
                fillOpacity={highlightSec === null || highlightSec === 1 ? 1 : 0.25}
              />
              <Bar
                dataKey="SEC 2"
                stackId="live"
                fill={SEC_COLORS.sec2}
                fillOpacity={highlightSec === null || highlightSec === 2 ? 1 : 0.25}
              />
              <Bar
                dataKey="SEC 3"
                stackId="live"
                fill={SEC_COLORS.sec3}
                fillOpacity={highlightSec === null || highlightSec === 3 ? 1 : 0.25}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 5. Region Drill Down ─────────────────────────────────────────────────────

function RegionDrillDownSection({
  data,
  onClose,
}: {
  data: RegionDrillDownData;
  onClose: () => void;
}) {
  const [isExtended, setIsExtended] = useState(false);
  const cells = data.cells ?? [];

  useEffect(() => {
    if (!isExtended) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExtended(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExtended]);

  function getCell(sec: number, mosr: number) {
    return cells.find((c) => Number(c.sec) === sec && Number(c.mosr) === mosr);
  }

  return (
    <>
      {isExtended && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsExtended(false)}
        />
      )}
      <Card
        className={`border-primary/50 shadow-md transition-all duration-200 ${
          isExtended
            ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 flex flex-col bg-card shadow-2xl rounded-xl border-2 border-primary overflow-hidden"
            : ""
        }`}
      >
        {isExtended && (
          <div className="flex items-center justify-between px-4 py-2 bg-primary text-primary-foreground text-xs font-medium shrink-0">
            <div className="flex items-center gap-2">
              <Maximize2 className="size-3.5" />
              <span className="font-semibold">Region Drill Down: {data.region_name || `Region ${data.region_code}`} (Extended View)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExtended(false)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity text-xs font-semibold"
            >
              <span>Press Esc or click to exit</span>
              <X className="size-3.5 ml-1" />
            </button>
          </div>
        )}

        <CardHeader className="flex flex-row items-start justify-between pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <CardTitle className="text-lg">
                Region Drill Down: {data.region_name || `Region ${data.region_code}`}
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              SEC (1,2,3) × MOSR (1,2,3,4) grid for this region only. Cells with shortfall &gt; 0 are highlighted in red.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isExtended ? "default" : "outline"}
              size="sm"
              onClick={() => setIsExtended(!isExtended)}
              className={`h-8 gap-1.5 text-xs font-medium ${
                isExtended ? "bg-primary text-primary-foreground" : ""
              }`}
              title={isExtended ? "Exit Extended View (Esc)" : "Expand into Extended View"}
            >
              {isExtended ? (
                <>
                  <Minimize2 className="size-3.5" />
                  <span>Exit Extended</span>
                </>
              ) : (
                <>
                  <Maximize2 className="size-3.5" />
                  <span>Extended View</span>
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted"
            >
              <X className="size-3.5" />
              Close Drill Down
            </button>
          </div>
        </CardHeader>

        <CardContent className={isExtended ? "flex-1 overflow-auto p-4 sm:p-6" : undefined}>
          <div className={`overflow-x-auto rounded-lg border ${isExtended ? "h-full flex flex-col justify-center" : ""}`}>
            <table className={`w-full text-sm ${isExtended ? "text-base" : ""}`}>
              <thead>
                <tr className="bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className={`text-left font-semibold ${isExtended ? "px-6 py-4" : "px-4 py-3"}`}>SEC \ MOSR</th>
                  {MOSR_LABELS.map((m) => (
                    <th key={m} className={`text-center font-semibold ${isExtended ? "px-6 py-4" : "px-4 py-3"}`}>
                      MOSR {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SEC_LABELS.map((sec) => (
                  <tr key={sec} className="divide-x divide-border">
                    <td className={`whitespace-nowrap bg-muted/30 font-bold text-foreground ${isExtended ? "px-6 py-4 text-sm" : "px-4 py-3 text-xs"}`}>
                      SEC {sec}
                    </td>
                    {MOSR_LABELS.map((mosr) => {
                      const cell = getCell(sec, mosr);
                      const target = cell ? num(cell.target) : 0;
                      const live = cell ? num(cell.live) : 0;
                      const shortfall = cell ? num(cell.shortfall) : Math.max(0, target - live);
                      const shortfallPct =
                        cell && cell.shortfall_pct !== undefined
                          ? num(cell.shortfall_pct)
                          : target > 0
                          ? (shortfall / target) * 100
                          : 0;
                      const hasShortfall = shortfall > 0;

                      return (
                        <td
                          key={mosr}
                          className={`border text-center transition-colors ${
                            isExtended ? "p-4 sm:p-6" : "p-3"
                          } ${
                            hasShortfall
                              ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/70 dark:text-rose-100 dark:border-rose-800"
                              : target > 0
                              ? "bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100"
                              : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className={`font-mono font-bold ${isExtended ? "text-base" : "text-xs"}`}>
                              Live: {live} / Target: {target}
                            </div>
                            {hasShortfall ? (
                              <div className={`font-semibold text-rose-700 dark:text-rose-300 ${isExtended ? "text-xs" : "text-[11px]"}`}>
                                Shortfall: −{shortfall} ({Math.round(shortfallPct)}%)
                              </div>
                            ) : target > 0 ? (
                              <div className={`font-medium text-emerald-700 dark:text-emerald-400 ${isExtended ? "text-xs" : "text-[11px]"}`}>
                                Met Target
                              </div>
                            ) : (
                              <div className="text-[10px] opacity-50">Target 0</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── 6. Unclassified Table ────────────────────────────────────────────────────

function UnclassifiedTableSection({ rows }: { rows: UnclassifiedRow[] }) {
  if (!rows || rows.length === 0) return null;
  const [isExtended, setIsExtended] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isExtended) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExtended(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExtended]);

  const filteredRows = rows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.hhid && r.hhid.toLowerCase().includes(q)) ||
      (r.region_name && r.region_name.toLowerCase().includes(q)) ||
      (r.region && r.region.toLowerCase().includes(q))
    );
  });

  return (
    <>
      {isExtended && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsExtended(false)}
        />
      )}
      <Card
        className={`border-amber-300 dark:border-amber-700 transition-all duration-200 ${
          isExtended
            ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 flex flex-col bg-card shadow-2xl rounded-xl border-2 border-amber-500 overflow-hidden"
            : ""
        }`}
      >
        {isExtended && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-600 text-white text-xs font-medium shrink-0">
            <div className="flex items-center gap-2">
              <Maximize2 className="size-3.5" />
              <span className="font-semibold">Data Quality Issues — Unclassified Households (Extended View)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExtended(false)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity text-xs font-semibold"
            >
              <span>Press Esc or click to exit</span>
              <X className="size-3.5 ml-1" />
            </button>
          </div>
        )}

        <CardHeader className={isExtended ? "pb-3 shrink-0" : undefined}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <div>
                <CardTitle className="text-base text-amber-700 dark:text-amber-300">
                  Data Quality Issues — Households Missing SEC or MOSR
                </CardTitle>
                <CardDescription>
                  {rows.length} household{rows.length !== 1 ? "s" : ""} missing SEC or MOSR classification data.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter HHID or Region..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>

              <Button
                type="button"
                variant={isExtended ? "default" : "outline"}
                size="sm"
                onClick={() => setIsExtended(!isExtended)}
                className={`h-8 gap-1.5 text-xs font-medium ${
                  isExtended ? "bg-amber-600 text-white" : ""
                }`}
                title={isExtended ? "Exit Extended View (Esc)" : "Expand into Extended View"}
              >
                {isExtended ? (
                  <>
                    <Minimize2 className="size-3.5" />
                    <span>Exit Extended</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="size-3.5" />
                    <span>Extended View</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={isExtended ? "flex-1 overflow-hidden flex flex-col p-4 sm:p-6" : undefined}>
          <div className={`overflow-x-auto rounded-md border bg-card ${
            isExtended ? "flex-1 overflow-y-auto" : "max-h-96 overflow-y-auto"
          }`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wider text-muted-foreground z-10 shadow-xs">
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">HHID</th>
                  <th className="px-4 py-3 text-left font-medium">Region</th>
                  <th className="px-4 py-3 text-center font-medium">SEC</th>
                  <th className="px-4 py-3 text-center font-medium">MOSR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground italic">
                      No matching unclassified households found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={row.hhid || row.id || idx} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{nullDisplay(row.hhid)}</td>
                      <td className="px-4 py-2">{nullDisplay(row.region_name || row.region)}</td>
                      <td className="px-4 py-2 text-center">{nullDisplay(row.sec)}</td>
                      <td className="px-4 py-2 text-center">{nullDisplay(row.mosr)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Shortfall Reason Breakdown ─────────────────────────────────────────────────

function getShortfallReasonBreakdown(rows: UnclassifiedRow[]): ShortfallReason[] {
  const counts = {
    region_missing: 0,
    sec_missing: 0,
    mosr_missing: 0,
    sec_out_of_range: 0,
    mosr_out_of_range: 0,
  };

  rows.forEach((row) => {
    const regionValue = row.region_name ?? row.region;
    if (regionValue === null || regionValue === undefined || regionValue === "") {
      counts.region_missing += 1;
    }

    const secValue = row.sec;
    const secNum = Number(secValue);
    if (secValue === null || secValue === undefined) {
      counts.sec_missing += 1;
    } else if (Number.isFinite(secNum) && secNum > 3) {
      counts.sec_out_of_range += 1;
    }

    const mosrValue = row.mosr;
    const mosrNum = Number(mosrValue);
    if (mosrValue === null || mosrValue === undefined) {
      counts.mosr_missing += 1;
    } else if (Number.isFinite(mosrNum) && mosrNum > 4) {
      counts.mosr_out_of_range += 1;
    }
  });

  const reasons: ShortfallReason[] = [
    {
      key: "region_missing",
      label: "Region missing",
      count: counts.region_missing,
      description: "Households without an assigned region",
    },
    {
      key: "sec_missing",
      label: "SEC missing",
      count: counts.sec_missing,
      description: "Households without SEC classification",
    },
    {
      key: "mosr_missing",
      label: "MOSR missing",
      count: counts.mosr_missing,
      description: "Households without MOSR classification",
    },
    {
      key: "sec_out_of_range",
      label: "SEC > 3",
      count: counts.sec_out_of_range,
      description: "SEC values outside the valid range",
    },
    {
      key: "mosr_out_of_range",
      label: "MOSR > 4",
      count: counts.mosr_out_of_range,
      description: "MOSR values outside the valid range",
    },
  ].filter((reason): reason is ShortfallReason => reason.count > 0);

  return reasons;
}

function ShortfallReasonPanel({
  totalShortfall,
  rows,
}: {
  totalShortfall: number;
  rows: UnclassifiedRow[];
}) {
  const reasons = getShortfallReasonBreakdown(rows);

  if (reasons.length === 0) {
    return null;
  }

  const totalReasonHits = reasons.reduce((sum, reason) => sum + reason.count, 0);

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/70 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          <CardTitle className="text-base text-amber-700 dark:text-amber-300">
            Why the shortfall is high
          </CardTitle>
        </div>
        <CardDescription>
          These are the main data-quality reasons behind the shortfall. One household can fall into more than one category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {reasons.map((reason) => (
            <div
              key={reason.key}
              className="rounded-xl border border-amber-200 bg-white/80 p-3 shadow-sm dark:border-amber-800 dark:bg-slate-900/60"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                {reason.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{reason.count.toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">{reason.description}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-100/40 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100">
          <span className="font-semibold">Shortfall total:</span> {totalShortfall.toLocaleString()} households
          <span className="mx-2 text-amber-700 dark:text-amber-300">•</span>
          <span className="text-amber-800 dark:text-amber-200">
            {totalReasonHits.toLocaleString()} reason hits across the data-quality gaps above
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PanelPage() {
  const [summaryData, setSummaryData] = useState<{
    total_target: number;
    total_live: number;
    total_shortfall: number;
    production_count: number;
    installed_count: number;
    training_count: number;
  }>({
    total_target: 0,
    total_live: 0,
    total_shortfall: 0,
    production_count: 0,
    installed_count: 0,
    training_count: 0,
  });

  const [regions, setRegions] = useState<RegionBarData[]>([]);
  const [regionPreviews, setRegionPreviews] = useState<
    Array<{
      region_code: number;
      region_name: string;
      total_target: number;
      total_live: number;
      total_shortfall: number;
      cells: RegionCell[];
    }>
  >([]);
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [stacked, setStacked] = useState<StackedBarData[]>([]);
  const [unclassified, setUnclassified] = useState<UnclassifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRegion, setActiveRegion] = useState<number | null>(null);
  const [drillDown, setDrillDown] = useState<RegionDrillDownData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [drillView, setDrillView] = useState<"inline" | "dialog">("inline");

  const [highlight, setHighlight] = useState<{
    sec: number;
    mosr: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Summary, Heatmap, and Unclassified concurrently
      const [summaryRes, heatmapRes, unclassifiedRes] = await Promise.all([
        api.getPanelSummary().catch((e) => {
          console.warn("getPanelSummary error:", e);
          return null;
        }),
        api.getPanelHeatmap().catch((e) => {
          console.warn("getPanelHeatmap error:", e);
          return null;
        }),
        api.getPanelUnclassified().catch((e) => {
          console.warn("getPanelUnclassified error:", e);
          return null;
        }),
      ]);

      // Normalize summary
      const sTarget = num(summaryRes?.total_target ?? summaryRes?.target);
      const sLive = num(summaryRes?.total_live ?? summaryRes?.live);
      const sShortfall = num(summaryRes?.total_shortfall ?? summaryRes?.shortfall);
      const sProduction = num(summaryRes?.production_count ?? summaryRes?.production ?? sLive);
      const sInstalled = num(summaryRes?.installed_count ?? summaryRes?.installed);
      const sTraining = num(summaryRes?.training_count ?? summaryRes?.training);
      setSummaryData({
        total_target: sTarget,
        total_live: sLive,
        total_shortfall: sShortfall,
        production_count: sProduction,
        installed_count: sInstalled,
        training_count: sTraining,
      });

      // Normalize heatmap cells (direct array from backend or .cells)
      const rawCells: HeatmapCell[] = Array.isArray(heatmapRes)
        ? heatmapRes
        : Array.isArray(heatmapRes?.cells)
        ? heatmapRes.cells
        : [];
      setCells(rawCells);

      // Normalize unclassified rows
      const rawUnclassified: UnclassifiedRow[] = Array.isArray(unclassifiedRes)
        ? unclassifiedRes
        : Array.isArray(unclassifiedRes?.rows)
        ? unclassifiedRes.rows
        : [];
      setUnclassified(rawUnclassified);

      // Normalize regions list from summary.by_region or heatmap.regions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawRegions: any[] = Array.isArray(summaryRes?.by_region)
        ? summaryRes.by_region
        : Array.isArray(heatmapRes?.regions)
        ? heatmapRes.regions
        : Array.isArray(summaryRes?.regions)
        ? summaryRes.regions
        : [];

      const parsedRegions: RegionBarData[] = rawRegions.map((r) => ({
        region_code: Number(r.region_code),
        region_name: r.region_name || `Region ${r.region_code}`,
        target: num(r.target),
        live: num(r.live),
        shortfall: num(r.shortfall),
        shortfall_pct: num(r.shortfall_pct),
      }));
      setRegions(parsedRegions);

      if (Array.isArray(summaryRes?.matrix) && summaryRes.matrix.length > 0) {
        setRegionPreviews(summaryRes.matrix);
      } else {
        const previewData = await Promise.all(
          parsedRegions.map(async (region) => {
            try {
              const res = await api.getPanelRegion(region.region_code);
              const regionCells: RegionCell[] = Array.isArray(res?.cells)
                ? res.cells
                : Array.isArray(res)
                ? res
                : [];

              return {
                region_code: region.region_code,
                region_name: region.region_name,
                total_target: num(res?.total_target ?? region.target),
                total_live: num(res?.total_live ?? region.live),
                total_shortfall: num(res?.total_shortfall ?? region.shortfall),
                cells: regionCells,
              };
            } catch {
              return {
                region_code: region.region_code,
                region_name: region.region_name,
                total_target: region.target,
                total_live: region.live,
                total_shortfall: region.shortfall,
                cells: [],
              };
            }
          })
        );
        setRegionPreviews(previewData);
      }
    } catch (err) {
      console.error("Failed to load panel data:", err);
      setError(err instanceof Error ? err.message : "Unable to load panel data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open Region Drill Down
  const handleRegionClick = useCallback(async (regionCode: number) => {
    setActiveRegion(regionCode);
    setDrillError(null);
    setDrillLoading(true);
    setDrillView("dialog");

    try {
      const res = await api.getPanelRegion(regionCode);
      const resCells: RegionCell[] = Array.isArray(res?.cells)
        ? res.cells
        : Array.isArray(res)
        ? res
        : [];

      setDrillDown({
        region_code: Number(res?.region_code ?? regionCode),
        region_name: res?.region_name || `Region ${regionCode}`,
        total_target: num(res?.total_target),
        total_live: num(res?.total_live),
        total_shortfall: num(res?.total_shortfall),
        cells: resCells,
      });
    } catch (err) {
      setDrillError(err instanceof Error ? err.message : "Unable to load region data.");
    } finally {
      setDrillLoading(false);
    }
  }, []);

  const handleInlineRegionOpen = useCallback(async (regionCode: number) => {
    setActiveRegion(regionCode);
    setDrillError(null);
    setDrillLoading(true);
    setDrillView("inline");

    try {
      const res = await api.getPanelRegion(regionCode);
      const resCells: RegionCell[] = Array.isArray(res?.cells)
        ? res.cells
        : Array.isArray(res)
        ? res
        : [];

      setDrillDown({
        region_code: Number(res?.region_code ?? regionCode),
        region_name: res?.region_name || `Region ${regionCode}`,
        total_target: num(res?.total_target),
        total_live: num(res?.total_live),
        total_shortfall: num(res?.total_shortfall),
        cells: resCells,
      });
    } catch (err) {
      setDrillError(err instanceof Error ? err.message : "Unable to load region data.");
    } finally {
      setDrillLoading(false);
    }
  }, []);

  const handleCellClick = useCallback((sec: number, mosr: number) => {
    setHighlight((prev) =>
      prev?.sec === sec && prev?.mosr === mosr ? null : { sec, mosr }
    );
  }, []);

  const handleCloseDrillDown = useCallback(() => {
    setActiveRegion(null);
    setDrillDown(null);
    setDrillError(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Heading & Refresh */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel Management</h1>
          <p className="text-sm text-muted-foreground">
            Live panel status by region, SEC, and MOSR.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Unable to load panel data.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex min-h-60 flex-col items-center justify-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading panel data...</p>
        </div>
      ) : (
        <>
          {/* Section 1: Summary Cards */}
          <SummaryCards
            totalTarget={summaryData.total_target}
            totalLive={summaryData.total_live}
            totalShortfall={summaryData.total_shortfall}
            unclassifiedCount={unclassified.length}
            productionCount={summaryData.production_count}
            installedCount={summaryData.installed_count}
            trainingCount={summaryData.training_count}
          />

          <ShortfallReasonPanel
            totalShortfall={summaryData.total_shortfall}
            rows={unclassified}
          />

          {/* Section 2 & 4: Grouped Bar Chart & Stacked Bar Chart */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GroupedBarChartSection
              data={regions}
              activeRegion={activeRegion}
              onRegionClick={handleRegionClick}
              onBarClick={handleInlineRegionOpen}
            />
            <RegionPreviewGrid
              regions={regionPreviews.length > 0 ? regionPreviews : regions.map((region) => ({
                region_code: region.region_code,
                region_name: region.region_name,
                cells: [],
              }))}
              activeRegion={activeRegion}
              onRegionClick={handleInlineRegionOpen}
            />
          </div>

          {/* Section 3: Target Quota table & Installed Households table */}
          <div className="space-y-6">
            <TargetQuotaTable
              regions={regionPreviews.length > 0 ? regionPreviews : regions.map((region) => ({
                region_code: region.region_code,
                region_name: region.region_name,
                cells: [],
              }))}
              onRegionClick={handleInlineRegionOpen}
            />

            <InstalledHouseholdsTable
              regions={regionPreviews.length > 0 ? regionPreviews : regions.map((region) => ({
                region_code: region.region_code,
                region_name: region.region_name,
                cells: [],
              }))}
              onRegionClick={handleInlineRegionOpen}
            />
          </div>

          {/* Section 4: Heatmap Grid */}
          <HeatmapGridSection
            cells={cells}
            highlight={highlight}
            onCellClick={handleCellClick}
          />

          {/* Section 5: Region Drill Down */}
          {drillView === "inline" && activeRegion !== null && (
            <div>
              {drillLoading && (
                <Card className="border-primary/40 p-8">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-5 animate-spin text-primary" />
                    <span>Loading region {activeRegion} drill down...</span>
                  </div>
                </Card>
              )}
              {drillError && !drillLoading && (
                <div
                  role="alert"
                  className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                >
                  <span>{drillError}</span>
                  <button
                    type="button"
                    onClick={handleCloseDrillDown}
                    className="font-medium underline"
                  >
                    Close
                  </button>
                </div>
              )}
              {drillDown && !drillLoading && (
                <RegionDrillDownSection
                  data={drillDown}
                  onClose={handleCloseDrillDown}
                />
              )}
            </div>
          )}

          {drillView === "dialog" && activeRegion !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 backdrop-blur-[1px]">
              <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border bg-background shadow-2xl">
                {drillLoading && (
                  <Card className="border-primary/40 p-8">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-5 animate-spin text-primary" />
                      <span>Loading region {activeRegion} drill down...</span>
                    </div>
                  </Card>
                )}
                {drillError && !drillLoading && (
                  <div
                    role="alert"
                    className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                  >
                    <span>{drillError}</span>
                    <button
                      type="button"
                      onClick={handleCloseDrillDown}
                      className="font-medium underline"
                    >
                      Close
                    </button>
                  </div>
                )}
                {drillDown && !drillLoading && (
                  <RegionDrillDownSection
                    data={drillDown}
                    onClose={handleCloseDrillDown}
                  />
                )}
              </div>
            </div>
          )}

          {/* Section 6: Unclassified Table (shown only when unclassified count > 0) */}
          {unclassified.length > 0 && (
            <UnclassifiedTableSection rows={unclassified} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Region Preview Grid ───────────────────────────────────────────────────────

function RegionPreviewGrid({
  regions,
  activeRegion,
  onRegionClick,
}: {
  regions: Array<{
    region_code: number;
    region_name: string;
    cells?: RegionCell[];
    total_target?: number;
    total_live?: number;
    total_shortfall?: number;
  }>;
  activeRegion: number | null;
  onRegionClick: (regionCode: number) => void;
}) {
  if (!regions.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regions</CardTitle>
          <CardDescription>Select a region to inspect it.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No region data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Regions</CardTitle>
            <CardDescription>Click a region to open the detailed view.</CardDescription>
          </div>
          {activeRegion !== null && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Active: {activeRegion}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {regions.map((region) => {
            const isSelected = activeRegion === region.region_code;
            const live = num(region.total_live);
            const target = num(region.total_target);
            const shortfall = num(region.total_shortfall);

            return (
              <button
                key={region.region_code}
                type="button"
                onClick={() => onRegionClick(region.region_code)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {region.region_name || `Region ${region.region_code}`}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {live.toLocaleString()} / {target.toLocaleString()} live
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      shortfall > 0
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {shortfall > 0 ? `${shortfall.toLocaleString()} short` : "On target"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Target</span>
                  <span className="font-medium text-foreground">{target.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Live</span>
                  <span className="font-medium text-foreground">{live.toLocaleString()}</span>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function getGroupedInstalledHouseholdsData(
  regions: Array<{
    region_code: number;
    region_name: string;
    cells?: RegionCell[];
    total_target?: number;
    total_live?: number;
    total_shortfall?: number;
  }>
): { rows: InstalledHouseholdsRow[]; totalRow: InstalledHouseholdsTotalRow } {
  const regionList = regions;

  const rows: InstalledHouseholdsRow[] = regionList.map((region) => {
    const regionCells = Array.isArray(region.cells) ? region.cells : [];
    const rName = region.region_name || `Region ${region.region_code}`;

    const row: InstalledHouseholdsRow = {
      region_code: region.region_code,
      region_name: rName,
    };

    let grandLive = 0;
    let grandTarget = 0;

    SEC_LABELS.forEach((sec) => {
      let secLive = 0;
      let secTarget = 0;

      MOSR_LABELS.forEach((mosr) => {
        const key = `sec_${sec}_mosr_${mosr}`;
        // Always read targets and live production households directly from database cells
        const matched = regionCells.filter(
          (cell) => Number(cell.sec) === sec && Number(cell.mosr) === mosr
        );
        const liveVal = matched.reduce((sum, cell) => sum + num(cell.live), 0);
        const targetVal = matched.reduce((sum, cell) => sum + num(cell.target), 0);

        const shortfallVal = Math.max(0, targetVal - liveVal);
        const metPct = targetVal > 0 ? (liveVal / targetVal) * 100 : 100;

        row[key] = liveVal;
        row[`${key}_target`] = targetVal;
        row[`${key}_shortfall`] = shortfallVal;
        row[`${key}_met_pct`] = metPct;

        secLive += liveVal;
        secTarget += targetVal;
      });

      const secShortfall = Math.max(0, secTarget - secLive);
      const secMetPct = secTarget > 0 ? (secLive / secTarget) * 100 : 100;

      row[`sec_${sec}_total`] = secLive;
      row[`sec_${sec}_target`] = secTarget;
      row[`sec_${sec}_shortfall`] = secShortfall;
      row[`sec_${sec}_met_pct`] = secMetPct;

      grandLive += secLive;
      grandTarget += secTarget;
    });

    row.grand_total = grandLive;
    row.grand_target = grandTarget;
    row.grand_shortfall = Math.max(0, grandTarget - grandLive);
    row.grand_met_pct = grandTarget > 0 ? (grandLive / grandTarget) * 100 : 100;

    row.region_live = grandLive;
    row.region_target = grandTarget;
    row.region_shortfall = row.grand_shortfall;
    row.target_met_pct = row.grand_met_pct;

    return row;
  });

  const totalRow: InstalledHouseholdsTotalRow = {
    region_name: "Total",
  };

  let totalGrandLive = 0;
  let totalGrandTarget = 0;

  SEC_LABELS.forEach((sec) => {
    let secLiveTotal = 0;
    let secTargetTotal = 0;

    MOSR_LABELS.forEach((mosr) => {
      const key = `sec_${sec}_mosr_${mosr}`;
      const liveSum = rows.reduce((sum, row) => sum + num(row[key]), 0);
      const targetSum = rows.reduce((sum, row) => sum + num(row[`${key}_target`]), 0);
      const shortfallSum = Math.max(0, targetSum - liveSum);
      const metPctSum = targetSum > 0 ? (liveSum / targetSum) * 100 : 100;

      totalRow[key] = liveSum;
      totalRow[`${key}_target`] = targetSum;
      totalRow[`${key}_shortfall`] = shortfallSum;
      totalRow[`${key}_met_pct`] = metPctSum;

      secLiveTotal += liveSum;
      secTargetTotal += targetSum;
    });

    const secShortfallTotal = Math.max(0, secTargetTotal - secLiveTotal);
    const secMetPctTotal = secTargetTotal > 0 ? (secLiveTotal / secTargetTotal) * 100 : 100;

    totalRow[`sec_${sec}_total`] = secLiveTotal;
    totalRow[`sec_${sec}_target`] = secTargetTotal;
    totalRow[`sec_${sec}_shortfall`] = secShortfallTotal;
    totalRow[`sec_${sec}_met_pct`] = secMetPctTotal;

    totalGrandLive += secLiveTotal;
    totalGrandTarget += secTargetTotal;
  });

  totalRow.grand_total = totalGrandLive;
  totalRow.grand_target = totalGrandTarget;
  totalRow.grand_shortfall = Math.max(0, totalGrandTarget - totalGrandLive);
  totalRow.grand_met_pct = totalGrandTarget > 0 ? (totalGrandLive / totalGrandTarget) * 100 : 100;

  totalRow.region_live = totalGrandLive;
  totalRow.region_target = totalGrandTarget;
  totalRow.region_shortfall = totalRow.grand_shortfall;
  totalRow.target_met_pct = totalRow.grand_met_pct;

  return { rows, totalRow };
}

// ─── Target Quota Table (Exact Matrix Format) ─────────────────────────────────

function TargetQuotaTable({
  regions,
  onRegionClick,
}: {
  regions: Array<{
    region_code: number;
    region_name: string;
    cells?: RegionCell[];
    total_target?: number;
    total_live?: number;
    total_shortfall?: number;
  }>;
  onRegionClick?: (regionCode: number) => void;
}) {
  const { rows, totalRow } = getGroupedInstalledHouseholdsData(regions);
  const [isExtended, setIsExtended] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [hoveredCell, setHoveredCell] = useState<{
    regionName: string;
    sec: number;
    mosr: number;
    targetVal: number;
    regionTarget: number;
    colTarget: number;
  } | null>(null);

  useEffect(() => {
    if (!isExtended) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExtended(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExtended]);

  // Filter rows
  const filteredRows = rows.filter((r) =>
    r.region_name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Sort rows if sortKey is set
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortKey) return 0;
    if (sortKey === "region_name") {
      const cmp = a.region_name.localeCompare(b.region_name);
      return sortDesc ? -cmp : cmp;
    }
    const valA = num(a[sortKey]);
    const valB = num(b[sortKey]);
    return sortDesc ? valB - valA : valA - valB;
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDesc) {
        setSortDesc(false);
      } else {
        setSortKey(null);
        setSortDesc(true);
      }
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  // Copy as TSV (Tab Separated Values) for perfect pasting into Microsoft Excel / Google Sheets
  const handleCopyTSV = () => {
    const lines: string[] = [];
    lines.push("Target Quota Households");
    lines.push(
      [
        "SEC",
        "1", "", "", "", "1 Total",
        "2", "", "", "", "2 Total",
        "3", "", "", "", "3 Total",
        "Grand Total",
      ].join("\t")
    );
    lines.push(
      [
        "Region/MOSR",
        "1", "2", "3", "4", "",
        "1", "2", "3", "4", "",
        "1", "2", "3", "4", "",
        "",
      ].join("\t")
    );

    sortedRows.forEach((row) => {
      const parts = [row.region_name];
      SEC_LABELS.forEach((sec) => {
        MOSR_LABELS.forEach((mosr) => {
          parts.push(String(num(row[`sec_${sec}_mosr_${mosr}_target`])));
        });
        parts.push(String(num(row[`sec_${sec}_target`])));
      });
      parts.push(String(num(row.grand_target)));
      lines.push(parts.join("\t"));
    });

    const totalParts = ["Total"];
    SEC_LABELS.forEach((sec) => {
      MOSR_LABELS.forEach((mosr) => {
        totalParts.push(String(num(totalRow[`sec_${sec}_mosr_${mosr}_target`])));
      });
      totalParts.push(String(num(totalRow[`sec_${sec}_target`])));
    });
    totalParts.push(String(num(totalRow.grand_target)));
    lines.push(totalParts.join("\t"));

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as CSV file
  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push('"Target Quota Households"');
    lines.push(
      [
        '"SEC"',
        '"1"', '""', '""', '""', '"1 Total"',
        '"2"', '""', '""', '""', '"2 Total"',
        '"3"', '""', '""', '""', '"3 Total"',
        '"Grand Total"',
      ].join(",")
    );
    lines.push(
      [
        '"Region/MOSR"',
        '"1"', '"2"', '"3"', '"4"', '""',
        '"1"', '"2"', '"3"', '"4"', '""',
        '"1"', '"2"', '"3"', '"4"', '""',
        '""',
      ].join(",")
    );

    sortedRows.forEach((row) => {
      const parts = [`"${row.region_name}"`];
      SEC_LABELS.forEach((sec) => {
        MOSR_LABELS.forEach((mosr) => {
          parts.push(`"${num(row[`sec_${sec}_mosr_${mosr}_target`])}"`);
        });
        parts.push(`"${num(row[`sec_${sec}_target`])}"`);
      });
      parts.push(`"${num(row.grand_target)}"`);
      lines.push(parts.join(","));
    });

    const totalParts = ['"Total"'];
    SEC_LABELS.forEach((sec) => {
      MOSR_LABELS.forEach((mosr) => {
        totalParts.push(`"${num(totalRow[`sec_${sec}_mosr_${mosr}_target`])}"`);
      });
      totalParts.push(`"${num(totalRow[`sec_${sec}_target`])}"`);
    });
    totalParts.push(`"${num(totalRow.grand_target)}"`);
    lines.push(totalParts.join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "target_quota_households.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {isExtended && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsExtended(false)}
        />
      )}
      <Card
        className={`overflow-hidden border border-border shadow-sm transition-all duration-200 ${
          isExtended
            ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 flex flex-col bg-card shadow-2xl rounded-xl border-2 border-indigo-500/40"
            : ""
        }`}
      >
        {isExtended && (
          <div className="flex items-center justify-between px-4 py-2 bg-indigo-700 text-white text-xs font-medium shrink-0">
            <div className="flex items-center gap-2">
              <Maximize2 className="size-3.5" />
              <span className="font-semibold">Target Quota Matrix (Extended View)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExtended(false)}
              className="flex items-center gap-1 hover:text-indigo-200 transition-colors text-xs font-semibold"
            >
              <span>Press Esc or click to exit</span>
              <X className="size-3.5 ml-1" />
            </button>
          </div>
        )}

        {/* Top Toolbar */}
        <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <Target className="size-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm md:text-base">
                  Target Quota Table
                </h3>
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-950 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                  {num(totalRow.grand_target)} Master Target
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Master target quota allocation by Region, SEC (1–3), and MOSR (1–4)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-40 md:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter region..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyTSV}
              className="h-8 gap-1 text-xs"
              title="Copy as TSV to paste directly into Microsoft Excel or Google Sheets"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 gap-1 text-xs"
              title="Download CSV spreadsheet"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>

            <Button
              type="button"
              variant={isExtended ? "default" : "outline"}
              size="sm"
              onClick={() => setIsExtended(!isExtended)}
              className={`h-8 gap-1.5 text-xs font-medium transition-colors ${
                isExtended
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : ""
              }`}
              title={isExtended ? "Exit Extended View (Esc)" : "Expand table into full-screen extended view"}
            >
              {isExtended ? (
                <>
                  <Minimize2 className="size-3.5" />
                  <span>Exit Extended</span>
                </>
              ) : (
                <>
                  <Maximize2 className="size-3.5" />
                  <span>Extended View</span>
                </>
              )}
            </Button>
          </div>
        </div>

      {/* Dynamic Hover Banner */}
      <div className="min-h-[30px] border-b bg-slate-50 dark:bg-slate-900/60 px-4 py-1.5 text-xs text-muted-foreground flex items-center justify-between shrink-0">
        {hoveredCell ? (
          <div className="flex items-center gap-2 truncate text-foreground animate-in fade-in duration-150">
            <span className="inline-block size-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="font-semibold">{hoveredCell.regionName}</span>
            <span>·</span>
            <span className="font-medium">SEC {hoveredCell.sec} / MOSR {hoveredCell.mosr} Target</span>
            <span>:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {hoveredCell.targetVal} Households
            </span>
            <span className="text-muted-foreground">
              — {hoveredCell.regionTarget > 0 ? ((hoveredCell.targetVal / hoveredCell.regionTarget) * 100).toFixed(1) : 0}% of {hoveredCell.regionName} target · {hoveredCell.colTarget > 0 ? ((hoveredCell.targetVal / hoveredCell.colTarget) * 100).toFixed(1) : 0}% of National SEC {hoveredCell.sec}-MOSR {hoveredCell.mosr} target
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Target className="size-3 text-indigo-500" />
            <span>Target Quota Distribution · Click any column header to sort</span>
          </div>
        )}

        {sortKey && (
          <button
            type="button"
            onClick={() => setSortKey(null)}
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 ml-2"
          >
            Reset Sort
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className={`overflow-x-auto ${isExtended ? "flex-1 overflow-y-auto" : ""}`}>
        <table className="w-full min-w-[960px] border-collapse text-xs font-sans">
          <thead className={isExtended ? "sticky top-0 z-30 shadow-xs" : undefined}>
            {/* Title Banner spanning all 17 columns */}
            <tr>
              <th
                colSpan={17}
                className="bg-[#4338ca] dark:bg-indigo-950 text-white font-bold py-2.5 px-4 text-center text-sm tracking-wide border border-indigo-700 dark:border-indigo-900 shadow-inner select-none"
              >
                Target Quota Households
              </th>
            </tr>

            {/* Row 1: SEC headers */}
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold select-none">
              <th
                onClick={() => toggleSort("region_name")}
                className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left w-36 font-bold bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Click to sort by Region"
              >
                <div className="flex items-center justify-between">
                  <span>SEC</span>
                  {renderSortIndicator(sortKey === "region_name", sortDesc)}
                </div>
              </th>

              {SEC_LABELS.map((sec) => (
                <Fragment key={`target-sec-hdr-group-${sec}`}>
                  <th
                    colSpan={4}
                    className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-bold tracking-wide bg-slate-100 dark:bg-slate-800"
                  >
                    {sec}
                  </th>
                  <th
                    onClick={() => toggleSort(`sec_${sec}_target`)}
                    className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                    title={`Click to sort by SEC ${sec} Target Total`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{sec} Total</span>
                      {renderSortIndicator(sortKey === `sec_${sec}_target`, sortDesc)}
                    </div>
                  </th>
                </Fragment>
              ))}

              <th
                onClick={() => toggleSort("grand_target")}
                className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-bold bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-950 dark:text-indigo-100 cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                title="Click to sort by Grand Target"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Grand Total</span>
                  {renderSortIndicator(sortKey === "grand_target", sortDesc)}
                </div>
              </th>
            </tr>

            {/* Row 2: Region/MOSR headers */}
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold select-none">
              <th
                onClick={() => toggleSort("region_name")}
                className="border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-left font-bold bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Region/MOSR
              </th>
              {SEC_LABELS.map((sec) => (
                <Fragment key={`target-sec-mosr-group-${sec}`}>
                  {MOSR_LABELS.map((mosr) => {
                    const colKey = `sec_${sec}_mosr_${mosr}_target`;
                    const isSorted = sortKey === colKey;
                    const isHovered = hoveredCell?.sec === sec && hoveredCell?.mosr === mosr;

                    return (
                      <th
                        key={`target-sec-${sec}-mosr-hdr-${mosr}`}
                        onClick={() => toggleSort(colKey)}
                        className={`border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-bold w-12 cursor-pointer transition-colors ${
                          isHovered
                            ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100"
                            : "hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                        title={`Click to sort by SEC ${sec} MOSR ${mosr} Target`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span>{mosr}</span>
                          {renderSortIndicator(isSorted, sortDesc)}
                        </div>
                      </th>
                    );
                  })}
                  <th
                    key={`target-sec-${sec}-empty-hdr`}
                    className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center bg-indigo-50 dark:bg-indigo-950/60 w-16"
                  >
                    &nbsp;
                  </th>
                </Fragment>
              ))}
              <th className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center bg-indigo-100/80 dark:bg-indigo-950/80 w-20">
                &nbsp;
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={17}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  No regions found matching "{searchQuery}"
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isRowHovered = hoveredCell?.regionName === row.region_name;
                const rowGrandTarget = num(row.grand_target);

                return (
                  <tr
                    key={`target-${row.region_code ?? row.region_name}`}
                    className={`transition-colors group ${
                      isRowHovered
                        ? "bg-indigo-50/70 dark:bg-indigo-950/40"
                        : "hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                    }`}
                  >
                    {/* Region Cell */}
                    <td
                      onClick={() => onRegionClick && row.region_code && onRegionClick(row.region_code)}
                      className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                        onRegionClick ? "cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" : ""
                      } ${
                        isRowHovered
                          ? "bg-indigo-100/90 dark:bg-indigo-900/70 font-semibold"
                          : "bg-background group-hover:bg-indigo-50/40 dark:group-hover:bg-indigo-950/20"
                      }`}
                      title={onRegionClick ? `Click to inspect ${row.region_name} drill down` : undefined}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{row.region_name}</span>
                        {onRegionClick && (
                          <ExternalLink className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        )}
                      </div>
                    </td>

                    {/* SEC Matrix Columns */}
                    {SEC_LABELS.map((sec) => (
                      <Fragment key={`target-${row.region_name}-sec-${sec}`}>
                        {MOSR_LABELS.map((mosr) => {
                          const targetVal = num(row[`sec_${sec}_mosr_${mosr}_target`]);
                          const colTarget = num(totalRow[`sec_${sec}_mosr_${mosr}_target`]);

                          const isCellHovered =
                            hoveredCell?.regionName === row.region_name &&
                            hoveredCell?.sec === sec &&
                            hoveredCell?.mosr === mosr;
                          const isColHovered =
                            hoveredCell?.sec === sec && hoveredCell?.mosr === mosr;

                          return (
                            <td
                              key={`target-${row.region_name}-${sec}-${mosr}`}
                              onMouseEnter={() =>
                                setHoveredCell({
                                  regionName: row.region_name,
                                  sec,
                                  mosr,
                                  targetVal,
                                  regionTarget: rowGrandTarget,
                                  colTarget,
                                })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-mono tabular-nums transition-all ${
                                isCellHovered
                                  ? "ring-2 ring-indigo-500 font-bold z-10 scale-[1.05] shadow-xs"
                                  : isColHovered
                                  ? "bg-indigo-50/50 dark:bg-indigo-950/30"
                                  : ""
                              } ${
                                targetVal === 0
                                  ? "text-slate-400 dark:text-slate-500 font-normal"
                                  : "text-slate-800 dark:text-slate-100 font-medium"
                              }`}
                            >
                              {targetVal}
                            </td>
                          );
                        })}

                        {/* SEC Group Total Column */}
                        <td
                          className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-mono tabular-nums font-bold bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200"
                        >
                          {num(row[`sec_${sec}_target`])}
                        </td>
                      </Fragment>
                    ))}

                    {/* Region Grand Target Column */}
                    <td
                      className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-mono tabular-nums font-bold bg-indigo-100/90 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-100"
                    >
                      {rowGrandTarget}
                    </td>
                  </tr>
                );
              })
            )}

            {/* Total Row */}
            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-400 dark:border-slate-600">
              <td className="border border-slate-300 dark:border-slate-700 px-3 py-2.5 text-left font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                Total
              </td>

              {SEC_LABELS.map((sec) => (
                <Fragment key={`target-total-sec-${sec}`}>
                  {MOSR_LABELS.map((mosr) => {
                    const colTarget = num(totalRow[`sec_${sec}_mosr_${mosr}_target`]);
                    const isColHovered =
                      hoveredCell?.sec === sec && hoveredCell?.mosr === mosr;

                    return (
                      <td
                        key={`target-total-${sec}-${mosr}`}
                        className={`border border-slate-300 dark:border-slate-700 px-2 py-2.5 text-center font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 transition-colors ${
                          isColHovered ? "bg-indigo-200/60 dark:bg-indigo-900/60" : ""
                        }`}
                      >
                        {colTarget}
                      </td>
                    );
                  })}

                  <td className="border border-slate-300 dark:border-slate-700 px-2 py-2.5 text-center font-mono tabular-nums font-bold bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-950 dark:text-indigo-100">
                    {num(totalRow[`sec_${sec}_target`])}
                  </td>
                </Fragment>
              ))}

              <td className="border border-slate-300 dark:border-slate-700 px-2 py-2.5 text-center font-mono text-sm tabular-nums font-extrabold bg-indigo-200/90 dark:bg-indigo-900/90 text-indigo-950 dark:text-indigo-50">
                {num(totalRow.grand_target)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </>
);
}

type MatrixMetric = "installed" | "target" | "shortfall" | "fulfillment";

function InstalledHouseholdsTable({
  regions,
  onRegionClick,
}: {
  regions: Array<{
    region_code: number;
    region_name: string;
    cells?: RegionCell[];
    total_target?: number;
    total_live?: number;
    total_shortfall?: number;
  }>;
  onRegionClick?: (regionCode: number) => void;
}) {
  const { rows, totalRow } = getGroupedInstalledHouseholdsData(regions);
  const [isExtended, setIsExtended] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayMetric, setDisplayMetric] = useState<MatrixMetric>("installed");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [hoveredCell, setHoveredCell] = useState<{
    regionName: string;
    sec: number;
    mosr: number;
    val: number;
    targetVal: number;
    shortfallVal: number;
    metPct: number;
    regionTotal: number;
    colTotal: number;
  } | null>(null);

  useEffect(() => {
    if (!isExtended) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExtended(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExtended]);

  // Filter rows
  const filteredRows = rows.filter((r) =>
    r.region_name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Sort rows if sortKey is set
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortKey) return 0;
    if (sortKey === "region_name") {
      const cmp = a.region_name.localeCompare(b.region_name);
      return sortDesc ? -cmp : cmp;
    }
    const valA = num(a[sortKey]);
    const valB = num(b[sortKey]);
    return sortDesc ? valB - valA : valA - valB;
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDesc) {
        setSortDesc(false);
      } else {
        setSortKey(null);
        setSortDesc(true);
      }
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  // Find max live cell for heatmap calculation
  const maxLiveCell = useMemo(() => {
    let max = 1;
    rows.forEach((r) => {
      SEC_LABELS.forEach((s) => {
        MOSR_LABELS.forEach((m) => {
          const v = num(r[`sec_${s}_mosr_${m}`]);
          if (v > max) max = v;
        });
      });
    });
    return max;
  }, [rows]);

  // Compute key insights
  const insights = useMemo(() => {
    const totalLive = num(totalRow.grand_total);
    const totalTarget = num(totalRow.grand_target);
    const totalShortfall = num(totalRow.grand_shortfall);

    let topRegionName = "—";
    let topRegionLive = 0;
    rows.forEach((r) => {
      const g = num(r.grand_total);
      if (g > topRegionLive) {
        topRegionLive = g;
        topRegionName = r.region_name;
      }
    });

    let dominantSec = 2;
    let maxSecTotal = 0;
    SEC_LABELS.forEach((s) => {
      const st = num(totalRow[`sec_${s}_total`]);
      if (st > maxSecTotal) {
        maxSecTotal = st;
        dominantSec = s;
      }
    });

    let peakCellSec = 2;
    let peakCellMosr = 3;
    let peakCellCount = 0;
    SEC_LABELS.forEach((s) => {
      MOSR_LABELS.forEach((m) => {
        const c = num(totalRow[`sec_${s}_mosr_${m}`]);
        if (c > peakCellCount) {
          peakCellCount = c;
          peakCellSec = s;
          peakCellMosr = m;
        }
      });
    });

    return {
      topRegionName,
      topRegionLive,
      topRegionPct: totalLive > 0 ? ((topRegionLive / totalLive) * 100).toFixed(1) : "0",
      dominantSec,
      dominantSecTotal: maxSecTotal,
      dominantSecPct: totalLive > 0 ? ((maxSecTotal / totalLive) * 100).toFixed(1) : "0",
      peakCellSec,
      peakCellMosr,
      peakCellCount,
      totalLive,
      totalTarget,
      totalShortfall,
      metPct: totalTarget > 0 ? ((totalLive / totalTarget) * 100).toFixed(1) : "100",
    };
  }, [rows, totalRow]);

  // Copy as TSV (Tab Separated Values) for perfect pasting into Microsoft Excel / Google Sheets
  const handleCopyTSV = () => {
    const lines: string[] = [];
    lines.push(`Installed Households (${displayMetric.toUpperCase()})`);
    lines.push(
      [
        "SEC",
        "1", "", "", "", "1 Total",
        "2", "", "", "", "2 Total",
        "3", "", "", "", "3 Total",
        "Grand Total",
      ].join("\t")
    );
    lines.push(
      [
        "Region/MOSR",
        "1", "2", "3", "4", "",
        "1", "2", "3", "4", "",
        "1", "2", "3", "4", "",
        "",
      ].join("\t")
    );

    sortedRows.forEach((row) => {
      const parts = [row.region_name];
      SEC_LABELS.forEach((sec) => {
        MOSR_LABELS.forEach((mosr) => {
          parts.push(getCellValue(row, sec, mosr, displayMetric).display);
        });
        parts.push(getGroupTotalValue(row, sec, displayMetric).display);
      });
      parts.push(getGrandTotalValue(row, displayMetric).display);
      lines.push(parts.join("\t"));
    });

    const totalParts = ["Total"];
    SEC_LABELS.forEach((sec) => {
      MOSR_LABELS.forEach((mosr) => {
        totalParts.push(getCellValue(totalRow, sec, mosr, displayMetric).display);
      });
      totalParts.push(getGroupTotalValue(totalRow, sec, displayMetric).display);
    });
    totalParts.push(getGrandTotalValue(totalRow, displayMetric).display);
    lines.push(totalParts.join("\t"));

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as CSV file
  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push(`"Installed Households (${displayMetric})"`);
    lines.push(
      [
        '"SEC"',
        '"1"', '""', '""', '""', '"1 Total"',
        '"2"', '""', '""', '""', '"2 Total"',
        '"3"', '""', '""', '""', '"3 Total"',
        '"Grand Total"',
      ].join(",")
    );
    lines.push(
      [
        '"Region/MOSR"',
        '"1"', '"2"', '"3"', '"4"', '""',
        '"1"', '"2"', '"3"', '"4"', '""',
        '"1"', '"2"', '"3"', '"4"', '""',
        '""',
      ].join(",")
    );

    sortedRows.forEach((row) => {
      const parts = [`"${row.region_name}"`];
      SEC_LABELS.forEach((sec) => {
        MOSR_LABELS.forEach((mosr) => {
          parts.push(`"${getCellValue(row, sec, mosr, displayMetric).display}"`);
        });
        parts.push(`"${getGroupTotalValue(row, sec, displayMetric).display}"`);
      });
      parts.push(`"${getGrandTotalValue(row, displayMetric).display}"`);
      lines.push(parts.join(","));
    });

    const totalParts = ['"Total"'];
    SEC_LABELS.forEach((sec) => {
      MOSR_LABELS.forEach((mosr) => {
        totalParts.push(`"${getCellValue(totalRow, sec, mosr, displayMetric).display}"`);
      });
      totalParts.push(`"${getGroupTotalValue(totalRow, sec, displayMetric).display}"`);
    });
    totalParts.push(`"${getGrandTotalValue(totalRow, displayMetric).display}"`);
    lines.push(totalParts.join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `installed_households_${displayMetric}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {isExtended && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsExtended(false)}
        />
      )}
      <Card
        className={`overflow-hidden border border-border shadow-sm transition-all duration-200 ${
          isExtended
            ? "fixed inset-2 sm:inset-4 md:inset-6 z-50 flex flex-col bg-card shadow-2xl rounded-xl border-2 border-blue-500/40"
            : ""
        }`}
      >
        {isExtended && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-700 text-white text-xs font-medium shrink-0">
            <div className="flex items-center gap-2">
              <Maximize2 className="size-3.5" />
              <span className="font-semibold">Installed Households Matrix (Extended View — {displayMetric.toUpperCase()})</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExtended(false)}
              className="flex items-center gap-1 hover:text-blue-200 transition-colors text-xs font-semibold"
            >
              <span>Press Esc or click to exit</span>
              <X className="size-3.5 ml-1" />
            </button>
          </div>
        )}

        {/* 1. Creative Executive Insights Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3.5 bg-gradient-to-r from-muted/50 via-muted/20 to-muted/50 border-b text-xs shrink-0">
        <div className="flex items-center gap-2.5 rounded-lg border bg-background/80 p-2.5 shadow-2xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">Top Region</div>
            <div className="truncate font-semibold text-foreground">
              {insights.topRegionName} <span className="font-normal text-muted-foreground">({insights.topRegionLive} · {insights.topRegionPct}%)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border bg-background/80 p-2.5 shadow-2xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <Layers className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">Dominant SEC</div>
            <div className="truncate font-semibold text-foreground">
              SEC {insights.dominantSec} <span className="font-normal text-muted-foreground">({insights.dominantSecTotal} · {insights.dominantSecPct}%)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border bg-background/80 p-2.5 shadow-2xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <Target className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">Peak Cluster Cell</div>
            <div className="truncate font-semibold text-foreground">
              SEC {insights.peakCellSec} · MOSR {insights.peakCellMosr} <span className="font-normal text-muted-foreground">({insights.peakCellCount} live)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border bg-background/80 p-2.5 shadow-2xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-medium">Panel Progress</div>
            <div className="truncate font-semibold text-foreground">
              {insights.totalLive}/{insights.totalTarget} <span className="font-normal text-emerald-600 dark:text-emerald-400">({insights.metPct}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Interactive Toolbar */}
      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between border-b bg-background shrink-0">
        {/* Metric Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1">
            Display:
          </span>
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDisplayMetric("installed")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                displayMetric === "installed"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Installed (Live)
            </button>
            <button
              type="button"
              onClick={() => setDisplayMetric("target")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                displayMetric === "target"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Target Quota
            </button>
            <button
              type="button"
              onClick={() => setDisplayMetric("shortfall")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                displayMetric === "shortfall"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Shortfall
            </button>
            <button
              type="button"
              onClick={() => setDisplayMetric("fulfillment")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                displayMetric === "fulfillment"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              % Fulfilled
            </button>
          </div>

          {/* Heatmap intensity toggle */}
          <button
            type="button"
            onClick={() => setHeatmapEnabled(!heatmapEnabled)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
              heatmapEnabled
                ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle data-density heatmap coloring on cells"
          >
            <Flame className="size-3.5" />
            <span>Heatmap</span>
          </button>
        </div>

        {/* Right Tools: Filter + Copy + CSV */}
        <div className="flex items-center gap-2">
          <div className="relative w-40 md:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter region..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyTSV}
            className="h-8 gap-1 text-xs"
            title="Copy as TSV to paste directly into Microsoft Excel or Google Sheets"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 gap-1 text-xs"
            title="Download CSV spreadsheet"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </Button>

          {/* Extended View Toggle */}
          <Button
            type="button"
            variant={isExtended ? "default" : "outline"}
            size="sm"
            onClick={() => setIsExtended(!isExtended)}
            className={`h-8 gap-1.5 text-xs font-medium transition-colors ${
              isExtended
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : ""
            }`}
            title={
              isExtended
                ? "Exit Extended View (Esc)"
                : "Expand table into full-screen extended view"
            }
          >
            {isExtended ? (
              <>
                <Minimize2 className="size-3.5" />
                <span>Exit Extended</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                <span>Extended View</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 3. Dynamic Interactive Hover Cross-hair Banner */}
      <div className="min-h-[30px] border-b bg-slate-50 dark:bg-slate-900/60 px-4 py-1.5 text-xs text-muted-foreground flex items-center justify-between">
        {hoveredCell ? (
          <div className="flex items-center gap-2 truncate text-foreground animate-in fade-in duration-150">
            <span className="inline-block size-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-semibold">{hoveredCell.regionName}</span>
            <span>·</span>
            <span className="font-medium">SEC {hoveredCell.sec} / MOSR {hoveredCell.mosr}</span>
            <span>:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {hoveredCell.val} Live
            </span>
            <span className="text-muted-foreground">
              (Target: {hoveredCell.targetVal} · Shortfall: {hoveredCell.shortfallVal} · {hoveredCell.metPct.toFixed(1)}% Met)
            </span>
            <span className="hidden md:inline text-muted-foreground/80">
              — {hoveredCell.regionTotal > 0 ? ((hoveredCell.val / hoveredCell.regionTotal) * 100).toFixed(1) : 0}% of {hoveredCell.regionName} · {hoveredCell.colTotal > 0 ? ((hoveredCell.val / hoveredCell.colTotal) * 100).toFixed(1) : 0}% of National
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3 text-blue-500" />
            <span>Click any column header to sort · Hover any cell to inspect breakdown · Click region name to drill down</span>
          </div>
        )}

        {sortKey && (
          <button
            type="button"
            onClick={() => setSortKey(null)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
          >
            Reset Sort
          </button>
        )}
      </div>

      {/* 4. Exact 17-Column Table Structure */}
      <div
        className={`overflow-x-auto ${
          isExtended ? "flex-1 min-h-0 overflow-y-auto" : ""
        }`}
      >
        <table className="w-full min-w-[960px] border-collapse text-xs font-sans">
          <thead className={isExtended ? "sticky top-0 z-30 shadow-xs" : undefined}>
            {/* Title Banner spanning all 17 columns */}
            <tr>
              <th
                colSpan={17}
                className="bg-[#5b8ec9] dark:bg-blue-900 text-white font-bold py-2.5 px-4 text-center text-sm tracking-wide border border-[#4a77bb] dark:border-blue-800 shadow-inner select-none"
              >
                Installed Households
              </th>
            </tr>

            {/* Row 1: SEC headers */}
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold select-none">
              <th
                onClick={() => toggleSort("region_name")}
                className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left w-36 font-bold bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Click to sort by Region"
              >
                <div className="flex items-center justify-between">
                  <span>SEC</span>
                  {renderSortIndicator(sortKey === "region_name", sortDesc)}
                </div>
              </th>

              {SEC_LABELS.map((sec) => (
                <Fragment key={`sec-header-group-${sec}`}>
                  <th
                    colSpan={4}
                    className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-bold tracking-wide bg-slate-100 dark:bg-slate-800"
                  >
                    {sec}
                  </th>
                  <th
                    onClick={() => toggleSort(`sec_${sec}_total`)}
                    className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/80 transition-colors"
                    title={`Click to sort by SEC ${sec} Total`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{sec} Total</span>
                      {renderSortIndicator(sortKey === `sec_${sec}_total`, sortDesc)}
                    </div>
                  </th>
                </Fragment>
              ))}

              <th
                onClick={() => toggleSort("grand_total")}
                className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-bold bg-blue-100/80 dark:bg-blue-950/80 text-blue-950 dark:text-blue-100 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
                title="Click to sort by Grand Total"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Grand Total</span>
                  {renderSortIndicator(sortKey === "grand_total", sortDesc)}
                </div>
              </th>
            </tr>

            {/* Row 2: Region/MOSR headers */}
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold select-none">
              <th
                onClick={() => toggleSort("region_name")}
                className="border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-left font-bold bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Region/MOSR
              </th>
              {SEC_LABELS.map((sec) => (
                <Fragment key={`sec-mosr-group-${sec}`}>
                  {MOSR_LABELS.map((mosr) => {
                    const colKey = `sec_${sec}_mosr_${mosr}`;
                    const isSorted = sortKey === colKey;
                    const isHovered = hoveredCell?.sec === sec && hoveredCell?.mosr === mosr;

                    return (
                      <th
                        key={`sec-${sec}-mosr-hdr-${mosr}`}
                        onClick={() => toggleSort(colKey)}
                        className={`border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-bold w-12 cursor-pointer transition-colors ${
                          isHovered
                            ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                            : "hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                        title={`Click to sort by SEC ${sec} MOSR ${mosr}`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span>{mosr}</span>
                          {renderSortIndicator(isSorted, sortDesc)}
                        </div>
                      </th>
                    );
                  })}
                  <th
                    key={`sec-${sec}-empty-hdr`}
                    className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center bg-sky-50 dark:bg-sky-950/60 w-16"
                  >
                    &nbsp;
                  </th>
                </Fragment>
              ))}
              <th className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center bg-blue-100/80 dark:bg-blue-950/80 w-20">
                &nbsp;
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={17}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  No regions found matching "{searchQuery}"
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const isRowHovered = hoveredCell?.regionName === row.region_name;
                const rowGrandLive = num(row.grand_total);
                const grandTotalCell = getGrandTotalValue(row, displayMetric);

                return (
                  <tr
                    key={row.region_code ?? row.region_name}
                    className={`transition-colors group ${
                      isRowHovered
                        ? "bg-blue-50/70 dark:bg-blue-950/40"
                        : "hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                    }`}
                  >
                    {/* Region Cell: Clean, with subtle click to drill down */}
                    <td
                      onClick={() => onRegionClick && row.region_code && onRegionClick(row.region_code)}
                      className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                        onRegionClick ? "cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" : ""
                      } ${
                        isRowHovered
                          ? "bg-blue-100/90 dark:bg-blue-900/70 font-semibold"
                          : "bg-background group-hover:bg-blue-50/40 dark:group-hover:bg-blue-950/20"
                      }`}
                      title={onRegionClick ? `Click to inspect ${row.region_name} drill down` : undefined}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{row.region_name}</span>
                        {onRegionClick && (
                          <ExternalLink className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        )}
                      </div>
                    </td>

                    {/* SEC Matrix Columns */}
                    {SEC_LABELS.map((sec) => (
                      <Fragment key={`${row.region_name}-sec-${sec}`}>
                        {MOSR_LABELS.map((mosr) => {
                          const liveVal = num(row[`sec_${sec}_mosr_${mosr}`]);
                          const targetVal = num(row[`sec_${sec}_mosr_${mosr}_target`]);
                          const shortfallVal = num(row[`sec_${sec}_mosr_${mosr}_shortfall`]);
                          const metPct = num(row[`sec_${sec}_mosr_${mosr}_met_pct`]);
                          const colTotal = num(totalRow[`sec_${sec}_mosr_${mosr}`]);

                          const cellData = getCellValue(row, sec, mosr, displayMetric);
                          const isCellHovered =
                            hoveredCell?.regionName === row.region_name &&
                            hoveredCell?.sec === sec &&
                            hoveredCell?.mosr === mosr;
                          const isColHovered =
                            hoveredCell?.sec === sec && hoveredCell?.mosr === mosr;

                          // Heatmap styling
                          const heatmapBg =
                            heatmapEnabled && displayMetric === "installed"
                              ? getHeatmapBg(liveVal, maxLiveCell)
                              : undefined;

                          return (
                            <td
                              key={`${row.region_name}-${sec}-${mosr}`}
                              onMouseEnter={() =>
                                setHoveredCell({
                                  regionName: row.region_name,
                                  sec,
                                  mosr,
                                  val: liveVal,
                                  targetVal,
                                  shortfallVal,
                                  metPct,
                                  regionTotal: rowGrandLive,
                                  colTotal,
                                })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              style={heatmapBg ? { backgroundColor: heatmapBg } : undefined}
                              className={`border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-mono tabular-nums transition-all ${
                                isCellHovered
                                  ? "ring-2 ring-blue-500 font-bold z-10 scale-[1.05] shadow-xs"
                                  : isColHovered
                                  ? "bg-blue-50/50 dark:bg-blue-950/30"
                                  : ""
                              } ${cellData.className}`}
                            >
                              {cellData.display}
                            </td>
                          );
                        })}

                        {/* SEC Group Total Column */}
                        <td
                          className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-mono tabular-nums font-bold bg-sky-50/70 dark:bg-sky-950/30 text-sky-950 dark:text-sky-200"
                        >
                          {getGroupTotalValue(row, sec, displayMetric).display}
                        </td>
                      </Fragment>
                    ))}

                    {/* Region Grand Total Column */}
                    <td
                      className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center font-mono tabular-nums font-bold bg-blue-50/90 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100"
                    >
                      {grandTotalCell.display}
                    </td>
                  </tr>
                );
              })
            )}

            {/* Total Row */}
            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-400 dark:border-slate-600">
              <td className="border border-slate-300 dark:border-slate-700 px-3 py-2.5 text-left font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                Total
              </td>

              {SEC_LABELS.map((sec) => (
                <Fragment key={`total-sec-${sec}`}>
                  {MOSR_LABELS.map((mosr) => {
                    const colCell = getCellValue(totalRow, sec, mosr, displayMetric);
                    const isColHovered =
                      hoveredCell?.sec === sec && hoveredCell?.mosr === mosr;

                    return (
                      <td
                        key={`total-${sec}-${mosr}`}
                        className={`border border-slate-300 dark:border-slate-700 px-2 py-2.5 text-center font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 transition-colors ${
                          isColHovered ? "bg-blue-200/60 dark:bg-blue-900/60" : ""
                        }`}
                      >
                        {colCell.display}
                      </td>
                    );
                  })}

                  <td className="border border-slate-300 dark:border-slate-700 px-2 py-2.5 text-center font-mono tabular-nums font-bold bg-sky-100/80 dark:bg-sky-900/60 text-sky-950 dark:text-sky-100">
                    {getGroupTotalValue(totalRow, sec, displayMetric).display}
                  </td>
                </Fragment>
              ))}

              <td className="border border-slate-300 dark:border-slate-700 px-2 py-2.5 text-center font-mono text-sm tabular-nums font-extrabold bg-blue-100 dark:bg-blue-900/80 text-blue-950 dark:text-blue-50">
                {getGrandTotalValue(totalRow, displayMetric).display}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </>
);
}

// ─── Helper Functions for Matrix Formats ──────────────────────────────────────

function getCellValue(
  row: InstalledHouseholdsRow | InstalledHouseholdsTotalRow,
  sec: number,
  mosr: number,
  metric: MatrixMetric
): { display: string; className: string } {
  const live = num(row[`sec_${sec}_mosr_${mosr}`]);
  const target = num(row[`sec_${sec}_mosr_${mosr}_target`]);
  const shortfall = num(row[`sec_${sec}_mosr_${mosr}_shortfall`]);
  const metPct = num(row[`sec_${sec}_mosr_${mosr}_met_pct`]);

  if (metric === "target") {
    return {
      display: String(target),
      className: target === 0 ? "text-slate-400 dark:text-slate-500 font-normal" : "text-slate-800 dark:text-slate-100 font-medium",
    };
  }

  if (metric === "shortfall") {
    if (shortfall === 0) {
      return {
        display: "0",
        className: "text-emerald-600 dark:text-emerald-400 font-normal",
      };
    }
    return {
      display: `+${shortfall}`,
      className: "text-rose-600 dark:text-rose-400 font-bold",
    };
  }

  if (metric === "fulfillment") {
    if (target === 0) {
      return { display: "—", className: "text-muted-foreground/60 font-normal" };
    }
    return {
      display: `${Math.round(metPct)}%`,
      className:
        metPct >= 100
          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
          : metPct >= 80
          ? "text-amber-600 dark:text-amber-400 font-semibold"
          : "text-rose-600 dark:text-rose-400 font-bold",
    };
  }

  // Default: Installed (Live)
  return {
    display: String(live),
    className:
      live === 0
        ? "text-slate-400 dark:text-slate-500 font-normal"
        : "text-slate-800 dark:text-slate-100 font-semibold",
  };
}

function getGroupTotalValue(
  row: InstalledHouseholdsRow | InstalledHouseholdsTotalRow,
  sec: number,
  metric: MatrixMetric
): { display: string } {
  if (metric === "target") {
    return { display: String(num(row[`sec_${sec}_target`])) };
  }
  if (metric === "shortfall") {
    const sf = num(row[`sec_${sec}_shortfall`]);
    return { display: sf > 0 ? `+${sf}` : "0" };
  }
  if (metric === "fulfillment") {
    const met = num(row[`sec_${sec}_met_pct`]);
    return { display: `${Math.round(met)}%` };
  }
  return { display: String(num(row[`sec_${sec}_total`])) };
}

function getGrandTotalValue(
  row: InstalledHouseholdsRow | InstalledHouseholdsTotalRow,
  metric: MatrixMetric
): { display: string } {
  if (metric === "target") {
    return { display: String(num(row.grand_target)) };
  }
  if (metric === "shortfall") {
    const sf = num(row.grand_shortfall);
    return { display: sf > 0 ? `+${sf}` : "0" };
  }
  if (metric === "fulfillment") {
    const met = num(row.grand_met_pct);
    return { display: `${Math.round(met)}%` };
  }
  return { display: String(num(row.grand_total)) };
}

function getHeatmapBg(val: number, max: number): string | undefined {
  if (val === 0) return undefined;
  const ratio = Math.min(1, Math.max(0.12, val / max));
  return `rgba(59, 130, 246, ${(ratio * 0.42).toFixed(2)})`;
}

function renderSortIndicator(active: boolean, desc: boolean) {
  if (!active) {
    return <ArrowUpDown className="size-3 text-muted-foreground/40 shrink-0" />;
  }
  return desc ? (
    <ArrowDown className="size-3 text-blue-600 dark:text-blue-400 font-bold shrink-0" />
  ) : (
    <ArrowUp className="size-3 text-blue-600 dark:text-blue-400 font-bold shrink-0" />
  );
}