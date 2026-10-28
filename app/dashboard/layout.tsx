"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getStoredToken } from "@/lib/api";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

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

        setUser(res.user);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load user session:", err);
        router.replace("/login");
      });
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

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
          <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <SidebarTrigger />

            <Separator orientation="vertical" className="h-5" />

            <span className="text-sm font-medium">Household Panel</span>
          </header>

          <main className="flex-1 bg-muted/30 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthContext.Provider>
  );
}

