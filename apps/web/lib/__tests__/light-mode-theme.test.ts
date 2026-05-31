import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LIGHT_MODE_CRITICAL_FILES = [
  "app/layout.tsx",
  "components/layout/chrome/header.tsx",
  "components/layout/chrome/footer.tsx",
  "components/search/search-trigger.tsx",
  "components/search/global-search-modal.tsx",
  "components/search/previews/package-preview.tsx",
  "components/search/previews/user-preview.tsx",
  "components/search/previews/language-preview.tsx",
  "components/search/previews/topic-preview.tsx",
  "components/search/search-trending.tsx",
  "components/stackmatch/owner-lookup-form.tsx",
  "components/stackmatch/owner-actions.tsx",
  "components/stackmatch/top-packages-list.tsx",
  "components/stackmatch/matches/match-of-the-week.tsx",
  "components/cards/user-card.tsx",
  "components/ui/gates/claim-profile-banner.tsx",
  "app/[owner]/owner-page-content.tsx",
  "app/[owner]/sections/profile-header.tsx",
  "app/[owner]/sections/stack-fingerprint-section.tsx",
  "app/[owner]/sections/top-deps-section.tsx",
  "app/[owner]/sections/notable-projects-section.tsx",
  "app/[owner]/sections/stackmates-section.tsx",
  "app/[owner]/sections/sync-alerts.tsx",
  "../../packages/ui/src/section-title.tsx",
  "../../packages/ui/src/badge.tsx",
  "../../packages/ui/src/profile-elements.tsx",
] as const;

const LIGHT_MODE_SKELETON_FILES = [
  "app/feed/feed-content.tsx",
  "app/messages/messages-content.tsx",
  "app/messages/[conversationId]/conversation-content.tsx",
  "app/notifications/notifications-content.tsx",
  "app/package/[...name]/sections/package-analytics.tsx",
  "app/settings/layout.tsx",
  "components/pages/developers/developers-directory-content.tsx",
  "components/pages/topics/topics-directory-content.tsx",
  "components/pages/repo-dashboard-content.tsx",
  "components/pages/stacks/stacks-directory-content.tsx",
  "components/pages/top-stackers/top-stackers-directory-content.tsx",
  "components/settings/location-settings.tsx",
  "components/skeletons/page-skeletons.tsx",
  "components/social/activity-feed.tsx",
  "components/stackmatch/panels/notification-preferences-panel.tsx",
  "components/stackmatch/panels/notifications-inbox-panel.tsx",
] as const;

const DARK_ONLY_TOKENS =
  /^(bg-(?:black|neutral-9\d\d)|border-neutral-8\d\d|text-white|text-neutral-[3-6]00|text-(?:amber|yellow|lime|emerald|cyan|sky|blue|indigo|purple|fuchsia|pink|rose)-[234]00)(?:\/.+)?$/;
const DARK_ONLY_SKELETON_TOKENS =
  /^(bg-(?:black|neutral-[89]\d\d)|border-(?:white|neutral-[89]\d\d))(?:\/.+)?$/;
