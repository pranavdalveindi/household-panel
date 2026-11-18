"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getStoredToken, clearStoredTokens, isSessionExpired } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Immediate check: If session has exceeded absolute 2-hour timeout, log out
    if (isSessionExpired()) {
      clearStoredTokens();
      router.replace("/login?reason=timeout");
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    api
      .getMe()
      .then((res) => {
        if (!res?.user) {
          router.replace("/login");
          return;
        }

        const email = (res.user.email ?? "").trim().toLowerCase();
        if (!email.endsWith("@inditronics.com")) {
          router.replace("/login?error=unauthorized");
          return;
        }

        // Only developer and admin are permitted
        const role = res.user.role ?? "";
        if (role !== "admin" && role !== "developer") {
          router.replace("/login?error=invalid_role");
          return;
        }

        setUser(res.user);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load user session:", err);
        if (isSessionExpired()) {
          clearStoredTokens();
          router.replace("/login?reason=timeout");
        } else {
          router.replace("/login");
        }
      });

    // 2. Continuous 2-hour absolute timeout watchdog
    const checkTimeout = () => {
      if (isSessionExpired()) {
        clearStoredTokens();
        router.replace("/login?reason=timeout");
      }
    };

    const interval = setInterval(checkTimeout, 5000); // Check every 5 seconds
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkTimeout();
      }
    };

    window.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [router]);

  const email = user?.email ?? "";
  const userName =
    user?.name || (email ? email.split("@")[0] : "User");
  const userRole = user?.role ?? null;
  const isAdmin = userRole === "admin";

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <SidebarProvider>
        <AppSidebar
          userEmail={email}
          userName={userName}
          isAdmin={isAdmin}
          userRole={userRole}
        />

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-4 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="shrink-0" />
              <Separator orientation="vertical" className="h-5" />
              <span className="truncate text-sm font-medium">Household Panel</span>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </header>

          <main className="relative flex-1 bg-muted/30 p-3 sm:p-4 md:p-6">
            <div className="w-full">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthContext.Provider>
  );
}

