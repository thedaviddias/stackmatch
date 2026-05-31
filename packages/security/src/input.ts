export type ParsedInput =
  | { type: "repo"; owner: string; name: string }
  | { type: "user"; owner: string };

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;
const GITHUB_REPO_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

function parseGitHubUrlInput(input: string): ParsedInput | null {
  const hasProtocol = /^https?:\/\//i.test(input);
  const maybeUrl = hasProtocol ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(maybeUrl);
  } catch {
    return null;
  }

  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  const [owner = "", repo = ""] = url.pathname.split("/").filter(Boolean);
  if (!owner || !isValidGitHubUsername(owner)) {
    return null;
  }

  if (!repo) {
    return { type: "user", owner };
  }

  if (!isValidRepoName(repo)) {
    return null;
  }

  return { type: "repo", owner, name: repo };
}

export function parseRepoInput(input: string): ParsedInput | null {
  const trimmed = input.trim().replace(/\/+$/, "");

  const githubUrlInput = parseGitHubUrlInput(trimmed);
  if (githubUrlInput) {
    return githubUrlInput;
  }

  // Try "owner/repo" format
  const slashMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slashMatch) {
    return { type: "repo", owner: slashMatch[1] ?? "", name: slashMatch[2] ?? "" };
  }

  // Try plain username (single word, valid GitHub username chars)
  if (isValidGitHubUsername(trimmed)) {
    return { type: "user", owner: trimmed };
  }

  return null;
}

export function normalizeGitHubOwnerInput(input: string): string | null {
  return parseRepoInput(input)?.owner ?? null;
}

export function sanitizeString(input: string, maxLength?: number): string {
  // Strip control characters (except common whitespace: \t \n \r)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control chars for sanitization
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  if (maxLength !== undefined && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

export function isValidGitHubUsername(input: string): boolean {
  return GITHUB_USERNAME_PATTERN.test(input) && input.length <= 39;
}

export function isValidRepoName(input: string): boolean {
  return GITHUB_REPO_NAME_PATTERN.test(input) && input.length <= 100;
}
