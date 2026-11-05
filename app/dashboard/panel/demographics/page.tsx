"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users,
  Home,
  UserCheck,
  RefreshCw,
  Search,
  BarChart3,
  PieChart as PieIcon,
  MapPin,
  Calendar,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DemographicsAgeGroup {
  age_group: string;
  total: number;
  male: number;
  female: number;
  pct: number;
}

interface DemographicsRegion {
  region: string;
  total_members: number;
  total_households: number;
  avg_hh_size: number;
  male: number;
  female: number;
}

interface DemographicsMember {
  id: string;
  hhid: string;
  member_code?: string | null;
  region: string;
  gender?: string | null;
  age?: number | null;
  sec_mapped?: number | null;
  mos_mapped?: number | null;
}

interface DemographicsData {
  total_members: number;
  total_households: number;
  avg_hh_size: number;
  avg_age: number;
  gender: {
    male: number;
    female: number;
    male_pct: number;
    female_pct: number;
  };
  age_groups: DemographicsAgeGroup[];
  by_region: DemographicsRegion[];
  members: DemographicsMember[];
  _source?: string;
}

// Enterprise Standard Corporate Color Palette (Blue & Deep Teal)
const GENDER_COLORS = {
  male: "#2563EB", // Standard Cobalt Blue
  female: "#0D9488", // Deep Professional Teal
};

const AGE_BAR_COLOR = "#2563EB";

