import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export const ALLOWED_CALL_STATUSES = [
  "call successful",
  "Not reachable",
  "Number does not connect",
] as const;

export const ALLOWED_APPOINTMENT_CALL_STATUSES = [
  "Scheduled",
  "Rejected",
] as const;

export const ALLOWED_INSTALLATION_STATUSES = [
  "pending",
  "installed",
  "rejected",
] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeCallStatus(
  value: unknown
): (typeof ALLOWED_CALL_STATUSES)[number] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  for (const status of ALLOWED_CALL_STATUSES) {
    if (status.toLowerCase() === trimmed) return status;
  }
  return null;
}

function normalizeAppointmentCallStatus(
  value: unknown
): (typeof ALLOWED_APPOINTMENT_CALL_STATUSES)[number] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  for (const status of ALLOWED_APPOINTMENT_CALL_STATUSES) {
    if (status.toLowerCase() === trimmed.toLowerCase()) return status;
  }
  return null;
}

function normalizeInstallationStatus(
  value: unknown
): (typeof ALLOWED_INSTALLATION_STATUSES)[number] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  for (const status of ALLOWED_INSTALLATION_STATUSES) {
    if (status.toLowerCase() === trimmed) return status;
  }
  return null;
}

/**
 * PATCH /api/households/:id
 *
 * - call_center: may update call_status and appointment_call_status.
 * - field_executive: may update installation_status only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // Authenticate.
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
        {
          error:
            "Only authorized company users may update household records.",
        },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    // Resolve role.
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

    if (role !== "call_center" && role !== "field_executive") {
      return NextResponse.json(
        {
          error:
            "Permission denied. Only Call Center and Field Executive users can update household records.",
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
      .select(
        "id, appointment_status, call_status, scheduled_date, appointment_call_status, installation_status"
      )
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

    // Parse body.
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // ──────────────────────────────────────────────────────────────────────────
    // FIELD EXECUTIVE path: only installation_status is permitted.
    // ──────────────────────────────────────────────────────────────────────────
    if (role === "field_executive") {
      const normalizedInstall = normalizeInstallationStatus(
        (body as Record<string, unknown>).installation_status
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

      // Field executive may only update when appointment_call_status is Scheduled.
      if (existingRecord.appointment_call_status !== "Scheduled") {
        return NextResponse.json(
          {
            error:
              "Cannot update Installation Status when Appointment Call Status is not Scheduled.",
          },
          { status: 400 }
        );
      }

      const { data, error: updateError } = await adminClient
        .from("tv_measurement_households")
        .update({
          installation_status: normalizedInstall,
          updated_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error(
          "PATCH /api/households/[id] field_executive update error:",
          updateError
        );
        return NextResponse.json(
          { error: updateError.message || "Unable to update household record." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Installation status updated successfully.",
        household: data,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CALL CENTER path: call_status + appointment_call_status.
    // ──────────────────────────────────────────────────────────────────────────
    const b = body as Record<string, unknown>;

    const normalizedCallStatus = normalizeCallStatus(b.call_status);

    if (!normalizedCallStatus) {
      return NextResponse.json(
        {
          error:
            "Invalid Call Status. Options are: call successful, Not reachable, Number does not connect.",
        },
        { status: 400 }
      );
    }

    // appointment_call_status is required when call is successful.
    const normalizedApptCallStatus = normalizeAppointmentCallStatus(
      b.appointment_call_status
    );

    if (normalizedCallStatus === "call successful" && !normalizedApptCallStatus) {
      return NextResponse.json(
        {
          error:
            "Appointment Call Status is required when Call Status is 'call successful'. Options are: Scheduled, Rejected.",
        },
        { status: 400 }
      );
    }

    const fullPayload: Record<string, unknown> = {
      call_status: normalizedCallStatus,
      appointment_call_status:
        normalizedCallStatus === "call successful"
          ? normalizedApptCallStatus
          : "Rejected",
      processed_at: now,
      processed_by: user.id,
      updated_at: now,
    };

    const { data, error: updateError } = await adminClient
      .from("tv_measurement_households")
      .update(fullPayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "PATCH /api/households/[id] call_center update error:",
        updateError
      );
      return NextResponse.json(
        {
          error: updateError.message || "Unable to update household record.",
        },
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