const BORDER_TOKEN_PATTERN =
  /--(?:border|input|sidebar-border|borderColor-default|borderColor-muted):\s*(#[0-9a-fA-F]{6})/g;
const LIGHT_BORDER_TOKEN_FILES = ["styles/tokens/colors.css", "styles/tokens/github.css"] as const;
const WHITE_HEX = "#ffffff";
const GITHUB_LIGHT_TOPIC_SELECTOR = `html:not(.dark)[data-theme="github"] [data-theme-label="topic"]`;
const GITHUB_PRIMER_LIGHT_BORDER_HEX = new Set(["#8c959f", "#afb8c1", "#d0d7de", "#d8dee4"]);
const LIGHT_BORDER_MIN_CONTRAST = 3;
const LIGHT_TEXT_MIN_CONTRAST = 4.5;
const RGB_CHANNEL_MAX = 255;
const SRGB_LINEAR_THRESHOLD = 0.03928;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_DIVISOR = 1.055;
const SRGB_GAMMA_EXPONENT = 2.4;
const RED_LUMINANCE_WEIGHT = 0.2126;
const GREEN_LUMINANCE_WEIGHT = 0.7152;
const BLUE_LUMINANCE_WEIGHT = 0.0722;
const CONTRAST_OFFSET = 0.05;
const SAFE_ACCENT_SURFACES = [
  "bg-th-accent",
  "bg-gradient",
  "bg-destructive",
  "bg-rose",
  "bg-emerald",
  "fill-current",
];

function extractClassTokens(source: string) {
  const tokens: Array<{ token: string; classString: string }> = [];
  const classLiteralPattern = /(?:className|className\?)=\{?["'`]([^"'`]+)["'`]\}?/g;

  for (const match of source.matchAll(classLiteralPattern)) {
    const classString = match[1] ?? "";
    for (const token of classString.split(/\s+/).filter(Boolean)) {
      tokens.push({ token, classString });
    }
  }

  return tokens;
}

function extractStringLiteralTokens(source: string) {
  const tokens: Array<{ token: string; classString: string }> = [];
  const stringLiteralPattern = /["'`]([^"'`]*animate-pulse[^"'`]*)["'`]/g;

  for (const match of source.matchAll(stringLiteralPattern)) {
    const classString = match[1] ?? "";
    for (const token of classString.split(/\s+/).filter(Boolean)) {
      tokens.push({ token, classString });
    }
  }

  return tokens;
}

function isAllowedDarkOnlyToken(token: string, classString: string) {
  if (token.startsWith("dark:")) return true;
  if (token.includes(":")) return true;
  if (SAFE_ACCENT_SURFACES.some((surface) => classString.includes(surface))) return true;
  return false;
}

function toLinearSrgb(channel: number) {
  if (channel <= SRGB_LINEAR_THRESHOLD) {
    return channel / SRGB_LINEAR_DIVISOR;
  }

  return ((channel + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_DIVISOR) ** SRGB_GAMMA_EXPONENT;
}

function hexToLuminance(hex: string) {
  const normalized = hex.replace("#", "");
  const red = toLinearSrgb(Number.parseInt(normalized.slice(0, 2), 16) / RGB_CHANNEL_MAX);
  const green = toLinearSrgb(Number.parseInt(normalized.slice(2, 4), 16) / RGB_CHANNEL_MAX);
  const blue = toLinearSrgb(Number.parseInt(normalized.slice(4, 6), 16) / RGB_CHANNEL_MAX);

  return RED_LUMINANCE_WEIGHT * red + GREEN_LUMINANCE_WEIGHT * green + BLUE_LUMINANCE_WEIGHT * blue;
}

function contrastRatio(firstHex: string, secondHex: string) {
  const first = hexToLuminance(firstHex);
  const second = hexToLuminance(secondHex);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}

function extractCssRule(source: string, selector: string) {
  const selectorStart = source.indexOf(selector);
  if (selectorStart === -1) return null;
  const blockStart = source.indexOf("{", selectorStart);
  const blockEnd = source.indexOf("}", blockStart);
  if (blockStart === -1 || blockEnd === -1) return null;
  return source.slice(blockStart + 1, blockEnd);
}

function extractCssDeclaration(rule: string, declaration: string) {
  const pattern = new RegExp(`(?:^|[;\\n])\\s*${declaration}:\\s*(#[0-9a-fA-F]{6})`);
  return pattern.exec(rule)?.[1] ?? null;
}

function isAllowedPrimerBorderToken(file: string, value: string) {
  return (
    LIGHT_BORDER_TOKEN_FILES.includes(file as (typeof LIGHT_BORDER_TOKEN_FILES)[number]) &&
    GITHUB_PRIMER_LIGHT_BORDER_HEX.has(value)
  );
}

describe("light mode theme coverage", () => {
  it("keeps critical shared UI surfaces free of unqualified dark-only utilities", () => {
    const violations = LIGHT_MODE_CRITICAL_FILES.flatMap((file) => {
      const absolutePath = resolve(process.cwd(), file);
      const source = readFileSync(absolutePath, "utf8");

      return extractClassTokens(source)
        .filter(({ token, classString }) => {
          return DARK_ONLY_TOKENS.test(token) && !isAllowedDarkOnlyToken(token, classString);
        })
        .map(({ token }) => `${file}: ${token}`);
    });

    expect(violations).toEqual([]);
  });

  it("keeps loading skeletons mode-aware", () => {
    const violations = LIGHT_MODE_SKELETON_FILES.flatMap((file) => {
      const absolutePath = resolve(process.cwd(), file);
      const source = readFileSync(absolutePath, "utf8");

      return extractStringLiteralTokens(source)
        .filter(({ classString }) => classString.includes("animate-pulse"))
        .flatMap(({ token, classString }) => {
          if (token.startsWith("dark:")) return [];
          if (!DARK_ONLY_SKELETON_TOKENS.test(token)) return [];
          return [`${file}: ${token} in ${classString}`];
        });
    });

    expect(violations).toEqual([]);
  });

  it("keeps border tokens visible on light backgrounds", () => {
    const violations = LIGHT_BORDER_TOKEN_FILES.flatMap((file) => {
      const absolutePath = resolve(process.cwd(), file);
      const source = readFileSync(absolutePath, "utf8");

      return Array.from(source.matchAll(BORDER_TOKEN_PATTERN)).flatMap((match) => {
        const value = match[1];
        if (!value) return [];
        if (isAllowedPrimerBorderToken(file, value)) return [];
        const ratio = contrastRatio(value, WHITE_HEX);
        if (ratio >= LIGHT_BORDER_MIN_CONTRAST) return [];
        return [`${file}: ${value} has ${ratio.toFixed(2)}:1 contrast on white`];
      });
    });

    expect(violations).toEqual([]);
  });

  it("keeps GitHub light topic tags neutral and readable", () => {
    const source = readFileSync(resolve(process.cwd(), "styles/tokens/github.css"), "utf8");
    const lightTagRule = extractCssRule(source, GITHUB_LIGHT_TOPIC_SELECTOR);

    expect(lightTagRule).not.toBeNull();

    const background = extractCssDeclaration(lightTagRule ?? "", "background-color");
    const foreground = extractCssDeclaration(lightTagRule ?? "", "color");

    expect(background).toBeTruthy();
    expect(foreground).toBeTruthy();

    if (background && foreground) {
      expect(contrastRatio(background, foreground)).toBeGreaterThanOrEqual(LIGHT_TEXT_MIN_CONTRAST);
    }
  });
});
