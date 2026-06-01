import { ApiRequestError } from "@/lib/post-json";
import { logger } from "@/lib/re-exports/logger";

type UserActionErrorContext = Record<string, unknown>;

export function captureUserActionError(
  action: string,
  error: unknown,
  context?: UserActionErrorContext
) {
  const requestContext =
    error instanceof ApiRequestError
      ? {
          status: error.status,
          apiError: error.payload?.error,
          retryAfterSeconds: error.retryAfterSeconds,
        }
      : undefined;

  logger.error(`[UserAction] ${action}`, error, {
    ...requestContext,
    ...context,
  });
}
