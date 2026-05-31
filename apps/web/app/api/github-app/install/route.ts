import { NextResponse } from "next/server";

const NOT_CONFIGURED_STATUS = 501;
const GITHUB_APP_SLUG_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

function resolveGitHubAppInstallUrl(rawValue: string | undefined): string | null {
  const value = rawValue?.trim();
  if (!value) return null;

  if (GITHUB_APP_SLUG_PATTERN.test(value)) {
    return `https://github.com/apps/${value}/installations/new`;
  }

  try {
    const url = new URL(value);
    if (url.hostname !== "github.com") return null;

    const [, appsSegment, slug] = url.pathname.split("/");
    if (appsSegment !== "apps" || !slug || !GITHUB_APP_SLUG_PATTERN.test(slug)) {
      return null;
    }

    return `https://github.com/apps/${slug}/installations/new`;
  } catch {
    return null;
  }
}

export async function GET() {
  const installUrl = resolveGitHubAppInstallUrl(process.env.GITHUB_APP_SLUG);
  if (!installUrl) {
    return NextResponse.json(
      { error: "Stackmatch GitHub App installation is not configured." },
      { status: NOT_CONFIGURED_STATUS }
    );
  }

  return NextResponse.redirect(installUrl);
}
