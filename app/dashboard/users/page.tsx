"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../layout";
import UsersManagement from "./users-management";
import { Loader2 } from "lucide-react";

export default function UsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
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
