"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClipboardList,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  PhoneOff,
  PhoneCall,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { HouseholdTable, HouseholdRecord } from "@/components/household-table";
import { useAuth } from "./layout";

const PAGE_SIZE = 25;

const overviewCards = [
  {
    key: "total",
    title: "Questionnaire Records",
    description: "Total records in the database",
    icon: ClipboardList,
  },
  {
    key: "not_reachable",
    title: "Not Reachable",
    description: "Calls that could not be reached",
    icon: PhoneOff,
  },
  {
    key: "call_successful",
    title: "Call Successful",
    description: "Calls connected successfully",
    icon: PhoneCall,
  },
  {
    key: "scheduled",
    title: "Appointments Scheduled",
    description: "Scheduled date and time set",
    icon: CalendarCheck,
  },
] as const;

function DashboardContent() {
  const searchParams = useSearchParams();
  const rawPage = searchParams.get("page");
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { user } = useAuth();
  const userRole = user?.role ?? null;

  const [records, setRecords] = useState<HouseholdRecord[]>([]);
  const [counts, setCounts] = useState<{
    total: number;
    not_reachable: number;
    call_successful: number;
    scheduled: number;
  }>({
    total: 0,
    not_reachable: 0,
    call_successful: 0,
    scheduled: 0,
  });

  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getHouseholds(currentPage, PAGE_SIZE);

      setRecords((data.households as HouseholdRecord[]) ?? []);

      const total = data.pagination?.total ?? data.counts?.total ?? 0;
      setTotalCount(total);
      setTotalPages(data.pagination?.totalPages ?? Math.max(1, Math.ceil(total / PAGE_SIZE)));

      setCounts({
        total: data.counts?.total ?? total,
        not_reachable: data.counts?.not_reachable ?? 0,
        call_successful: data.counts?.call_successful ?? 0,
        scheduled: data.counts?.scheduled ?? 0,
      });
    } catch (err) {
      console.error("Failed to load households:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load dashboard information."
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const getPageHref = (page: number) =>
    page === 1 ? "/dashboard" : `/dashboard?page=${page}`;

  return (
    <div className="space-y-6">
      {/* Page Heading & Refresh */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of household and appointment information.
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

      {/* Database / API Errors */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Unable to load dashboard information.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "—" : counts[item.key]}
                </div>

                <CardDescription className="mt-1">
                  {item.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Household Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Household Records</CardTitle>
          <CardDescription>
            Browse household records, 25 records at a time. Scroll horizontally to
            view additional columns.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading records...</p>
            </div>
          ) : records.length === 0 && !error ? (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                No household records found.
              </p>
            </div>
          ) : (
            <HouseholdTable
              initialRecords={records}
              startIndex={startIndex}
              userRole={userRole}
            />
          )}

          {/* Pagination Controls */}
          {!loading && totalCount > 0 && (
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}–
                {Math.min(startIndex + records.length, totalCount)} of {totalCount} records
                {" · "}Page {currentPage} of {totalPages}
              </p>

              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={getPageHref(currentPage - 1)}
                    className="inline-flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex cursor-not-allowed items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium opacity-50"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </span>
                )}

                {currentPage < totalPages ? (
                  <Link
                    href={getPageHref(currentPage + 1)}
                    className="inline-flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex cursor-not-allowed items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium opacity-50"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-60 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

