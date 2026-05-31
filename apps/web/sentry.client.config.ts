import * as Sentry from "@sentry/nextjs";
import { clientSentryOptions } from "./lib/re-exports/sentry";

type SentryInitOptions = Parameters<typeof Sentry.init>[0];

Sentry.init(clientSentryOptions as SentryInitOptions);
