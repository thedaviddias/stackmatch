"use node";

import { sendEmail } from "@stackmatch/email/client";
import { EarlyAccessInviteEmail } from "@stackmatch/email/templates/transactional/early-access-invite";
import { anyApi, type FunctionReference } from "convex/server";
import { v } from "convex/values";
import React from "react";
import { action } from "../_generated/server";
import type { ResendPreparationResult } from "../mutations/invitations";

const EARLY_ACCESS_INVITE_EMAIL_SUBJECT = "Your Stackmatch early access link";

const requestResendMutation = (
  anyApi as unknown as {
    mutations: {
      invitations: {
        requestResend: FunctionReference<"mutation">;
      };
    };
  }
).mutations.invitations.requestResend;

export type InviteResendActionResult = {
  status: "eligible_sent" | "ineligible" | "throttled" | "error";
};

export const run = action({
  args: {
    email: v.string(),
  },
  async handler(ctx, args): Promise<InviteResendActionResult> {
    const prepared = (await ctx.runMutation(requestResendMutation, {
      email: args.email,
    })) as ResendPreparationResult;

    if (prepared.status !== "eligible") {
      return { status: "ineligible" };
    }

    const delivery = await sendEmail({
      to: prepared.email,
      subject: EARLY_ACCESS_INVITE_EMAIL_SUBJECT,
      category: "notification",
      tags: [
        { name: "kind", value: "early-access-invite-resend" },
        { name: "github_handle", value: prepared.githubHandle.slice(0, 64) },
      ],
      react: React.createElement(EarlyAccessInviteEmail, {
        githubHandle: prepared.githubHandle,
        inviteToken: prepared.token,
        referralCode: prepared.referralCode,
      }),
    });

    if (!delivery.success) {
      return { status: "error" };
    }

    return { status: "eligible_sent" };
  },
});
