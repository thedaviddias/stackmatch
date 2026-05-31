import { createSign } from "node:crypto";
import {
  GITHUB_API_VERSION,
  GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
  GITHUB_APP_JWT_TTL_SECONDS,
  GITHUB_JSON_ACCEPT,
} from "@stackmatch/constants/sync";
import { SECOND_MS } from "@stackmatch/constants/time";

const NOT_FOUND_STATUS = 404;

interface GitHubInstallationAccount {
  login?: unknown;
  type?: unknown;
}

interface GitHubInstallationResponse {
  account?: GitHubInstallationAccount | null;
}

export interface VerifiedGitHubAppInstallation {
  accountLogin: string;
  accountType: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for GitHub App installation verification.`);
  }
  return value;
}

function getGitHubAppPrivateKey(): string {
  return requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createGitHubAppJwt(): string {
  const nowSeconds = Math.floor(Date.now() / SECOND_MS);
  const payload = {
    iat: nowSeconds - GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
    exp: nowSeconds + GITHUB_APP_JWT_TTL_SECONDS,
    iss: requireEnv("GITHUB_APP_ID"),
  };
  const unsignedToken = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(getGitHubAppPrivateKey()).toString("base64url");
  return `${unsignedToken}.${signature}`;
}

export async function verifyGitHubAppInstallationForLogin({
  installationId,
  githubLogin,
}: {
  installationId: number;
  githubLogin: string;
}): Promise<VerifiedGitHubAppInstallation> {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${createGitHubAppJwt()}`,
      Accept: GITHUB_JSON_ACCEPT,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
  });

  if (response.status === NOT_FOUND_STATUS) {
    throw new Error("GitHub App installation was not found for this Stackmatch app.");
  }
  if (!response.ok) {
    throw new Error(`Failed to verify GitHub App installation: ${response.status}`);
  }

  const installation = (await response.json()) as GitHubInstallationResponse;
  const accountLogin = installation.account?.login;
  const accountType = installation.account?.type;

  if (typeof accountLogin !== "string" || typeof accountType !== "string") {
    throw new Error("GitHub App installation response did not include an account.");
  }

  if (accountType !== "User") {
    throw new Error("Organization GitHub App installations are not supported yet.");
  }

  if (accountLogin.toLowerCase() !== githubLogin.toLowerCase()) {
    throw new Error("GitHub App installation does not belong to the signed-in GitHub user.");
  }

  return { accountLogin, accountType };
}
