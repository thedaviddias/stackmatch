import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_PUBLIC_CACHE_CONTROL,
  OG_PUBLIC_USER_PRIVATE_DATA_CACHE_CONTROL,
} from "@stackmatch/constants/og";
import { ImageResponse } from "next/og";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { loadOgFonts } from "@/lib/og/og-fonts";
import { renderUserOgImage } from "@/lib/og/user-og-image";
import { logger } from "@/lib/re-exports/logger";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return new Response("Missing owner", {
        status: 400,
        headers: {
          "cache-control": OG_PUBLIC_CACHE_CONTROL,
        },
      });
    }

    const user = await fetchQuery(api.queries.users.getUserByOwnerWithPublicPrivateData, { owner });

    if (!user) {
      return new ImageResponse(
        renderUserOgImage({
          user: {
            owner,
            avatarUrl: `https://unavatar.io/github/${owner}`,
          },
          displayName: owner,
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
    }

    const cacheControl =
      user.includesPrivateData === true
        ? OG_PUBLIC_USER_PRIVATE_DATA_CACHE_CONTROL
        : OG_PUBLIC_CACHE_CONTROL;

    return new ImageResponse(
      renderUserOgImage({
        user,
        displayName: user.owner,
        includesPrivateData: user.includesPrivateData,
      }),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        fonts: await loadOgFonts(),
        headers: {
          "cache-control": cacheControl,
        },
      }
    );
  } catch (e) {
    logger.error("OG user image generation failed", e);
    return new Response("Failed to generate image", {
      status: 500,
      headers: {
        "cache-control": OG_PUBLIC_CACHE_CONTROL,
      },
    });
  }
}
