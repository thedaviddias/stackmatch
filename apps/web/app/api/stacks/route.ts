import { NextResponse } from "next/server";
import { parseStacksDirectoryParams } from "@/lib/directory/stacks-directory";
import { getStacksDirectoryPage } from "@/lib/server/directory/stacks-directory";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const params = parseStacksDirectoryParams({
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit"),
    sort: url.searchParams.get("sort"),
    q: url.searchParams.get("q"),
  });

  const data = await getStacksDirectoryPage(params);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
