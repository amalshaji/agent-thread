"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const themeStorageKey = "agent-thread-theme";
type Theme = "light" | "dark";

function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("light");

  React.useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(isTheme(current) ? current : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);

    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {}
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={theme === "dark"}
      onClick={toggleTheme}
      className="h-8 gap-2 border-border bg-transparent px-2.5 font-mono text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {theme === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </Button>
  );
}
