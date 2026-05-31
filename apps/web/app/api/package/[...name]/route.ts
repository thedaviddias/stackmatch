import { NextResponse } from "next/server";
import { fetchNpmPackageData } from "@/lib/server/package-data/npm-package-data";

function resolvePackageName(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string[] }> }) {
  const { name } = await params;
  const packageName = resolvePackageName(name);

  if (!packageName) {
    return NextResponse.json({ error: "Package name is required" }, { status: 400 });
  }

  const data = await fetchNpmPackageData(packageName);

  return NextResponse.json(data, {
    headers: {
      // Allow CDN / browser caching for 1 hour, serve stale for 1 day while revalidating
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
