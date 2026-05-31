import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, OG_PUBLIC_CACHE_CONTROL } from "@stackmatch/constants/og";
import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og/og-fonts";
import { renderStackmatchOgImage } from "@/lib/og/stackmatch-og-image";
import { logger } from "@/lib/re-exports/logger";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const name = searchParams.get("name");

    if (!owner || !name) {
      return new Response("Missing parameters", {
        status: 400,
        headers: {
          "cache-control": OG_PUBLIC_CACHE_CONTROL,
        },
      });
    }

    return new ImageResponse(
      renderStackmatchOgImage({
        headline: `${name} stack graph.`,
        variant: "repo",
        badge: `${owner}/${name}`,
      }),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        fonts: await loadOgFonts(),
        headers: {
          "cache-control": OG_PUBLIC_CACHE_CONTROL,
        },
      }
    );
  } catch (e) {
    logger.error("OG repo image generation failed", e);
    return new Response("Failed to generate image", {
      status: 500,
      headers: {
        "cache-control": OG_PUBLIC_CACHE_CONTROL,
      },
    });
  }
}
