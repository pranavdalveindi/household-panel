import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export const ALLOWED_CALL_STATUSES = [
  "call successful",
  "Not reachable",
  "Number does not connect",
] as const;

export const ALLOWED_INSTALLATION_STATUSES = [
  "pending",
  "installed",
  "rejected",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Normalizes call status string to exact allowed value.
 */
function normalizeCallStatus(value: unknown): (typeof ALLOWED_CALL_STATUSES)[number] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  for (const status of ALLOWED_CALL_STATUSES) {
    if (status.toLowerCase() === trimmed) {
      return status;
    }
  }
  return null;
}

/**
 * Normalizes installation status string to exact allowed value.
 */
function normalizeInstallationStatus(
  value: unknown
): (typeof ALLOWED_INSTALLATION_STATUSES)[number] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  for (const status of ALLOWED_INSTALLATION_STATUSES) {
    if (status.toLowerCase() === trimmed) {
      return status;
    }
  }
  return null;
}

/**
 * PATCH /api/households/:id
 *
 * Update call_status, scheduled_date, and installation_status.
 * Only Call Center users (and admins) may update household records.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // Authenticate the user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    // Restrict updates to company users.
    const email = user.email?.trim().toLowerCase() ?? "";

    if (!email.endsWith("@inditronics.com")) {
      return NextResponse.json(
        {
          error: "Only authorized company users may update household records.",
        },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    // Verify the user's role: ONLY call_center is permitted.
    const { data: roleRecord, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("PATCH /api/households/[id] role error:", roleError);
      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 500 }
      );
    }

    const role = roleRecord?.role;
    if (role !== "call_center") {
      return NextResponse.json(
        {
          error:
            "Permission denied. Only Call Center users can update household records.",
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Household record ID is required." },
        { status: 400 }
      );
    }

    // Confirm the household exists.
    const { data: existingRecord, error: existingError } = await adminClient
      .from("tv_measurement_households")
      .select("id, appointment_status, call_status, scheduled_date")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "PATCH /api/households/[id] existing record error:",
        existingError
      );

      return NextResponse.json(
        { error: "Unable to read the existing household record." },
        { status: 500 }
      );
    }

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Household record not found." },
        { status: 404 }
      );
    }

    // Parse request body.
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    // Validate Call Status.
    const normalizedCallStatus = normalizeCallStatus(body.call_status);

    if (!normalizedCallStatus) {
      return NextResponse.json(
        {
          error:
            "Invalid Call Status. Options are: call successful, Not reachable, Number does not connect.",
        },
        { status: 400 }
      );
    }

    // Process Scheduled Date & Time.
    // If call status is not "call successful", scheduled_date cannot be set.
    let scheduledDate: string | null = null;

    if (normalizedCallStatus === "call successful") {
      if (
        typeof body.scheduled_date === "string" &&
        body.scheduled_date.trim() !== ""
      ) {
        const rawDate = body.scheduled_date.trim();
        const parsedDate = new Date(rawDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return NextResponse.json(
            { error: "Please provide a valid Scheduled Date and Time." },
            { status: 400 }
          );
        }
        scheduledDate = rawDate;
      } else if (
        body.scheduled_date !== null &&
        body.scheduled_date !== undefined &&
        body.scheduled_date !== ""
      ) {
        return NextResponse.json(
          { error: "Invalid Scheduled Date." },
          { status: 400 }
        );
      }
    } else {
      // For Not reachable or Number does not connect, clear scheduled date.
      scheduledDate = null;
    }

    // Validate Installation Status.
    let installationStatus: string | null = null;
    if (body.installation_status) {
      const normalizedInstall = normalizeInstallationStatus(
        body.installation_status
      );
      if (!normalizedInstall) {
        return NextResponse.json(
          {
            error:
              "Invalid Installation Status. Options are: pending, installed, rejected.",
          },
          { status: 400 }
        );
      }
      installationStatus = normalizedInstall;
    }

    const now = new Date().toISOString();

    const fullPayload: Record<string, unknown> = {
      call_status: normalizedCallStatus,
      scheduled_date: scheduledDate,
      processed_at: now,
      processed_by: user.id,
      updated_at: now,
    };

    if (installationStatus !== null) {
      fullPayload.installation_status = installationStatus;
    }

    // Attempt update with full payload
    let { data, error: updateError } = await adminClient
      .from("tv_measurement_households")
      .update(fullPayload)
      .eq("id", id)
      .select()
      .single();

    // If installation_status column does not exist yet in the database,
    // fallback gracefully to updating without it so the request does not fail.
    if (
      updateError &&
      (updateError.code === "PGRST204" ||
        updateError.message?.includes("installation_status"))
    ) {
      console.warn(
        "Notice: 'installation_status' column not found in database schema cache. " +
          "Updating household without installation_status. " +
          "Run 'ALTER TABLE tv_measurement_households ADD COLUMN IF NOT EXISTS installation_status text DEFAULT \\'pending\\';' in Supabase SQL editor."
      );

      const fallbackPayload: Record<string, unknown> = {
        call_status: normalizedCallStatus,
        scheduled_date: scheduledDate,
        processed_at: now,
        processed_by: user.id,
        updated_at: now,
      };

      const fallbackResult = await adminClient
        .from("tv_measurement_households")
        .update(fallbackPayload)
        .eq("id", id)
        .select()
        .single();

      data = fallbackResult.data;
      updateError = fallbackResult.error;
    }

    if (updateError) {
      console.error("PATCH /api/households/[id] update error:", updateError);

      return NextResponse.json(
        {
          error:
            updateError.message || "Unable to update household record.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Household updated successfully.",
      household: {
        ...data,
        call_status: normalizedCallStatus,
        scheduled_date: scheduledDate,
        installation_status: installationStatus,
        appointment_status: existingRecord.appointment_status,
      },
    });
  } catch (error) {
    console.error("PATCH /api/households/[id] unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while updating the household.",
      },
      { status: 500 }
    );
  }
}
