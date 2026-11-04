"use client";

import { useState, useEffect, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Activity,
  Layers,
  Radio,
  CheckCircle2,
  TrendingUp,
  Sun,
  Moon,
} from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [currentYear, setCurrentYear] = useState<number>(2026);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());

    const savedTheme = localStorage.getItem("indirex_theme") as "dark" | "light" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Default to user's system preference or dark
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      if (initial === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("indirex_theme", nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.endsWith("@inditronics.com")) {
      setError("Please use your authorized company email address (@inditronics.com).");
      return;
    }

    setLoading(true);

    try {
      await api.login(normalizedEmail, password);
      router.replace("/dashboard/panel");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const isDark = theme === "dark";

  return (
    <main
      className={`relative flex min-h-screen w-full transition-colors duration-300 ${
        isDark ? "bg-[#08090E] text-white" : "bg-[#F8FAFC] text-slate-900"
      }`}
    >
      {/* ========================================================
          THEME SWITCHER BUTTON (TOP RIGHT CORNER)
         ======================================================== */}
      <div className="absolute top-6 right-6 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium backdrop-blur-md transition-all shadow-sm ${
            isDark
              ? "border border-neutral-700/60 bg-neutral-900/80 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-600 shadow-neutral-950/40"
              : "border border-slate-200 bg-white/90 text-slate-700 hover:bg-white hover:border-slate-300 shadow-slate-200/60"
          }`}
        >
          {isDark ? (
            <>
              <Sun className="size-4 text-amber-400" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="size-4 text-indigo-600" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================
          LEFT PANEL: AUTHENTICATION FORM
         ======================================================== */}
      <div
        className={`flex w-full flex-col justify-between px-6 py-8 sm:px-12 md:px-16 lg:w-[48%] xl:w-[44%] 2xl:w-[50%] transition-colors duration-300 ${
          isDark
            ? "bg-[#08090E] border-r border-[#151824]/60"
            : "bg-white border-r border-slate-200"
        } z-10`}
      >
        {/* Header / Brand */}
        <header className="flex items-center gap-2">
          <div
            className={`flex size-14 items-center justify-center transition-all ${
              isDark
            }`}
          >
            <Image
              src="/indirex-icon.svg"
              alt="Indirex Logo"
              width={42}
              height={42}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={`text-2xl sm:text-2xl font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Indirex
              </span>
            </div>
            <span
              className={`block text-xs font-medium mb-1 ${
                isDark ? "text-neutral-400" : "text-slate-500"
              }`}
            >
              Household Panel
            </span>
          </div>
        </header>

        {/* Center Form Section */}
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <div className="mb-8">
            <h1
              className={`text-3xl font-bold tracking-tight sm:text-2xl ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Welcome back
            </h1>
            <p
              className={`mt-2 text-sm ${
                isDark ? "text-neutral-400" : "text-slate-600"
              }`}
            >
              Enter your credentials to access Indirex
            </p>
          </div>

          {error && (
            <div
              className={`mb-6 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs leading-relaxed ${
                isDark
                  ? "border-red-500/20 bg-red-500/10 text-red-400"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <AlertCircle
                className={`mt-0.5 size-4 shrink-0 ${
                  isDark ? "text-red-400" : "text-red-600"
                }`}
              />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className={`block text-xs font-medium ${
                  isDark ? "text-neutral-300" : "text-slate-700"
                }`}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@inditronics.com"
                required
                autoComplete="email"
                disabled={loading}
                className={`w-full rounded border px-4 py-2 text-sm outline-none transition-all focus:ring-2 disabled:opacity-50 ${
                  isDark
                    ? "border-[#212636] bg-[#11131C] text-white placeholder-neutral-500 focus:border-indigo-500 focus:bg-[#141724] focus:ring-indigo-500/20"
                    : "border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-600 focus:ring-indigo-500/20"
                }`}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className={`block text-xs font-medium ${
                  isDark ? "text-neutral-300" : "text-slate-700"
                }`}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className={`w-full rounded border px-4 py-2 pr-11 text-sm outline-none transition-all focus:ring-2 disabled:opacity-50 ${
                    isDark
                      ? "border-[#212636] bg-[#11131C] text-white placeholder-neutral-500 focus:border-indigo-500 focus:bg-[#141724] focus:ring-indigo-500/20"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-600 focus:ring-indigo-500/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                    isDark
                      ? "text-neutral-400 hover:text-neutral-200"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Security / Authorization Note */}
          <div
            className={`mt-8 flex items-center justify-center gap-2 text-xs ${
              isDark ? "text-neutral-500" : "text-slate-500"
            }`}
          >
            <ShieldCheck className="size-3.5 text-indigo-500" />
            <span>Internal tool for authorized personnel only</span>
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`text-center text-xs sm:text-left ${
            isDark ? "text-neutral-600" : "text-slate-500"
          }`}
        >
          © {currentYear} Inditronics Pvt Ltd. All rights reserved.
        </footer>
      </div>

      {/* ========================================================
          RIGHT PANEL: DYNAMIC LIVE TELEMETRY SHOWCASE
         ======================================================== */}
      <div
        className={`relative hidden flex-1 overflow-hidden lg:flex flex-col justify-between p-10 xl:p-14 transition-colors duration-300 ${
          isDark
            ? "bg-gradient-to-br from-[#0A0D18] via-[#090B14] to-[#05060A]"
            : "bg-gradient-to-br from-slate-100 via-indigo-50/40 to-blue-50/50"
        }`}
      >
        {/* Subtle Ambient Background Gradients */}
        <div
          className={`absolute -top-40 right-10 size-96 rounded-full blur-[120px] pointer-events-none ${
            isDark ? "bg-indigo-600/15" : "bg-indigo-300/30"
          }`}
        />
        <div
          className={`absolute top-1/3 -left-20 size-80 rounded-full blur-[100px] pointer-events-none ${
            isDark ? "bg-blue-500/10" : "bg-blue-200/40"
          }`}
        />

        {/* Subtle Cyber Grid Pattern Overlay */}
        <div
          className={`absolute inset-0 pointer-events-none ${
            isDark ? "opacity-[0.03]" : "opacity-[0.06]"
          }`}
          style={{
            backgroundImage: "radial-gradient(#4f46e5 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Top Header Tag & Status */}
        <div className="relative z-10 flex items-center justify-between">
          
          <span
            className={`text-xs font-mono ${
              isDark ? "text-neutral-500" : "text-slate-500"
            }`}
          >
          </span>
        </div>

        {/* Central Display Hero Typography */}
        <div className="relative z-10 max-w-2xl mt-8 mb-6">
          <h2
            className={`text-3xl xl:text-4xl font-bold tracking-tight leading-tight ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Household Panel Monitoring & Telemetry Dashboard
          </h2>
          {/* <p
            className={`mt-3 text-sm xl:text-base leading-relaxed max-w-xl ${
              isDark ? "text-neutral-400" : "text-slate-600"
            }`}
          >
            Unified command center designed for real-time telemetry, remote diagnostics, and automated TAM compliance reporting.
          </p> */}
        </div>

        {/* Interactive macOS Window Mockup Preview */}
        <div
          className={`relative z-10 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl transition-colors ${
            isDark
              ? "border-[#23283E] bg-[#0E111C]/90 text-white"
              : "border-slate-200 bg-white/95 text-slate-900 shadow-indigo-100/50"
          }`}
        >
          {/* Window Title Bar */}
          <div
            className={`flex items-center justify-between px-4 py-3 border-b ${
              isDark
                ? "border-[#1E2336] bg-[#121624]"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
              <span className="size-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
              <span className="size-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
            </div>
            <div
              className={`flex items-center gap-1.5 text-xs font-mono ${
                isDark ? "text-neutral-400" : "text-slate-600"
              }`}
            >
              <Layers className="size-3.5 text-indigo-500" />
              <span>indirex.io/panel-telemetry</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span
                className={`text-[11px] ${
                  isDark ? "text-neutral-400" : "text-slate-500"
                }`}
              >
                Connected
              </span>
            </div>
          </div>

          {/* Dashboard Preview Body */}
          <div className="p-5 space-y-4">
            {/* Quick Stat Metric Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div
                className={`rounded-xl border p-3 ${
                  isDark
                    ? "border-[#202538] bg-[#141826]/70"
                    : "border-slate-200 bg-slate-50/80"
                }`}
              >
                <span
                  className={`text-[11px] block font-medium ${
                    isDark ? "text-neutral-400" : "text-slate-500"
                  }`}
                >
                  Total Target
                </span>
                <span className="text-xl font-bold mt-0.5 block">400</span>
                <span
                  className={`text-[10px] mt-0.5 block ${
                    isDark ? "text-neutral-500" : "text-slate-400"
                  }`}
                >
                  11 Armenian Regions
                </span>
              </div>

              <div
                className={`rounded-xl border p-3 ${
                  isDark
                    ? "border-emerald-500/20 bg-emerald-950/20 text-emerald-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
              >
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">
                  Production Live
                </span>
                <span className="text-xl font-bold mt-0.5 block">268</span>
                <span className="text-[10px] text-emerald-600/90 dark:text-emerald-500/80 mt-0.5 flex items-center gap-1">
                  <TrendingUp className="size-2.5" /> 67.0% Quota Met
                </span>
              </div>

              <div
                className={`rounded-xl border p-3 ${
                  isDark
                    ? "border-blue-500/20 bg-blue-950/20 text-blue-300"
                    : "border-blue-200 bg-blue-50 text-blue-900"
                }`}
              >
                <span className="text-[11px] text-blue-600 dark:text-blue-400 block font-medium">
                  Training Live
                </span>
                <span className="text-xl font-bold mt-0.5 block">51</span>
                <span className="text-[10px] text-blue-600/90 dark:text-blue-500/80 mt-0.5 block">
                  Phase 1 & 2 Pipeline
                </span>
              </div>

              <div
                className={`rounded-xl border p-3 ${
                  isDark
                    ? "border-indigo-500/20 bg-indigo-950/20 text-indigo-300"
                    : "border-indigo-200 bg-indigo-50 text-indigo-900"
                }`}
              >
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block font-medium">
                  Installed Live
                </span>
                <span className="text-xl font-bold mt-0.5 block">5</span>
                <span className="text-[10px] text-indigo-600/90 dark:text-indigo-400/80 mt-0.5 block">
                  Pre-Production
                </span>
              </div>
            </div>

            {/* Regional Telemetry Live Strip */}
            <div
              className={`rounded-xl border p-3.5 flex items-center justify-between ${
                isDark
                  ? "border-[#202538] bg-[#141826]/70"
                  : "border-slate-200 bg-slate-50/80"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <Radio className="size-4 animate-pulse" />
                </div>
                <div>
                  <span
                    className={`text-xs font-semibold block ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Active Regional Stream
                  </span>
                  <span
                    className={`text-[11px] block ${
                      isDark ? "text-neutral-400" : "text-slate-500"
                    }`}
                  >
                    Yerevan • Gyumri • Vanadzor • Hrazdan • Kapan
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <span
                    className={`block text-[10px] ${
                      isDark ? "text-neutral-400" : "text-slate-400"
                    }`}
                  >
                    SLA Compliance
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> 100% On Schedule
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar Strip */}
            <div>
              <div
                className={`flex justify-between text-[11px] mb-1.5 ${
                  isDark ? "text-neutral-400" : "text-slate-500"
                }`}
              >
                <span>Panel Saturation Progress</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                  268 / 400 households
                </span>
              </div>
              <div
                className={`h-2 w-full rounded-full overflow-hidden ${
                  isDark ? "bg-[#1A1F30]" : "bg-slate-200"
                }`}
              >
                <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full w-[67%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div
          className={`relative z-10 flex items-center justify-between text-xs pt-6 ${
            isDark ? "text-neutral-400" : "text-slate-500"
          }`}
        >
        </div>
      </div>
    </main>
  );
}
