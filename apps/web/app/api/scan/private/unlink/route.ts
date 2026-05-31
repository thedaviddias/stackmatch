import { requireHumanRequest } from "@stackmatch/api/guards";
import { jsonError } from "@stackmatch/api/response";
import { logger } from "@stackmatch/logger";
import { NextResponse } from "next/server";
import { api } from "@/data/api";
import { fetchMutation } from "@/data/server";

export async function POST() {
  const guard = await requireHumanRequest();
  if (!guard.allowed) {
    return guard.response;
  }

  try {
    const result = await fetchMutation(
      api.mutations.unlink_private_stack_data.unlinkPrivateStackData,
      {}
    );
    return NextResponse.json(result);
  } catch (error) {
    logger.error("unlink private stack data failed", error);
    const message = error instanceof Error ? error.message : "Failed to unlink private stack data";
    return jsonError(message, 500);
  }
}
