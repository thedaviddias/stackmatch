import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, OG_PUBLIC_CACHE_CONTROL } from "@stackmatch/constants/og";
import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og/og-fonts";
import { renderStackmatchOgImage } from "@/lib/og/stackmatch-og-image";
import { logger } from "@/lib/re-exports/logger";

export const runtime = "edge";

export async function GET() {
  try {
    return new ImageResponse(
      renderStackmatchOgImage({
        headline: "Find your stackmatch.",
        variant: "global",
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
    logger.error("OG global image generation failed", e);
    return new Response("Failed to generate image", {
      status: 500,
      headers: {
        "cache-control": OG_PUBLIC_CACHE_CONTROL,
      },
    });
  }
}
