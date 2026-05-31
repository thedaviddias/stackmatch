import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, DESIGN_THEMES, THEME_STORAGE_KEY } from "../themes";

describe("DESIGN_THEMES", () => {
  it("contains at least 2 themes", () => {
    expect(DESIGN_THEMES.length).toBeGreaterThanOrEqual(2);
  });

  it("each theme has required fields", () => {
    for (const theme of DESIGN_THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.label).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.emoji).toBeTruthy();
      expect(theme.previewColors).toHaveLength(3);
    }
  });

  it("each theme has valid hex preview colors", () => {
    for (const theme of DESIGN_THEMES) {
      for (const color of theme.previewColors) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("has unique theme IDs", () => {
    const ids = DESIGN_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("DEFAULT_THEME", () => {
  it("matches one of the available theme IDs", () => {
    const ids = DESIGN_THEMES.map((t) => t.id);
    expect(ids).toContain(DEFAULT_THEME);
  });
});

describe("THEME_STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(THEME_STORAGE_KEY).toBeTruthy();
    expect(typeof THEME_STORAGE_KEY).toBe("string");
  });
});
