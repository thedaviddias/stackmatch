"use node";

import { sendEmail } from "@stackmatch/email/client";
import { WaitlistConfirmationEmail } from "@stackmatch/email/templates/transactional/waitlist-confirmation";
import { v } from "convex/values";
import React from "react";
import { internalAction } from "../_generated/server";

/**
 * Send a waitlist confirmation email to a newly-signed-up user.
 * Scheduled by the upsertWaitlistSignup mutation immediately after insert.
 * Failures are logged but never surface to the caller — email delivery is
 * best-effort and must not block or roll back the signup.
 */
export const sendWaitlistConfirmation = internalAction({
  args: {
    email: v.string(),
    githubHandle: v.string(),
    memberNumber: v.number(),
    referralCode: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await sendEmail({
      to: args.email,
      subject: "You're on the list — stackmatch.dev",
      category: "transactional",
      tags: [{ name: "kind", value: "waitlist-confirmation" }],
      react: React.createElement(WaitlistConfirmationEmail, {
        githubHandle: args.githubHandle,
        memberNumber: args.memberNumber,
        referralCode: args.referralCode,
      }),
    });

    if (!result.success) {
      console.error("[sendWaitlistConfirmation] Failed to send confirmation email", {
        email: args.email,
        error: result.error,
      });
    }
  },
});
