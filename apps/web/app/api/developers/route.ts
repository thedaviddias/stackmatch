import { NextResponse } from "next/server";
import { parseDevelopersDirectoryParams } from "@/lib/directory/developers-directory";
import { getDevelopersDirectoryPage } from "@/lib/server/directory/developers-directory";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const params = parseDevelopersDirectoryParams({
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit"),
    sort: url.searchParams.get("sort"),
    q: url.searchParams.get("q"),
  });

  const data = await getDevelopersDirectoryPage(params);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
