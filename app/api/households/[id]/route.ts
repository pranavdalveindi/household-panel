import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

const ALLOWED_CALL_STATUSES = [
  "Called",
  "Not called",
  "Busy",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/households/:id
 *
 * Only Call Center users may update household records.
 *
 * IMPORTANT:
 * - appointment_status is never updated.
 * - scheduled_date is updated independently.
 * - Existing appointment_status values remain unchanged.
 */
export async function PATCH(
  request: Request,
  context: RouteContext
) {
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
          error:
            "Only authorized company users may update household records.",
        },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    // Verify the user's role.
    const { data: roleRecord, error: roleError } =
      await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (roleError) {
      console.error(
        "PATCH /api/households/[id] role error:",
        roleError
      );

      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 500 }
      );
    }

    if (roleRecord?.role !== "call_center") {
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
    const { data: existingRecord, error: existingError } =
      await adminClient
        .from("tv_measurement_households")
        .select("id, appointment_status")
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
    const callStatus =
      typeof body.call_status === "string"
        ? body.call_status.trim()
        : "";

    if (
      !ALLOWED_CALL_STATUSES.includes(
        callStatus as (typeof ALLOWED_CALL_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Call Status. Options are: Called, Not called, Busy.",
        },
        { status: 400 }
      );
    }

    // Accept a date string or null/empty string to clear the date.
    let scheduledDate: string | null = null;

    if (
      typeof body.scheduled_date === "string" &&
      body.scheduled_date.trim() !== ""
    ) {
      scheduledDate = body.scheduled_date.trim();
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

    // Validate date format and actual calendar date.
    if (scheduledDate !== null) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (!datePattern.test(scheduledDate)) {
        return NextResponse.json(
          {
            error: "Scheduled Date must use the YYYY-MM-DD format.",
          },
          { status: 400 }
        );
      }

      const parsedDate = new Date(
        `${scheduledDate}T00:00:00.000Z`
      );

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== scheduledDate
      ) {
        return NextResponse.json(
          { error: "Please provide a valid Scheduled Date." },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    // IMPORTANT:
    // appointment_status is deliberately NOT included in this payload.
    const updatePayload = {
      call_status: callStatus,
      scheduled_date: scheduledDate,
      processed_at: now,
      processed_by: user.id,
      updated_at: now,
    };

    const { data, error: updateError } = await adminClient
      .from("tv_measurement_households")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "PATCH /api/households/[id] update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError.message ||
            "Unable to update household record.",
        },
        { status: 500 }
      );
    }

    // Return the original appointment_status value.
    return NextResponse.json({
      message: "Household updated successfully.",
      household: {
        ...data,
        appointment_status: existingRecord.appointment_status,
      },
    });
  } catch (error) {
    console.error(
      "PATCH /api/households/[id] unexpected error:",
      error
    );

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