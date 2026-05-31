/**
 * Persists a pending referral code across the OAuth redirect.
 *
 * When a user clicks an invite link (`/invite/[code]`), we save the code
 * to localStorage before redirecting to `/login`. After sign-in,
 * LoginContent reads it, calls the redeem mutation, and clears it.
 *
 * Mirrors the same pattern as `pending-star.ts`.
 */

const PENDING_REFERRAL_KEY = "stackmatch-pending-referral";

export interface PendingReferral {
  code: string;
}

export function savePendingReferral(code: string): void {
  try {
    localStorage.setItem(PENDING_REFERRAL_KEY, JSON.stringify({ code }));
  } catch {
    // localStorage unavailable (SSR, private browsing, quota exceeded)
  }
}

export function getPendingReferral(): PendingReferral | null {
  try {
    const raw = localStorage.getItem(PENDING_REFERRAL_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.code === "string" &&
      parsed.code.length > 0
    ) {
      return parsed as PendingReferral;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    // localStorage unavailable
  }
}
