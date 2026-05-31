import { NextResponse } from "next/server";
import { parseDevelopersDirectoryParams } from "@/lib/directory/developers-directory";
import { getDevelopersDirectoryPage } from "@/lib/server/directory/developers-directory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);

  const params = parseDevelopersDirectoryParams({
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit"),
    view: url.searchParams.get("view"),
    sort: url.searchParams.get("sort"),
    q: url.searchParams.get("q"),
  });

  const data = await getDevelopersDirectoryPage(params);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
