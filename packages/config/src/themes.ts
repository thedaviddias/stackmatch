import type { DesignTheme, DesignThemeId } from "@stackmatch/types/theme";

export const DESIGN_THEMES: readonly DesignTheme[] = [
  {
    id: "neon",
    label: "Neon",
    description: "Pink, purple & indigo",
    emoji: "\u{1F338}",
    previewColors: ["#ec4899", "#a855f7", "#6366f1"],
  },
  {
    id: "github",
    label: "GitHub",
    description: "Classic GitHub dark",
    emoji: "\u{1F419}",
    previewColors: ["#0d1117", "#58a6ff", "#238636"],
  },
] as const;

export const DEFAULT_THEME: DesignThemeId = "neon";

export const THEME_STORAGE_KEY = "stackmatch-design-theme";
