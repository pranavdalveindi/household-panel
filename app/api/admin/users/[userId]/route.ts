import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { requireAdmin } from "@/src/lib/supabase/require-admin";


const ALLOWED_ROLES = [
  "data_team",
  "call_center",
  "developer",
  "admin",
] as const;

type AppRole = (typeof ALLOWED_ROLES)[number];

type RouteContext = {
  params: Promise<{ userId: string }>;
};

/**
 * PATCH /api/admin/users/:userId
 *
 * Change a user's role.
 */
export async function PATCH(
  request: Request,
  context: RouteContext
) {
  const authorization = await requireAdmin();

  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status }
    );
  }

  try {
    const { userId } = await context.params;
    const body = await request.json().catch(() => null);
    const role = body?.role as AppRole;

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role selected." },
        { status: 400 }
      );
    }

    // Prevent the administrator from accidentally removing their own access.
    if (userId === authorization.user.id && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own administrator role." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Verify the Auth user exists
    const { data: authUserData, error: authUserError } =
      await adminClient.auth.admin.getUserById(userId);

    if (authUserError || !authUserData?.user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const { data: existingRole, error: lookupError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) {
      console.error("PATCH /api/admin/users/[userId] lookupError:", lookupError);
      return NextResponse.json(
        { error: "Unable to retrieve the user's current role." },
        { status: 500 }
      );
    }

    // Prevent demotion of the last administrator.
    if (existingRole?.role === "admin" && role !== "admin") {
      const { count, error: countError } = await adminClient
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        console.error("PATCH /api/admin/users/[userId] countError:", countError);
        return NextResponse.json(
          { error: "Unable to verify administrator accounts." },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "The last administrator cannot be demoted." },
          { status: 409 }
        );
      }
    }

    const { error: saveRoleError } = existingRole
      ? await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId)
      : await adminClient
          .from("user_roles")
          .insert({ user_id: userId, role });

    if (saveRoleError) {
      console.error("PATCH /api/admin/users/[userId] saveRoleError:", saveRoleError);
      return NextResponse.json(
        { error: saveRoleError.message || "Unable to update the user's role." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "User role updated successfully.",
    });
  } catch (error) {
    console.error("PATCH /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while updating the role.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/:userId
 *
 * Delete a user's Auth account.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  const authorization = await requireAdmin();

  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status }
    );
  }

  try {
    const { userId } = await context.params;

    // Prevent accidental removal of the currently logged-in administrator.
    if (userId === authorization.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account from this page." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Verify the Auth user exists
    const { data: authUserData, error: authUserError } =
      await adminClient.auth.admin.getUserById(userId);

    if (authUserError || !authUserData?.user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const { data: targetRole, error: lookupError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) {
      console.error("DELETE /api/admin/users/[userId] lookupError:", lookupError);
      return NextResponse.json(
        { error: "Unable to retrieve the user's role." },
        { status: 500 }
      );
    }

    // Do not allow deletion of the last administrator.
    if (targetRole?.role === "admin") {
      const { count, error: countError } = await adminClient
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        console.error("DELETE /api/admin/users/[userId] countError:", countError);
        return NextResponse.json(
          { error: "Unable to verify administrator accounts." },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "The last administrator cannot be deleted." },
          { status: 409 }
        );
      }
    }

    // Remove user_roles record if present
    if (targetRole) {
      await adminClient.from("user_roles").delete().eq("user_id", userId);
    }

    // Preserve household history while removing the Auth account.
    // This clears the optional processor reference added for call tracking.
    const { error: processorError } = await adminClient
      .from("tv_measurement_households")
      .update({ processed_by: null })
      .eq("processed_by", userId);

    if (processorError) {
      console.error("DELETE /api/admin/users/[userId] processorError:", processorError);
      return NextResponse.json(
        {
          error:
            "Unable to clear the user's household references. The account was not deleted.",
        },
        { status: 500 }
      );
    }

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("DELETE /api/admin/users/[userId] deleteError:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Unable to delete the user account." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while deleting the user.",
      },
      { status: 500 }
    );
  }
}