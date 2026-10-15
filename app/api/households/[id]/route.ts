import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

const ALLOWED_CALL_STATUSES = ["Called", "Not called", "Busy"] as const;
const ALLOWED_APPOINTMENT_STATUSES = ["scheduled", "not scheduled"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/households/:id
 *
 * Update call_status, appointment_status, and scheduled_date for a household.
 */
export async function PATCH(request: Request, context: RouteContext) {
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

    // Verify user role: only call_center (and admin) can update household status
    const { data: roleRecord, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("PATCH /api/households/[id] roleError:", roleError);
      return NextResponse.json(
        { error: "Unable to verify user permissions." },
        { status: 500 }
      );
    }

    const role = roleRecord?.role;
    if (role !== "call_center" && role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Permission denied. Household status updates can only be performed by Call Center members.",
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

    const body = await request.json().catch(() => null);

    const callStatus =
      typeof body?.call_status === "string" ? body.call_status.trim() : "";
    const appointmentStatus =
      typeof body?.appointment_status === "string"
        ? body.appointment_status.trim().toLowerCase()
        : "";
    const scheduledDate =
      typeof body?.scheduled_date === "string" && body.scheduled_date.trim()
        ? body.scheduled_date.trim()
        : null;

    if (!ALLOWED_CALL_STATUSES.includes(callStatus as any)) {
      return NextResponse.json(
        {
          error:
            "Invalid call status. Options are: Called, Not called, Busy.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_APPOINTMENT_STATUSES.includes(appointmentStatus as any)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid appointment status. Options are: scheduled, not scheduled.",
        },
        { status: 400 }
      );
    }

    if (appointmentStatus === "scheduled" && !scheduledDate) {
      return NextResponse.json(
        {
          error:
            "A schedule date is required when appointment status is scheduled.",
        },
        { status: 400 }
      );
    }

    const updatePayload = {
      call_status: callStatus,
      appointment_status: appointmentStatus,
      scheduled_date:
        appointmentStatus === "scheduled" ? scheduledDate : null,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await adminClient
      .from("tv_measurement_households")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("PATCH /api/households/[id] update error:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Unable to update household record." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Household updated successfully.",
      household: data,
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

