import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string; appointmentId: string }>;
};

/**
 * DELETE /api/households/:id/appointments/:appointmentId
 *
 * Remove a specific appointment entry.
 * Only call_center role may delete appointments.
 */
export async function DELETE(_request: Request, context: RouteContext) {
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
        { error: "Only Call Center users can delete appointments." },
        { status: 403 }
      );
    }

    const { appointmentId } = await context.params;

    const { error: deleteError } = await adminClient
      .from("household_appointments")
      .delete()
      .eq("id", appointmentId);

    if (deleteError) {
      console.error(
        "DELETE /api/households/[id]/appointments/[appointmentId] error:",
        deleteError
      );
      return NextResponse.json(
        { error: "Unable to delete appointment." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Appointment deleted successfully." });
  } catch (error) {
    console.error(
      "DELETE /api/households/[id]/appointments/[appointmentId] unexpected error:",
      error
    );
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

