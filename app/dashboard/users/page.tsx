import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import UsersManagement from "./users-management";

export default async function UsersPage() {
  const supabase = await createClient();

  // Check the logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check whether the user is an admin
  const { data: userRole, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || userRole?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          User Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Create users, assign roles, and manage existing accounts.
        </p>
      </div>

      <UsersManagement />
    </div>
  );
}