"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_THEME,
  DESIGN_THEMES,
  type DesignThemeId,
  THEME_STORAGE_KEY,
} from "@/lib/re-exports/design-themes";

interface DesignThemeContextValue {
  designTheme: DesignThemeId;
  setDesignTheme: (theme: DesignThemeId) => void;
  themes: typeof DESIGN_THEMES;
}

const DesignThemeContext = createContext<DesignThemeContextValue | null>(null);

const validIds = DESIGN_THEMES.map((t) => t.id) as readonly string[];

export function DesignThemeProvider({ children }: { children: ReactNode }) {
  const [designTheme, setDesignThemeState] = useState<DesignThemeId>(DEFAULT_THEME);

  // Sync state with whatever the inline <script> already applied
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && validIds.includes(stored)) {
        setDesignThemeState(stored as DesignThemeId);
      }
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);

  const setDesignTheme = useCallback((theme: DesignThemeId) => {
    setDesignThemeState(theme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }

    if (theme === DEFAULT_THEME) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, []);

  const value = useMemo(
    () => ({ designTheme, setDesignTheme, themes: DESIGN_THEMES }),
    [designTheme, setDesignTheme]
  );

  return <DesignThemeContext.Provider value={value}>{children}</DesignThemeContext.Provider>;
}

export function useDesignTheme() {
  const ctx = useContext(DesignThemeContext);
  if (!ctx) {
    throw new Error("useDesignTheme must be used within a DesignThemeProvider");
  }
  return ctx;
}
