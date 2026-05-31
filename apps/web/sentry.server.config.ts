import * as Sentry from "@sentry/nextjs";
import { serverSentryOptions } from "./lib/re-exports/sentry";

type SentryInitOptions = Parameters<typeof Sentry.init>[0];

Sentry.init(serverSentryOptions as SentryInitOptions);
