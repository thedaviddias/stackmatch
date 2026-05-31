import * as Sentry from "@sentry/nextjs";
import { edgeSentryOptions } from "./lib/re-exports/sentry";

type SentryInitOptions = Parameters<typeof Sentry.init>[0];

Sentry.init(edgeSentryOptions as SentryInitOptions);
