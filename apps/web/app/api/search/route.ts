import { NextResponse } from "next/server";
import { getTrending, searchGlobal } from "@/lib/server/directory/search-directory";

const SEARCH_QUERY_MAX_LENGTH = 100;
const SEARCH_DEFAULT_LIMIT = 5;
const SEARCH_MIN_LIMIT = 1;
const SEARCH_MAX_LIMIT = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, SEARCH_QUERY_MAX_LENGTH);

  const limitParam = Number.parseInt(
    url.searchParams.get("limit") ?? String(SEARCH_DEFAULT_LIMIT),
    10
  );
  const limit = Number.isFinite(limitParam)
    ? Math.min(SEARCH_MAX_LIMIT, Math.max(SEARCH_MIN_LIMIT, limitParam))
    : SEARCH_DEFAULT_LIMIT;

  // Empty query → return trending data
  if (!q) {
    const trending = await getTrending(limit);
    return NextResponse.json(
      { query: "", packages: [], users: [], languages: [], topics: [], trending },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const data = await searchGlobal(q, limit);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
