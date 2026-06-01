const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GITHUB_UNAUTHORIZED_STATUS = 401;
const GITHUB_FORBIDDEN_STATUS = 403;
const GITHUB_AUTH_RETRY_STATUS_CODES = new Set([
  GITHUB_UNAUTHORIZED_STATUS,
  GITHUB_FORBIDDEN_STATUS,
]);

function buildGitHubUserLookupHeaders(includeAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "stackmatch",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };

  if (includeAuth && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchGitHubUser(githubUserId: string, includeAuth: boolean) {
  return await fetch(`https://api.github.com/user/${githubUserId}`, {
    headers: buildGitHubUserLookupHeaders(includeAuth),
  });
}

export async function fetchGitHubLoginByUserId(githubUserId: string): Promise<string | null> {
  let response = await fetchGitHubUser(githubUserId, true);
  if (
    !response.ok &&
    process.env.GITHUB_TOKEN &&
    GITHUB_AUTH_RETRY_STATUS_CODES.has(response.status)
  ) {
    response = await fetchGitHubUser(githubUserId, false);
  }
  if (!response.ok) return null;

  const data = (await response.json()) as { id?: unknown; login?: unknown };
  if (String(data.id) !== githubUserId) return null;
  if (typeof data.login !== "string" || !GITHUB_LOGIN_PATTERN.test(data.login)) return null;
  return data.login;
}
