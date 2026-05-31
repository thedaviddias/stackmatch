import { jsonError } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchServerAuthMutation } from "@/lib/auth/auth-server";

const INTERNAL_SERVER_ERROR_STATUS = 500;

export async function POST() {
  try {
    const result = await fetchServerAuthMutation(
      api.mutations.github_app_installations.disconnectGitHubAppInstallation,
      {}
    );
    return NextResponse.json(result);
  } catch (error) {
    logger.error("GitHub App disconnect failed", error);
    const message = error instanceof Error ? error.message : "Failed to disconnect GitHub App";
    return jsonError(message, INTERNAL_SERVER_ERROR_STATUS);
  }
}
