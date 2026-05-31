/**
 * Builds the redirect URL after OAuth sign-in.
 *
 * After GitHub OAuth completes, we redirect the user to their profile
 * page (`/{githubLogin}`) instead of the homepage. This gives immediate
 * feedback that auth worked and lets them see their enriched data.
 *
 * Falls back to `/` if the GitHub login is unavailable or invalid. Display
 * names must never become owner URLs.
 */
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export function isValidGitHubLogin(value: string | null | undefined): value is string {
  return Boolean(value && GITHUB_LOGIN_PATTERN.test(value));
}

export function buildProfileRedirectUrl(githubLogin: string | null | undefined): string {
  if (!isValidGitHubLogin(githubLogin)) return "/";
  return `/${encodeURIComponent(githubLogin)}`;
}
