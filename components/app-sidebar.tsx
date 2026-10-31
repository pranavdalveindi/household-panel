"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Building2,
  LogOut,
  UserRound,
  ChevronUp,
  LoaderCircle,
  Users,
  BarChart3,
} from "lucide-react";

import { api } from "@/lib/api";

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
  userRole?: string | null;
};

const ROLE_DETAILS: Record<string, { label: string; description: string }> = {
  call_center: {
    label: "Call Center",
    description: "Call Center Operations & Household Calling",
  },
  field_executive: {
    label: "Field Executive",
    description: "On-site Installation & Status Updates",
  },
  admin: {
    label: "Administrator",
    description: "Full Admin Access & User Management",
  },
  data_team: {
    label: "Data Team",
    description: "Data Analytics & Verification",
  },
  developer: {
    label: "Developer",
    description: "System Development & Engineering",
  },
};

export function AppSidebar({
  userEmail,
  userName,
  isAdmin = false,
  userRole = null,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useSidebar();

  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const roleInfo =
    (userRole && ROLE_DETAILS[userRole]) || {
      label: userRole
        ? userRole
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        : "Unassigned",
      description: "Standard Application Access",
    };

  // Reset local UI state when the authenticated account changes.
  useEffect(() => {
    setLoggingOut(false);
    setProfileOpen(false);
  }, [userEmail]);

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
      await api.logout();

      setProfileOpen(false);

      // Navigate to login after a successful sign-out.
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Unexpected sign-out error:", error);
    } finally {
      // Never leave the button permanently in its loading state.
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

              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/dashboard/panel" />}
                  isActive={pathname.startsWith("/dashboard/panel")}
                  tooltip="Panel Monitoring"
                >
                  <BarChart3 />
                  <span>Panel Management</span>
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

                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {roleInfo.label}
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
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">
                          {userName}
                        </p>
                        <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {roleInfo.label}
                        </span>
                      </div>

                      <p className="break-all text-xs text-muted-foreground">
                        {userEmail}
                      </p>

                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {roleInfo.description}
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