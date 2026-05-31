import { NextResponse } from "next/server";
import { parseTopStackersParams } from "@/lib/directory/top-stackers-directory";
import { getTopStackersDirectoryPage } from "@/lib/server/directory/top-stackers-directory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);

  const params = parseTopStackersParams({
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit"),
    sort: url.searchParams.get("sort"),
    q: url.searchParams.get("q"),
  });

  const data = await getTopStackersDirectoryPage(params);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
