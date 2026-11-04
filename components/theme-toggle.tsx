"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "", showLabel = true }: { className?: string; showLabel?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("indirex_theme") as "dark" | "light" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
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

  if (!mounted) {
    return (
      <div className={`h-8 w-8 rounded-lg ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
        isDark
          ? "border-neutral-800 bg-[#12141D] text-neutral-200 hover:bg-[#1A1D2A] hover:border-neutral-700 hover:text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 shadow-sm"
      } ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="size-4 text-amber-400 shrink-0" />
          {showLabel && <span className="hidden sm:inline">Light Mode</span>}
        </>
      ) : (
        <>
          <Moon className="size-4 text-indigo-600 shrink-0" />
          {showLabel && <span className="hidden sm:inline">Dark Mode</span>}
        </>
      )}
    </button>
  );
}

