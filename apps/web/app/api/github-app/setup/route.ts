import { ROUTES } from "@stackmatch/config";
import {
  GITHUB_OWNER_TYPE_ORGANIZATION,
  GITHUB_OWNER_TYPE_USER,
} from "@stackmatch/constants/owner";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchServerAuthMutation, getServerGitHubLogin } from "@/lib/auth/auth-server";
import { buildLoginUrl } from "@/lib/auth/login-url";
import { verifyGitHubAppInstallation } from "@/lib/github/github-app-installation";
import { logger } from "@/lib/re-exports/logger";

const BAD_REQUEST_STATUS = 400;
const ALREADY_SYNCING_MESSAGE = "Private stack sync is already in progress";

function redirectTo(pathname: string, request: Request, searchParams?: Record<string, string>) {
  const url = new URL(pathname, request.url);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function buildSetupReturnTo(url: URL): string {
  const params = new URLSearchParams();
  params.set("installation_id", url.searchParams.get("installation_id") ?? "");

  const setupAction = url.searchParams.get("setup_action");
  if (setupAction) {
    params.set("setup_action", setupAction);
  }

  return `${url.pathname}?${params.toString()}`;
}

function isAuthResolutionError(error: unknown): boolean {
  return error instanceof Error && /Authentication required|sign in|sign out/i.test(error.message);
}

function isAlreadySyncingError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(ALREADY_SYNCING_MESSAGE);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawInstallationId = url.searchParams.get("installation_id");
  const installationId = rawInstallationId ? Number(rawInstallationId) : Number.NaN;

  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid GitHub App installation_id." },
      { status: BAD_REQUEST_STATUS }
    );
  }

  const serverGitHubLogin = await getServerGitHubLogin();
  if (!serverGitHubLogin) {
    return redirectTo(buildLoginUrl(buildSetupReturnTo(url)), request);
  }

  try {
    const installationAccount = await verifyGitHubAppInstallation({
      installationId,
    });

    if (installationAccount.accountType === GITHUB_OWNER_TYPE_ORGANIZATION) {
      const result = await fetchServerAuthMutation(
        api.mutations.organization_claims.claimOrganizationWithGitHubAppInstallation,
        {
          installationId,
          organizationLogin: installationAccount.accountLogin,
        }
      );

      return redirectTo(ROUTES.owner(result.organizationLogin), request, {
        githubApp: "installed",
        orgClaim: "verified",
      });
    }

    if (installationAccount.accountType !== GITHUB_OWNER_TYPE_USER) {
      throw new Error("GitHub App installation account type is not supported.");
    }

    if (installationAccount.accountLogin.toLowerCase() !== serverGitHubLogin.toLowerCase()) {
      throw new Error("GitHub App installation does not belong to the signed-in GitHub user.");
    }

    const result = await fetchServerAuthMutation(
      api.mutations.github_app_installations.linkGitHubAppInstallation,
      {
        installationId,
        accountLogin: installationAccount.accountLogin,
        accountType: installationAccount.accountType,
      }
    );

    try {
      await fetchServerAuthMutation(
        api.mutations.request_private_stack_sync.requestPrivateStackSync,
        {}
      );
      return redirectTo(ROUTES.owner(result.githubLogin), request, {
        githubApp: "installed",
        privateSync: "started",
      });
    } catch (syncError) {
      if (isAlreadySyncingError(syncError)) {
        return redirectTo(ROUTES.owner(result.githubLogin), request, {
          githubApp: "installed",
          privateSync: "already_syncing",
        });
      }

      logger.error("GitHub App private sync start failed", syncError);
      return redirectTo(ROUTES.owner(result.githubLogin), request, {
        githubApp: "installed",
        privateSync: "error",
      });
    }
  } catch (error) {
    logger.error("GitHub App installation link failed", error);

    if (isAuthResolutionError(error)) {
      return redirectTo(buildLoginUrl(buildSetupReturnTo(url)), request);
    }

    return redirectTo(ROUTES.settings.account, request, { githubApp: "error" });
  }
}
