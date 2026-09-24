"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

function subscribeTheme(callback: () => void) {
  window.addEventListener("nalar-theme-change", callback);
  return () => window.removeEventListener("nalar-theme-change", callback);
}

function getThemeSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function getServerThemeSnapshot(): Theme {
  return "dark";
}

function subscribeHydration() {
  return () => undefined;
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

/**
 * Minimal theme toggle: sun/moon icon, persists to localStorage,
 * accessible with keyboard, animated transition.
 */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const mounted = useSyncExternalStore(subscribeHydration, getHydratedSnapshot, getServerHydratedSnapshot);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("nalar-theme", next);
    window.dispatchEvent(new Event("nalar-theme-change"));
  }

  if (!mounted) {
    return (
      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted" aria-label="Toggle theme" disabled>
        <span className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary hover:border-border-strong"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Moon /> : <Sun />}
    </button>
  );
}
