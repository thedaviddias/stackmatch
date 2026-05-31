import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_PRIVATE_CACHE_CONTROL,
} from "@stackmatch/constants/og";
import { ImageResponse } from "next/og";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { loadOgFonts } from "@/lib/og/og-fonts";
import { renderUserOgImage } from "@/lib/og/user-og-image";
import { logger } from "@/lib/re-exports/logger";

export const runtime = "edge";

/**
 * Private OG image route: generates a user card that includes
 * both public AND private repo activity merged together.
 *
 * Used by the profile owner to download/copy a card with their full
 * activity for personal sharing on social media.
 *
 * Security note: this route returns only aggregate numbers (commit
 * counts and percentages) — no repo names, code, or commit messages.
 * The privacy toggle on the profile page controls what visitors see
 * in the browser, not what this image endpoint returns.
 *
 * Cache: private, no-store — private images must never be CDN-cached.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return new Response("Missing owner", {
        status: 400,
        headers: {
          "cache-control": OG_PRIVATE_CACHE_CONTROL,
        },
      });
    }

    const user = await fetchQuery(api.queries.users.getUserByOwnerWithPrivateData, { owner });

    if (!user) {
      return new ImageResponse(
        renderUserOgImage({
          user: {
            owner,
            avatarUrl: `https://unavatar.io/github/${owner}`,
          },
          displayName: owner,
          includesPrivateData: true,
        }),
        {
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          fonts: await loadOgFonts(),
          headers: {
            "cache-control": OG_PRIVATE_CACHE_CONTROL,
          },
        }
      );
    }

    return new ImageResponse(
      renderUserOgImage({ user, displayName: user.owner, includesPrivateData: true }),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        fonts: await loadOgFonts(),
        headers: {
          "cache-control": OG_PRIVATE_CACHE_CONTROL,
        },
      }
    );
  } catch (e) {
    logger.error("Private OG user image generation failed", e);
    return new Response("Failed to generate image", {
      status: 500,
      headers: {
        "cache-control": OG_PRIVATE_CACHE_CONTROL,
      },
    });
  }
}
