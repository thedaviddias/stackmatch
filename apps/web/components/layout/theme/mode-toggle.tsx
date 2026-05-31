"use client";

import { cn } from "@stackmatch/utils/cn";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-28 h-9 rounded-xl bg-muted animate-pulse" />;

  const modes = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex p-1 rounded-xl bg-muted/50 border border-border w-fit relative overflow-hidden">
      {/* Sliding background highlight - tracks the 'theme' setting */}
      <div
        className={cn(
          "absolute inset-y-1 rounded-lg bg-background shadow-sm transition-all duration-300 ease-in-out",
          theme === "light" && "left-1 w-8",
          theme === "dark" && "left-9 w-8",
          theme === "system" && "left-[72px] w-8"
        )}
      />

      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = theme === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => setTheme(mode.id)}
            className={cn(
              "flex items-center justify-center w-8 h-7 z-10 transition-colors duration-300 relative",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            title={`Switch to ${mode.label} mode`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="sr-only">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
