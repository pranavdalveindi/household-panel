import { redirect } from "next/navigation";

import { createClient } from "@/src/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { Separator } from "@/components/ui/separator";

// Required for your current Next.js Cache Components configuration.
export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the authenticated user.
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Redirect users who are not logged in.
  if (error || !user) {
    redirect("/login");
  }

  const email = user.email?.trim().toLowerCase() ?? "";

  // Allow only confirmed company email accounts.
  if (
    !user.email_confirmed_at ||
    !email.endsWith("@inditronics.com")
  ) {
    redirect("/login?error=unauthorized");
  }

  // Get the user's name from Supabase Auth metadata.
  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email.split("@")[0];

  // Check whether the user is an administrator and get their role
  const { data: roleRecord } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const userRole = roleRecord?.role ?? null;
  const isAdmin = userRole === "admin";

  return (
    <SidebarProvider>
      <AppSidebar
        userEmail={email}
        userName={userName}
        isAdmin={isAdmin}
        userRole={userRole}
      />

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger />

          <Separator
            orientation="vertical"
            className="h-5"
          />

          <span className="text-sm font-medium">
            Household Panel
          </span>
        </header>

        <main className="flex-1 bg-muted/30 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}