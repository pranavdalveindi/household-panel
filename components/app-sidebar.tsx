"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  LayoutDashboard,
  Building2,
  LogOut,
  UserRound,
  ChevronUp,
  LoaderCircle,
  Users,
} from "lucide-react";

import { createClient } from "@/src/lib/supabase/client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "@/components/ui/button";

type AppSidebarProps = {
  userEmail: string;
  userName: string;
  isAdmin?: boolean;
};

export function AppSidebar({
  userEmail,
  userName,
  isAdmin = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useSidebar();

  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  async function handleSignOut() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign-out failed:", error.message);
        setLoggingOut(false);
        return;
      }

      setProfileOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Unexpected sign-out error:", error);
      setLoggingOut(false);
    }
  }

  return (
    <Sidebar collapsible="icon">
      {/* Branding */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" />}
              tooltip="Inditronics"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-5" />
              </div>

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  Inditronics
                </span>

                <span className="truncate text-xs text-muted-foreground">
                  Household Dashboard
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/dashboard" />}
                  isActive={pathname === "/dashboard"}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/dashboard/users" />}
                    isActive={pathname.startsWith("/dashboard/users")}
                    tooltip="User Management"
                  >
                    <Users />
                    <span>User Management</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Clickable user profile */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Popover
              open={profileOpen}
              onOpenChange={setProfileOpen}
            >
              <PopoverTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={userName}
                    className="w-full"
                  />
                }
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials || <UserRound className="size-4" />}
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {userName}
                  </span>

                  <span className="truncate text-xs text-muted-foreground">
                    View profile
                  </span>
                </div>

                <ChevronUp className="ml-auto size-4" />
              </PopoverTrigger>

              <PopoverContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-72"
              >
                <div className="space-y-4">
                  {/* User information */}
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials || (
                        <UserRound className="size-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {userName}
                      </p>

                      <p className="break-all text-xs text-muted-foreground">
                        {userEmail}
                      </p>
                    </div>
                  </div>

                  <div className="border-t" />

                  {/* Sign out */}
                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={handleSignOut}
                    disabled={loggingOut}
                  >
                    {loggingOut ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <LogOut className="size-4" />
                    )}

                    {loggingOut ? "Signing out..." : "Sign out"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}