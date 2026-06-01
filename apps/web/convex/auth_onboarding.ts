"use node";

import { sendEmail, subscribeContactToTopic } from "@stackmatch/email/client";
import { EMAIL_RESEND_TOPICS } from "@stackmatch/email/keys";
import { WelcomeEmail } from "@stackmatch/email/templates/auth/welcome";
import { v } from "convex/values";
import React from "react";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

const BACKFILL_DEFAULT_LIMIT = 50;
const BACKFILL_MAX_LIMIT = 100;
const BACKFILL_MIN_LIMIT = 1;
const EMAIL_TAG_VALUE_MAX_LENGTH = 64;
const WELCOME_EMAIL_FROM = "David from Stackmatch <hello@mail.stackmatch.dev>";
const WELCOME_EMAIL_REPLY_TO = "hello@stackmatch.dev";
const WELCOME_EMAIL_SUBJECT = "Welcome to Stackmatch";

interface AuthUserBackfillRow {
  _id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  displayUsername?: string | null;
}

function splitName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0];
  if (!firstName) return {};

  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  return { firstName, lastName };
}

function getDisplayName(user: AuthUserBackfillRow): string {
  return user.username ?? user.displayUsername ?? user.name ?? user.email ?? "developer";
}

async function subscribeUserToLoginTopic(user: AuthUserBackfillRow) {
  if (!user.email) {
    return { status: "missing_email" as const };
  }

  const result = await subscribeContactToTopic({
    email: user.email,
    topicId: EMAIL_RESEND_TOPICS.platformLogin,
    ...splitName(getDisplayName(user)),
  });

  if (!result.success) {
    return { status: "error" as const, error: result.error };
  }

  return { status: "subscribed" as const, id: result.id };
}

export const run = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
    githubLogin: v.optional(v.string()),
    sendWelcome: v.boolean(),
  },
  handler: async (_ctx, args) => {
    const nameParts = splitName(args.name);

    const topicResult = await subscribeContactToTopic({
      email: args.email,
      topicId: EMAIL_RESEND_TOPICS.platformLogin,
      ...nameParts,
    });

    if (!topicResult.success) {
      console.error("[authOnboarding] Failed to subscribe contact to Resend topic", {
        email: args.email,
        topicId: EMAIL_RESEND_TOPICS.platformLogin,
        error: topicResult.error,
      });
    }

    if (!args.sendWelcome) {
      return;
    }

    const emailResult = await sendEmail({
      to: args.email,
      subject: WELCOME_EMAIL_SUBJECT,
      category: "transactional",
      from: WELCOME_EMAIL_FROM,
      replyTo: WELCOME_EMAIL_REPLY_TO,
      tags: [
        { name: "kind", value: "platform-login-welcome" },
        {
          name: "github_login",
          value: (args.githubLogin ?? "unknown").slice(0, EMAIL_TAG_VALUE_MAX_LENGTH),
        },
      ],
      react: React.createElement(WelcomeEmail, {
        name: args.name,
      }),
    });

    if (!emailResult.success) {
      console.error("[authOnboarding] Failed to send welcome email", {
        email: args.email,
        error: emailResult.error,
      });
    }
  },
});

export const backfillExistingUsersToResendTopic = internalAction({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { cursor = null, limit, dryRun = false }) => {
    const pageSize = Math.max(
      BACKFILL_MIN_LIMIT,
      Math.min(limit ?? BACKFILL_DEFAULT_LIMIT, BACKFILL_MAX_LIMIT)
    );
    const page = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { cursor, numItems: pageSize },
      select: ["_id", "email", "name", "username", "displayUsername"],
    })) as {
      page: AuthUserBackfillRow[];
      isDone: boolean;
      continueCursor: string;
    };

    const results: Array<{
      authUserId: string;
      email?: string;
      status: "subscribed" | "missing_email" | "error" | "dry_run";
      error?: string;
    }> = [];

    for (const user of page.page) {
      if (!user.email) {
        results.push({ authUserId: user._id, status: "missing_email" });
        continue;
      }

      if (dryRun) {
        results.push({ authUserId: user._id, email: user.email, status: "dry_run" });
        continue;
      }

      const result = await subscribeUserToLoginTopic(user);
      results.push({
        authUserId: user._id,
        email: user.email,
        status: result.status,
        ...(result.status === "error" ? { error: result.error } : {}),
      });
    }

    return {
      dryRun,
      topicId: EMAIL_RESEND_TOPICS.platformLogin,
      isDone: page.isDone,
      continueCursor: page.continueCursor || null,
      subscribed: results.filter((result) => result.status === "subscribed").length,
      missingEmail: results.filter((result) => result.status === "missing_email").length,
      errors: results.filter((result) => result.status === "error").length,
      dryRunCount: results.filter((result) => result.status === "dry_run").length,
      results,
    };
  },
});
