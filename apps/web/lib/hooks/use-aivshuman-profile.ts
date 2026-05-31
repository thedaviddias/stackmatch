import { DAY_MS, HOUR_MS, SECOND_MS } from "@stackmatch/constants/time";
import { useQuery } from "@tanstack/react-query";

const AIVSHUMAN_CONVEX_SITE_URL = process.env.NEXT_PUBLIC_AIVSHUMAN_CONVEX_SITE_URL ?? "";
const AIVSHUMAN_PROFILE_EXISTS_RETRY_DELAY_MS = 2 * SECOND_MS;

/**
 * Checks whether a GitHub owner has a profile on AI vs Human.
 *
 * Calls the `/api/profile-exists` HTTP endpoint on the AI vs Human
 * Convex deployment. The result is cached for 1 hour (matching the
 * server's Cache-Control header).
 *
 * Returns `{ data: true }` when the profile exists, `{ data: false }`
 * when it does not or when AI vs Human is unreachable (fail-safe).
 * While the initial fetch is in progress, `data` is `undefined`.
 *
 * The hook is a no-op when `NEXT_PUBLIC_AIVSHUMAN_CONVEX_SITE_URL` is
 * unset (safe for CI, tests, and local dev without AI vs Human running).
 */
export function useAiVsHumanProfile(owner: string) {
  return useQuery({
    queryKey: ["aivshuman-profile-exists", owner],
    queryFn: async ({ signal }) => {
      try {
        const res = await fetch(
          `${AIVSHUMAN_CONVEX_SITE_URL}/api/profile-exists?owner=${encodeURIComponent(owner)}`,
          { signal }
        );
        if (!res.ok) return false;
        const data: unknown = await res.json();
        return (
          typeof data === "object" && data !== null && "exists" in data && data.exists === true
        );
      } catch {
        // AI vs Human down or network error — hide link silently
        return false;
      }
    },
    enabled: !!AIVSHUMAN_CONVEX_SITE_URL,
    staleTime: HOUR_MS, // 1 hour — match server Cache-Control
    gcTime: DAY_MS, // keep in garbage collection for 24h
    retry: 1,
    retryDelay: AIVSHUMAN_PROFILE_EXISTS_RETRY_DELAY_MS,
  });
}
