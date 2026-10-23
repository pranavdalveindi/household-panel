import { NextResponse } from "next/server";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { requireAdmin } from "@/src/lib/supabase/require-admin";

const ALLOWED_ROLES = [
  "data_team",
  "call_center",
  "field_executive",
  "developer",
  "admin",
] as const;

type AppRole = (typeof ALLOWED_ROLES)[number];

/**
 * GET /api/admin/users
 *
 * List users and their assigned application roles.
 */
export async function GET() {
  const authorization = await requireAdmin();

  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status }
    );
  }

  try {
    const adminClient = createAdminClient();

    // Retrieve all Auth users in batches.
    const authUsers = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error("GET /api/admin/users listUsers error:", error);
        return NextResponse.json(
          { error: error.message || "Unable to retrieve users." },
          { status: 500 }
        );
      }

      authUsers.push(...data.users);

      if (data.users.length < perPage) {
        break;
      }

      page++;
    }

    // Retrieve role assignments.
    const { data: roleRecords, error: roleError } = await adminClient
      .from("user_roles")
      .select("user_id, role");

    if (roleError) {
      console.error("GET /api/admin/users user_roles error:", roleError);
      return NextResponse.json(
        { error: roleError.message || "Unable to retrieve user roles." },
        { status: 500 }
      );
    }

    const roleMap = new Map(
      (roleRecords ?? []).map((record) => [
        record.user_id,
        record.role,
      ])
    );

    const users = authUsers.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      role: roleMap.get(user.id) ?? null,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while retrieving users.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 *
 * Create a Supabase Auth user and assign an application role.
 */
export async function POST(request: Request) {
  const authorization = await requireAdmin();

  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status }
    );
  }

  try {
    const body = await request.json().catch(() => null);

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    const role = body?.role as AppRole;

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, password, and role are required." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    // The existing dashboard is restricted to company email addresses.
    if (!email.endsWith("@inditronics.com")) {
      return NextResponse.json(
        { error: "Only @inditronics.com email addresses are permitted." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "The password must contain at least 8 characters." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role selected." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Create a confirmed account because this is an administrator-managed
    // internal application. Use an appropriate internal account policy.
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create the user." },
        { status: 400 }
      );
    }

    // Assign the requested role.
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: data.user.id,
        role,
      });

    if (roleError) {
      // Roll back the account if the role cannot be assigned.
      await adminClient.auth.admin.deleteUser(data.user.id);

      return NextResponse.json(
        { error: "The user was created, but the role could not be assigned." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "User created successfully.",
        user: {
          id: data.user.id,
          email: data.user.email,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while creating the user.",
      },
      { status: 500 }
    );
  }
}