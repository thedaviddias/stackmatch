import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "@stackmatch/constants/invite";

/**
 * Generates a short, human-readable invite code.
 *
 * Uses a 30-character alphabet that excludes visually ambiguous characters
 * (0/O, 1/I/L) so codes are easy to read, share, and type correctly.
 * 8 chars from a 30-char alphabet = ~30^8 ≈ 6.5 × 10^11 combinations,
 * more than enough for an invite code system.
 */

export function generateInviteCode(): string {
  const chars = new Array(INVITE_CODE_LENGTH);
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    chars[i] = INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return chars.join("");
}
