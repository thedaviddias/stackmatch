import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  EARLY_ACCESS_INVITE_TOKEN_PREFIX,
  EARLY_ACCESS_INVITE_TOKEN_TTL_MS,
  HARD_NOISE_PACKAGE_PREFIXES,
  HOUR_MS,
  INVITE_BONUS_MAX_SCORE,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  LOW_SIGNAL_PACKAGE_NAMES,
  LOW_SIGNAL_PACKAGE_PREFIXES,
  LOW_SIGNAL_PACKAGE_WEIGHT,
  MAX_INVITE_CODES_PER_USER,
  MINUTE_MS,
  SECOND_MS,
  STACK_SCORE_POINTS_PER_REFERRAL,
  TOAST_DURATION_MS,
  TOAST_DURATION_SECONDS,
  WEEK_MS,
} from "../index";

describe("@stackmatch/constants", () => {
  it("keeps time-unit invariants", () => {
    expect(HOUR_MS).toBe(60 * MINUTE_MS);
    expect(DAY_MS).toBe(24 * HOUR_MS);
    expect(WEEK_MS).toBe(7 * DAY_MS);
  });

  it("uses the expected invite-code alphabet and length", () => {
    expect(INVITE_CODE_LENGTH).toBe(8);
    expect(INVITE_CODE_ALPHABET).toMatch(/^[A-Z0-9]+$/);
    expect(INVITE_CODE_ALPHABET).not.toContain("0");
    expect(INVITE_CODE_ALPHABET).not.toContain("1");
    expect(INVITE_CODE_ALPHABET).not.toContain("O");
    expect(INVITE_CODE_ALPHABET).not.toContain("I");
    expect(INVITE_CODE_ALPHABET).not.toContain("L");
  });

  it("keeps invite reward defaults", () => {
    expect(MAX_INVITE_CODES_PER_USER).toBe(3);
    expect(STACK_SCORE_POINTS_PER_REFERRAL).toBe(5);
    expect(INVITE_BONUS_MAX_SCORE).toBe(
      MAX_INVITE_CODES_PER_USER * STACK_SCORE_POINTS_PER_REFERRAL
    );
  });

  it("keeps early-access invite token defaults", () => {
    expect(EARLY_ACCESS_INVITE_TOKEN_PREFIX).toBe("inv_");
    expect(EARLY_ACCESS_INVITE_TOKEN_TTL_MS).toBe(WEEK_MS);
  });

  it("keeps shared toast defaults", () => {
    expect(TOAST_DURATION_MS).toBe(TOAST_DURATION_SECONDS * SECOND_MS);
  });

  it("keeps ranking package-signal policy available", () => {
    expect(HARD_NOISE_PACKAGE_PREFIXES).toContain("@types/");
    expect(LOW_SIGNAL_PACKAGE_NAMES).toContain("eslint");
    expect(LOW_SIGNAL_PACKAGE_NAMES).toContain("typescript");
    expect(LOW_SIGNAL_PACKAGE_NAMES).toContain("lefthook");
    expect(LOW_SIGNAL_PACKAGE_PREFIXES).toContain("@biomejs/");
    expect(LOW_SIGNAL_PACKAGE_PREFIXES).toContain("@commitlint/");
    expect(LOW_SIGNAL_PACKAGE_PREFIXES).toContain("@changesets/");
    expect(LOW_SIGNAL_PACKAGE_WEIGHT).toBe(0.25);
  });
});
