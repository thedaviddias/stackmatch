export type DesignThemeId = "neon" | "ocean" | "sunset" | "cyberpunk" | "github";

export interface DesignTheme {
  readonly id: DesignThemeId;
  readonly label: string;
  readonly description: string;
  readonly emoji: string;
  readonly previewColors: readonly [string, string, string];
}
