"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "../../src/lib/supabase/client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.endsWith("@inditronics.com")) {
      setError("Please use your authorized company email address.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (loginError) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Company header */}
      <header className="flex h-16 items-center border-b px-6 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            I
          </div>

          <span className="text-sm font-semibold tracking-tight">
            Inditronics
          </span>
        </div>

        <Separator orientation="vertical" className="mx-5 h-6" />

        <span className="text-sm text-muted-foreground">
          Household Panel
        </span>
      </header>

      {/* Login section */}
      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Page heading */}
          <div className="mb-7 space-y-2">
            <p className="text-sm font-medium text-primary">
              Welcome back
            </p>

            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your account
            </h1>

            <p className="text-sm leading-6 text-muted-foreground">
              Use your company credentials to access the dashboard.
            </p>
          </div>

          {/* Login card */}
          <Card className="rounded-lg shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                Account details
              </CardTitle>

              <CardDescription>
                Enter your registered company email and password.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Company email</Label>

                  <Input
                    id="email"
                    type="email"
                    placeholder="name@inditronics.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>

                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {/* Error message */}
                {error && (
                  <p
                    role="alert"
                    className="text-sm font-medium text-destructive"
                  >
                    {error}
                  </p>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Security separator */}
          <div className="mt-6 flex items-center gap-3">
            <Separator className="flex-1" />

            <span className="text-xs text-muted-foreground">
              SECURE ACCESS
            </span>

            <Separator className="flex-1" />
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Access is restricted to authorized personnel.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {currentYear ?? "2026"} Inditronics. All rights reserved.
        </p>
      </footer>
    </main>
  );
}