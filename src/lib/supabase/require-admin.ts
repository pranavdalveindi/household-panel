import { createClient } from "@/src/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (authError) {
      console.error("requireAdmin authError:", authError);
    }
    return {
      ok: false as const,
      status: 401,
      message: "Please sign in to continue.",
    };
  }

  const { data: roleRecord, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    console.error("requireAdmin roleError:", roleError);
    return {
      ok: false as const,
      status: 500,
      message: roleError.message || "Unable to verify your permissions.",
    };
  }

  if (roleRecord?.role !== "admin") {
    return {
      ok: false as const,
      status: 403,
      message: "Administrator access is required.",
    };
  }

  return {
    ok: true as const,
    user,
  };
}