export default function DemographicsPage() {
  const [data, setData] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state for member table
  const [searchHhid, setSearchHhid] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("all");
  const [tablePage, setTablePage] = useState(1);
  const PAGE_SIZE = 25;

  const loadDemographics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPanelDemographics();
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load demographics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemographics();
  }, []);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    if (!data?.members) return [];
    return data.members.filter((m) => {
      const matchHhid = searchHhid.trim() === "" || m.hhid.toLowerCase().includes(searchHhid.toLowerCase().trim());
      const matchRegion = selectedRegion === "all" || m.region.toLowerCase() === selectedRegion.toLowerCase();
      const matchGender = selectedGender === "all" || (m.gender && m.gender.toLowerCase() === selectedGender.toLowerCase());
      
      let matchAge = true;
      if (selectedAgeGroup !== "all" && m.age != null) {
        if (selectedAgeGroup === "0-14") matchAge = m.age <= 14;
        else if (selectedAgeGroup === "15-30") matchAge = m.age >= 15 && m.age <= 30;
        else if (selectedAgeGroup === "30-39") matchAge = m.age >= 31 && m.age <= 39;
        else if (selectedAgeGroup === "40-49") matchAge = m.age >= 40 && m.age <= 49;
        else if (selectedAgeGroup === "50-60") matchAge = m.age >= 50 && m.age <= 60;
        else if (selectedAgeGroup === "60+") matchAge = m.age > 60;
      }

      return matchHhid && matchRegion && matchGender && matchAge;
    });
  }, [data, searchHhid, selectedRegion, selectedGender, selectedAgeGroup]);

  // Paginated members
  const paginatedMembers = useMemo(() => {
    const start = (tablePage - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, tablePage]);

  const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE) || 1;

  // Gender chart data
  const genderPieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Male", value: data.gender.male, color: GENDER_COLORS.male },
      { name: "Female", value: data.gender.female, color: GENDER_COLORS.female },
    ];
  }, [data]);

  // Unique region list for filter
  const regionOptions = useMemo(() => {
    if (!data?.by_region) return [];
    return data.by_region.map((r) => r.region).sort();
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading demographic analytics from RDS...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 max-w-md">
          <p className="text-sm font-semibold text-destructive">Failed to load demographics data</p>
          <p className="text-xs text-muted-foreground mt-1">{error || "No data returned"}</p>
          <button
            onClick={loadDemographics}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:opacity-90"
          >
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ─── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Age & Gender Demographics
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              PRODUCTION Only
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Standard population telemetry, age bracket distributions (-14, 15-30, 30-39, 40-49, 50-60, 60+), and gender balance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDemographics}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold text-card-foreground shadow-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* ─── Section 1: Compact Stat Cards (Clean Executive Palette) ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Total Members */}
        <Card className="w-[155px] sm:w-[170px] xl:w-[180px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Members</CardTitle>
            <Users className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">
              {data.total_members.toLocaleString()}
            </div>
            <CardDescription className="text-[10px] mt-0.5 truncate">Production population</CardDescription>
          </CardContent>
        </Card>

        {/* Total Households */}
        <Card className="w-[155px] sm:w-[170px] xl:w-[180px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Households</CardTitle>
            <Home className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">{data.total_households.toLocaleString()}</div>
            <CardDescription className="text-[10px] mt-0.5 truncate">Production homes</CardDescription>
          </CardContent>
        </Card>

        {/* Avg Household Size */}
        <Card className="w-[155px] sm:w-[170px] xl:w-[180px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg HH Size</CardTitle>
            <Layers className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">
              {data.avg_hh_size}
            </div>
            <CardDescription className="text-[10px] mt-0.5 truncate">Members per HH</CardDescription>
          </CardContent>
        </Card>

        {/* Avg Member Age */}
        <Card className="w-[155px] sm:w-[170px] xl:w-[180px] shrink-0 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Average Age</CardTitle>
            <Calendar className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-foreground">
              {data.avg_age} yrs
            </div>
            <CardDescription className="text-[10px] mt-0.5 truncate">Across all members</CardDescription>
          </CardContent>
        </Card>

        {/* Male Members (Cobalt Blue) */}
        <Card className="w-[155px] sm:w-[170px] xl:w-[180px] shrink-0 shadow-sm border-blue-500/20 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-blue-700 dark:text-blue-400">Male Members</CardTitle>
            <UserCheck className="size-3.5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {data.gender.male.toLocaleString()}
            </div>
            <CardDescription className="text-[10px] mt-0.5 truncate">{data.gender.male_pct}% of panel</CardDescription>
          </CardContent>
        </Card>

        {/* Female Members (Deep Teal) */}
        <Card className="w-[155px] sm:w-[170px] xl:w-[180px] shrink-0 shadow-sm border-teal-500/20 bg-teal-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-teal-700 dark:text-teal-400">Female Members</CardTitle>
            <UserCheck className="size-3.5 text-teal-600 dark:text-teal-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-teal-600 dark:text-teal-400">
              {data.gender.female.toLocaleString()}
            </div>
            <CardDescription className="text-[10px] mt-0.5 truncate">{data.gender.female_pct}% of panel</CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* ─── Section 2: Visual Graphs (Standard Enterprise Blue & Teal) ─ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Graph 1: Total Members by Age Bracket (Consistent Professional Hue) */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Members by Age Bracket</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Distribution across brackets: -14, 15-30, 30-39, 40-49, 50-60, 60+
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <BarChart3 className="size-4 text-blue-600 dark:text-blue-400" />
                <span>Total: {data.total_members}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.age_groups} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis
                    dataKey="age_group"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "currentColor" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "0.5rem",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`${val} members`, "Total Count"]}
                  />
                  <Bar dataKey="total" fill={AGE_BAR_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Graph 2: Gender Distribution (Cobalt Blue vs Deep Teal) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Gender Distribution</CardTitle>
                <CardDescription className="text-xs mt-0.5">Overall panel gender balance</CardDescription>
              </div>
              <PieIcon className="size-4 text-teal-600 dark:text-teal-400" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {genderPieData.map((entry, index) => (
                      <Cell key={`gender-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "0.5rem",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    formatter={(val: any, name: any) => [
                      `${val} members (${((val / data.total_members) * 100).toFixed(1)}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Legend & Percentage Bar */}
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="size-2.5 rounded-full bg-blue-600" />
                  Male: {data.gender.male} ({data.gender.male_pct}%)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="size-2.5 rounded-full bg-teal-600" />
                  Female: {data.gender.female} ({data.gender.female_pct}%)
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div style={{ width: `${data.gender.male_pct}%` }} className="bg-blue-600 transition-all" />
                <div style={{ width: `${data.gender.female_pct}%` }} className="bg-teal-600 transition-all" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Section 3: Comparative Age × Gender Breakdown ────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Age Group × Gender Breakdown</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Comparison of Male vs Female member counts per age bracket
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-3 rounded bg-blue-600" /> Male
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-3 rounded bg-teal-600" /> Female
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.age_groups} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis
                  dataKey="age_group"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "currentColor" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "currentColor" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "0.5rem",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="male" name="Male" fill={GENDER_COLORS.male} radius={[4, 4, 0, 0]} />
                <Bar dataKey="female" name="Female" fill={GENDER_COLORS.female} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ─── Section 4: Age Group Summary Table ───────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Age Group Metrics Table</CardTitle>
          <CardDescription className="text-xs">
            Detailed breakdown of member population counts, gender split, and panel representation
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-y">
                <tr>
                  <th className="px-4 py-3 font-semibold">Age Bracket</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Members</th>
                  <th className="px-4 py-3 font-semibold text-right">Male</th>
                  <th className="px-4 py-3 font-semibold text-right">Female</th>
                  <th className="px-4 py-3 font-semibold text-right">Male %</th>
                  <th className="px-4 py-3 font-semibold text-right">Female %</th>
                  <th className="px-4 py-3 font-semibold text-right">% of Total Panel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.age_groups.map((group) => {
                  const mPct = group.total > 0 ? ((group.male / group.total) * 100).toFixed(1) : "0.0";
                  const fPct = group.total > 0 ? ((group.female / group.total) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={group.age_group} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                        <span className="size-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                        {group.age_group}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {group.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-medium">
                        {group.male.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-teal-600 dark:text-teal-400 font-medium">
                        {group.female.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{mPct}%</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fPct}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {group.pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Section 5: Regional Demographics Breakdown ────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Regional Demographics</CardTitle>
              <CardDescription className="text-xs">
                Household population, member counts, and average household size by Armenian region
              </CardDescription>
            </div>
            <MapPin className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-y">
                <tr>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold text-right">Production HHs</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Members</th>
                  <th className="px-4 py-3 font-semibold text-right">Avg HH Size</th>
                  <th className="px-4 py-3 font-semibold text-right">Male</th>
                  <th className="px-4 py-3 font-semibold text-right">Female</th>
                  <th className="px-4 py-3 font-semibold text-right">Gender Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.by_region.map((reg) => (
                  <tr key={reg.region} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-1.5">
                      <MapPin className="size-3 text-slate-500" />
                      {reg.region}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground font-medium">
                      {reg.total_households}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      {reg.total_members}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {reg.avg_hh_size}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-medium">
                      {reg.male}
                    </td>
                    <td className="px-4 py-3 text-right text-teal-600 dark:text-teal-400 font-medium">
                      {reg.female}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {((reg.male / (reg.total_members || 1)) * 100).toFixed(0)}% M
                        </span>
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${(reg.male / (reg.total_members || 1)) * 100}%` }}
                            className="bg-blue-600 h-full"
                          />
                          <div
                            style={{ width: `${(reg.female / (reg.total_members || 1)) * 100}%` }}
                            className="bg-teal-600 h-full"
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {((reg.female / (reg.total_members || 1)) * 100).toFixed(0)}% F
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Section 6: Interactive Member Explorer ───────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Household Member Explorer</CardTitle>
              <CardDescription className="text-xs">
                Inspect individual members with mapped SEC, MOS, Age, and Gender
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Showing {filteredMembers.length} of {data.total_members} members
            </span>
          </div>

          {/* Filters Bar */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search HHID */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search HHID (e.g. HH1642)..."
                value={searchHhid}
                onChange={(e) => {
                  setSearchHhid(e.target.value);
                  setTablePage(1);
                }}
                className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Region Filter */}
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setTablePage(1);
              }}
              className="rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Regions ({regionOptions.length})</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Gender Filter */}
            <select
              value={selectedGender}
              onChange={(e) => {
                setSelectedGender(e.target.value);
                setTablePage(1);
              }}
              className="rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>

            {/* Age Group Filter */}
            <select
              value={selectedAgeGroup}
              onChange={(e) => {
                setSelectedAgeGroup(e.target.value);
                setTablePage(1);
              }}
              className="rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Age Groups</option>
              <option value="0-14">0 - 14 yrs (-14)</option>
              <option value="15-30">15 - 30 yrs</option>
              <option value="30-39">30 - 39 yrs</option>
              <option value="40-49">40 - 49 yrs</option>
              <option value="50-60">50 - 60 yrs</option>
              <option value="60+">60+ yrs</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">HHID</th>
                  <th className="px-4 py-2.5 font-semibold">Member</th>
                  <th className="px-4 py-2.5 font-semibold">Region</th>
                  <th className="px-4 py-2.5 font-semibold">Gender</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Age</th>
                  <th className="px-4 py-2.5 font-semibold text-center">SEC (Mapped)</th>
                  <th className="px-4 py-2.5 font-semibold text-center">MOS (Mapped)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      No members match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">
                        {m.hhid}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                        {m.member_code || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground font-medium">
                        {m.region}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium">
                        {m.gender?.toLowerCase() === "male" ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <span className="size-1.5 rounded-full bg-blue-600" /> Male
                          </span>
                        ) : m.gender?.toLowerCase() === "female" ? (
                          <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
                            <span className="size-1.5 rounded-full bg-teal-600" /> Female
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{m.gender || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-foreground">
                        {m.age != null ? m.age : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
                          SEC {m.sec_mapped || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
                          MOS {m.mos_mapped || "—"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>
                Page {tablePage} of {totalPages} ({filteredMembers.length} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                  disabled={tablePage === 1}
                  className="rounded border px-2.5 py-1 font-medium hover:bg-accent disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                  disabled={tablePage === totalPages}
                  className="rounded border px-2.5 py-1 font-medium hover:bg-accent disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
