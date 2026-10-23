import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/households/:id/appointments
 *
 * Fetch all appointment entries for a household record.
 * Accessible to all authenticated @inditronics.com users.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
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

    const email = user.email?.trim().toLowerCase() ?? "";
    if (!email.endsWith("@inditronics.com")) {
      return NextResponse.json(
        { error: "Only authorized company users may access household data." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("household_appointments")
      .select("id, scheduled_at, created_by, created_at")
      .eq("household_record_id", id)
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("GET /api/households/[id]/appointments error:", error);
      return NextResponse.json(
        { error: "Unable to fetch appointments." },
        { status: 500 }
      );
    }

    return NextResponse.json({ appointments: data ?? [] });
  } catch (error) {
    console.error(
      "GET /api/households/[id]/appointments unexpected error:",
      error
    );
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/households/:id/appointments
 *
 * Add a new appointment entry for a household record.
 * Only call_center role may add appointments.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
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

    const email = user.email?.trim().toLowerCase() ?? "";
    if (!email.endsWith("@inditronics.com")) {
      return NextResponse.json(
        { error: "Only authorized company users may update household records." },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    // Verify call_center role.
    const { data: roleRecord, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 500 }
      );
    }

    if (roleRecord?.role !== "call_center") {
      return NextResponse.json(
        { error: "Only Call Center users can add appointments." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Validate request body.
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { scheduled_at } = body as { scheduled_at?: unknown };

    if (typeof scheduled_at !== "string" || !scheduled_at.trim()) {
      return NextResponse.json(
        { error: "scheduled_at is required." },
        { status: 400 }
      );
    }

    const parsedDate = new Date(scheduled_at.trim());
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Please provide a valid date and time." },
        { status: 400 }
      );
    }

    // Check the household exists and its appointment_call_status is Scheduled.
    const { data: household, error: householdError } = await adminClient
      .from("tv_measurement_households")
      .select("id, appointment_call_status")
      .eq("id", id)
      .maybeSingle();

    if (householdError || !household) {
      return NextResponse.json(
        { error: "Household record not found." },
        { status: 404 }
      );
    }

    if (household.appointment_call_status !== "Scheduled") {
      return NextResponse.json(
        {
          error:
            "Cannot add appointments when Appointment Call Status is not 'Scheduled'.",
        },
        { status: 400 }
      );
    }

    const { data: appointment, error: insertError } = await adminClient
      .from("household_appointments")
      .insert({
        household_record_id: id,
        scheduled_at: parsedDate.toISOString(),
        created_by: user.id,
      })
      .select("id, scheduled_at, created_by, created_at")
      .single();

    if (insertError) {
      console.error(
        "POST /api/households/[id]/appointments insert error:",
        insertError
      );
      return NextResponse.json(
        { error: "Unable to add appointment." },
        { status: 500 }
      );
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    console.error(
      "POST /api/households/[id]/appointments unexpected error:",
      error
    );
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

