import { describe, expect, it } from "vitest";
import { generateInviteCode } from "../invite_code";

const ALLOWED_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

describe("generateInviteCode", () => {
  it("returns a string of exactly 8 characters", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
  });

  it("uses only characters from the allowed alphabet", () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      for (const char of code) {
        expect(ALLOWED_CHARS).toContain(char);
      }
    }
  });

  it("excludes visually ambiguous characters (0, O, 1, I, L)", () => {
    const ambiguous = ["0", "O", "1", "I", "L"];
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode();
      for (const char of ambiguous) {
        expect(code).not.toContain(char);
      }
    }
  });

  it("generates unique codes across multiple calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    // With 30^8 ≈ 6.5×10^11 possible codes, 100 should all be unique
    expect(codes.size).toBe(100);
  });

  it("returns only uppercase letters and digits", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
    }
  });
});
