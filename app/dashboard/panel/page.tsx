"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
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
}: {
  totalTarget: number;
  totalLive: number;
  totalShortfall: number;
  unclassifiedCount: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* Total Live */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Live</CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalLive.toLocaleString()}
          </div>
          <CardDescription className="mt-1">Active live panel households</CardDescription>
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
          <CardDescription className="mt-1">Households below target</CardDescription>
        </CardContent>
      </Card>

      {/* Unclassified Households (in amber with warning icon) */}
      <Card className="border-amber-300 dark:border-amber-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Unclassified Households
          </CardTitle>
          <AlertTriangle className="size-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {unclassifiedCount.toLocaleString()}
          </div>
          <CardDescription className="mt-1">Missing SEC or MOSR data</CardDescription>
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
}: {
  data: RegionBarData[];
  activeRegion: number | null;
  onRegionClick: (regionCode: number) => void;
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
                  if (rc != null) onRegionClick(Number(rc));
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
                  if (rc != null) onRegionClick(Number(rc));
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
  function getCell(sec: number, mosr: number) {
    return cells.find((c) => Number(c.sec) === sec && Number(c.mosr) === mosr);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Heatmap Grid — SEC × MOSR</CardTitle>
            <CardDescription>
              SEC (rows 1,2,3) × MOSR (columns 1,2,3,4). Each cell shows Target / Live and Shortfall %.
            </CardDescription>
          </div>

          {highlight && (
            <div className="flex items-center gap-2 self-start rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary sm:self-auto">
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

      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left font-semibold">SEC \ MOSR</th>
                {MOSR_LABELS.map((m) => (
                  <th key={m} className="px-4 py-3 text-center font-semibold">
                    MOSR {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SEC_LABELS.map((sec) => (
                <tr key={sec} className="divide-x divide-border">
                  <td className="whitespace-nowrap bg-muted/30 px-4 py-3 text-xs font-bold text-foreground">
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
                        className={`cursor-pointer border p-3 text-center transition-all hover:scale-[1.01] hover:brightness-95 ${cellBg(
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
                          <div className="font-mono text-sm font-bold">
                            {live} <span className="opacity-60">/</span> {target}
                          </div>
                          {target > 0 ? (
                            <div className="text-[11px] font-medium opacity-85">
                              {live >= target ? (
                                <span className="text-emerald-800 dark:text-emerald-300">
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
  const cells = data.cells ?? [];

  function getCell(sec: number, mosr: number) {
    return cells.find((c) => Number(c.sec) === sec && Number(c.mosr) === mosr);
  }

  return (
    <Card className="border-primary/50 shadow-md">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
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

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted"
        >
          <X className="size-3.5" />
          Close Drill Down
        </button>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left font-semibold">SEC \ MOSR</th>
                {MOSR_LABELS.map((m) => (
                  <th key={m} className="px-4 py-3 text-center font-semibold">
                    MOSR {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SEC_LABELS.map((sec) => (
                <tr key={sec} className="divide-x divide-border">
                  <td className="whitespace-nowrap bg-muted/30 px-4 py-3 text-xs font-bold text-foreground">
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
                        className={`border p-3 text-center transition-colors ${
                          hasShortfall
                            ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/70 dark:text-rose-100 dark:border-rose-800"
                            : target > 0
                            ? "bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100"
                            : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-mono text-xs font-bold">
                            Live: {live} / Target: {target}
                          </div>
                          {hasShortfall ? (
                            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                              Shortfall: −{shortfall} ({Math.round(shortfallPct)}%)
                            </div>
                          ) : target > 0 ? (
                            <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
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
  );
}

// ─── 6. Unclassified Table ────────────────────────────────────────────────────

function UnclassifiedTableSection({ rows }: { rows: UnclassifiedRow[] }) {
  if (!rows || rows.length === 0) return null;

  return (
    <Card className="border-amber-300 dark:border-amber-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          <CardTitle className="text-base text-amber-700 dark:text-amber-300">
            Data Quality Issues — Households Missing SEC or MOSR
          </CardTitle>
        </div>
        <CardDescription>
          {rows.length} household{rows.length !== 1 ? "s" : ""} missing SEC or MOSR classification data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">HHID</th>
                <th className="px-4 py-3 text-left font-medium">Region</th>
                <th className="px-4 py-3 text-center font-medium">SEC</th>
                <th className="px-4 py-3 text-center font-medium">MOSR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, idx) => (
                <tr key={row.hhid || row.id || idx} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{nullDisplay(row.hhid)}</td>
                  <td className="px-4 py-2">{nullDisplay(row.region_name || row.region)}</td>
                  <td className="px-4 py-2 text-center">{nullDisplay(row.sec)}</td>
                  <td className="px-4 py-2 text-center">{nullDisplay(row.mosr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  }>({
    total_target: 0,
    total_live: 0,
    total_shortfall: 0,
  });

  const [regions, setRegions] = useState<RegionBarData[]>([]);
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [stacked, setStacked] = useState<StackedBarData[]>([]);
  const [unclassified, setUnclassified] = useState<UnclassifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRegion, setActiveRegion] = useState<number | null>(null);
  const [drillDown, setDrillDown] = useState<RegionDrillDownData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

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
      setSummaryData({
        total_target: sTarget,
        total_live: sLive,
        total_shortfall: sShortfall,
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

      // Pre-fetch/derive SEC 1, 2, 3 distribution per region for Stacked Bar Chart
      if (parsedRegions.length > 0) {
        const stackedItems: StackedBarData[] = await Promise.all(
          parsedRegions.map(async (r) => {
            try {
              const regDetail = await api.getPanelRegion(r.region_code);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const regCells: any[] = Array.isArray(regDetail?.cells)
                ? regDetail.cells
                : Array.isArray(regDetail)
                ? regDetail
                : [];

              const sec1 = regCells
                .filter((c) => Number(c.sec) === 1)
                .reduce((acc, c) => acc + num(c.live), 0);
              const sec2 = regCells
                .filter((c) => Number(c.sec) === 2)
                .reduce((acc, c) => acc + num(c.live), 0);
              const sec3 = regCells
                .filter((c) => Number(c.sec) === 3)
                .reduce((acc, c) => acc + num(c.live), 0);

              return {
                region_code: r.region_code,
                region_name: r.region_name,
                sec1_live: sec1,
                sec2_live: sec2,
                sec3_live: sec3,
              };
            } catch {
              return {
                region_code: r.region_code,
                region_name: r.region_name,
                sec1_live: 0,
                sec2_live: 0,
                sec3_live: 0,
              };
            }
          })
        );
        setStacked(stackedItems);
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
          <h1 className="text-2xl font-bold tracking-tight">Panel Monitoring</h1>
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
          />

          {/* Section 2 & 4: Grouped Bar Chart & Stacked Bar Chart */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GroupedBarChartSection
              data={regions}
              activeRegion={activeRegion}
              onRegionClick={handleRegionClick}
            />
            <StackedBarChartSection
              data={stacked}
              highlightSec={highlight ? highlight.sec : null}
            />
          </div>

          {/* Section 3: Heatmap Grid */}
          <HeatmapGridSection
            cells={cells}
            highlight={highlight}
            onCellClick={handleCellClick}
          />

          {/* Section 5: Region Drill Down */}
          {activeRegion !== null && (
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

          {/* Section 6: Unclassified Table (shown only when unclassified count > 0) */}
          {unclassified.length > 0 && (
            <UnclassifiedTableSection rows={unclassified} />
          )}
        </>
      )}
    </div>
  );
}
