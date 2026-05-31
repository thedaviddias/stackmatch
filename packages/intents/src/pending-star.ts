/**
 * Persists a pending star intent across the OAuth redirect.
 *
 * When an unauthenticated user clicks Star, we save their intent to
 * localStorage before redirecting to `/login`. After sign-in, LoginContent
 * reads it, executes the mutation, and clears it.
 */

const PENDING_STAR_KEY = "stackmatch-pending-star";

export interface PendingStar {
  targetOwner: string;
}

export function savePendingStar(star: PendingStar): void {
  try {
    localStorage.setItem(PENDING_STAR_KEY, JSON.stringify(star));
  } catch {
    // localStorage unavailable (SSR, private browsing, quota exceeded)
  }
}

export function getPendingStar(): PendingStar | null {
  try {
    const raw = localStorage.getItem(PENDING_STAR_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.targetOwner === "string"
    ) {
      return parsed as PendingStar;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingStar(): void {
  try {
    localStorage.removeItem(PENDING_STAR_KEY);
  } catch {
    // localStorage unavailable
  }
}
