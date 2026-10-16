import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ClipboardList,
  House,
  UserRound,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { createClient } from "@/src/lib/supabase/server";
import { HouseholdTable } from "@/components/household-table";

const PAGE_SIZE = 25;

const overviewCards = [
  {
    key: "total",
    title: "Questionnaire Records",
    description: "Total records in the database",
    icon: ClipboardList,
  },
  {
    key: "households",
    title: "Household IDs",
    description: "Records with a household ID",
    icon: House,
  },
  {
    key: "respondents",
    title: "Respondents",
    description: "Records with a respondent name",
    icon: UserRound,
  },
  {
    key: "appointments",
    title: "Appointment Status",
    description: "Records with a recorded status",
    icon: CalendarCheck,
  },
] as const;

/**
 * Dashboard page with server-side pagination and summary counts.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;

  // Read the requested page from the URL.
  const rawPage = Array.isArray(params.page)
    ? params.page[0]
    : params.page;

  const parsedPage = Number.parseInt(rawPage ?? "1", 10);

  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  const supabase = await createClient();

  // Get the total number of questionnaire records.
  const totalResult = await supabase
    .from("tv_measurement_households")
    .select("id", { count: "exact", head: true });

  const totalCount = totalResult.count ?? 0;

  // Calculate the number of pages.
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE)
  );

  // Keep the requested page within the available page range.
  const currentPage = Math.min(requestedPage, totalPages);

  // Calculate the row range for the current page.
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE - 1;

  // Fetch the current page and all summary counts independently.
  const [
    householdResult,
    householdIdResult,
    respondentResult,
    appointmentResult,
  ] = await Promise.all([
    // Fetch only the records for the current page.
    supabase
      .from("tv_measurement_households")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(startIndex, endIndex),

    // Count all records with a household ID.
    // This query covers the entire database, not just the current page.
    supabase
      .from("tv_measurement_households")
      .select("id", { count: "exact", head: true })
      .not("household_id", "is", null)
      .neq("household_id", ""),

    // Count all records with a respondent name.
    supabase
      .from("tv_measurement_households")
      .select("id", { count: "exact", head: true })
      .not("respondent_name", "is", null)
      .neq("respondent_name", ""),

    // Count all records with an appointment status.
    supabase
      .from("tv_measurement_households")
      .select("id", { count: "exact", head: true })
      .not("appointment_status", "is", null)
      .neq("appointment_status", ""),
  ]);

  // Detect query errors.
  const queryError =
    totalResult.error ||
    householdResult.error ||
    householdIdResult.error ||
    respondentResult.error ||
    appointmentResult.error;

  // Get the authenticated user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get the user's application role.
  const { data: roleRecord, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id)
    .maybeSingle();

  const userRole = roleRecord?.role ?? null;
  const isDataTeam = userRole === "data_team";

  // Summary cards use counts from the entire database.
  const counts = {
    total: totalResult.count,
    households: householdIdResult.count,
    respondents: respondentResult.count,
    appointments: appointmentResult.count,
  };

  // Get only the current page's records.
  const rawRecords = householdResult.data ?? [];

  // Strip sensitive personal information for the Data Team.
  const records = rawRecords.map((record) => {
    if (isDataTeam) {
      return {
        ...record,
        respondent_name: null,
        contact_number: null,
        telephone_number: null,
        household_address_or_nearest_landmark: null,
        full_address_or_landmark: null,
        confirmation_respondent_name: null,
        confirmation_contact_number: null,
        confirmation_address_or_location: null,
        preferred_contact_person: null,
        preferred_contact_number: null,
        special_instructions_for_field_team: null,
      };
    }

    return record;
  });

  // Generate the destination URL for a page.
  const getPageHref = (page: number) =>
    page === 1 ? "/dashboard" : `/dashboard?page=${page}`;

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dashboard
        </h1>

        <p className="text-sm text-muted-foreground">
          Overview of household and appointment information.
        </p>
      </div>

      {/* Database Errors */}
      {queryError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">
            Unable to load dashboard information.
          </p>

          <p className="mt-1">{queryError.message}</p>
        </div>
      )}

      {/* Role Lookup Error */}
      {roleError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">
            Unable to load user role.
          </p>

          <p className="mt-1">{roleError.message}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {item.title}
                </CardTitle>

                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-bold">
                  {counts[item.key] ?? "—"}
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
            Browse household records, 25 records at a time. Scroll
            horizontally to view additional columns.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {records.length === 0 && !queryError ? (
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

          {/* Pagination Information and Controls */}
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount === 0 ? (
                "Showing 0 records"
              ) : (
                <>
                  Showing {startIndex + 1}–
                  {Math.min(
                    startIndex + records.length,
                    totalCount
                  )}{" "}
                  of {totalCount} records
                </>
              )}

              {" · "}Page {currentPage} of {totalPages}
            </p>

            <div className="flex items-center gap-2">
              {/* Previous Page */}
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

              {/* Next Page */}
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
        </CardContent>
      </Card>
    </div>
  );
}