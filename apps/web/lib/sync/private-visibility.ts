/**
 * Determines whether private data should be visible to the current viewer.
 *
 * Decision tree:
 *
 *   No private data?                → false (nothing to show)
 *   Owner viewing own profile?      → true  (always sees their data)
 *   showPrivateDataPublicly = true?  → true  (user opted in)
 *   showPrivateDataPublicly = undef? → false (private by default)
 *   showPrivateDataPublicly = false? → false (user opted out)
 *
 * The key design choice: `undefined` (field not set) is treated as `false`
 * so linking private repositories does not expose private-derived aggregate
 * data publicly unless the user explicitly opts in.
 */

interface PrivateVisibilityInput {
  isOwnProfile: boolean;
  hasPrivateData: boolean;
  /** undefined = default to false (private) */
  showPrivateDataPublicly?: boolean;
}

export function shouldShowPrivateData({
  isOwnProfile,
  hasPrivateData,
  showPrivateDataPublicly,
}: PrivateVisibilityInput): boolean {
  // Nothing to show if no private data exists
  if (!hasPrivateData) return false;

  // Owner always sees their own data regardless of the toggle
  if (isOwnProfile) return true;

  // For visitors: private-derived aggregate data is public only by explicit opt-in.
  return showPrivateDataPublicly === true;
}
