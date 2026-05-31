import {
  EARLY_ACCESS_INVITE_TOKEN_PREFIX,
  EARLY_ACCESS_INVITE_TOKEN_TTL_MS,
} from "@stackmatch/constants/invite";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { generateInviteCode } from "../lib/invite_code";

const MAX_TOKEN_GENERATION_ATTEMPTS = 6;

type InvitationRecord = Pick<Doc<"invitations">, "token" | "expiresAt" | "usedAt">;
type WaitlistSignupEligibilityRecord = Pick<
  Doc<"waitlistSignups">,
  "announcementStatus" | "githubHandle"
> | null;

export type RedemptionFailureReason = "invalid_token" | "expired_token" | "used_token";
export type RedemptionResult =
  | { success: true; email: string }
  | { success: false; reason: RedemptionFailureReason };

export type ResendPreparationResult =
  | {
      status: "eligible";
      email: string;
      token: string;
      githubHandle: string;
      referralCode: string;
    }
  | { status: "ineligible" };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAnnouncementEligible(signup: WaitlistSignupEligibilityRecord): boolean {
  return signup?.announcementStatus === "sent";
}

export function isInvitationReusable(invitation: InvitationRecord, now: number): boolean {
  return invitation.expiresAt > now && invitation.usedAt === undefined;
}

export function selectReusableInvitation(
  invitations: InvitationRecord[],
  now: number
): InvitationRecord | null {
  for (const invitation of invitations) {
    if (isInvitationReusable(invitation, now)) {
      return invitation;
    }
  }
  return null;
}

function createInviteToken(): string {
  return `${EARLY_ACCESS_INVITE_TOKEN_PREFIX}${generateInviteCode()}`;
}

/**
 * Pure logic for validating a token redemption.
 */
export function validateRedemption(
  invite: { email: string; expiresAt: number; usedAt?: number } | null,
  now: number
): RedemptionResult {
  if (!invite) {
    return { success: false, reason: "invalid_token" };
  }

  if (invite.usedAt !== undefined) {
    return { success: false, reason: "used_token" };
  }

  if (invite.expiresAt < now) {
    return { success: false, reason: "expired_token" };
  }

  return {
    success: true,
    email: invite.email,
  };
}

/**
 * Redeems an early access invitation token.
 */
export const redeem = mutation({
  args: {
    token: v.string(),
  },
  async handler(ctx, { token }) {
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    const result = validateRedemption(invite, Date.now());

    if (result.success && invite) {
      await ctx.db.patch(invite._id, {
        usedAt: Date.now(),
      });
    }

    return result;
  },
});

async function generateUniqueInviteToken(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < MAX_TOKEN_GENERATION_ATTEMPTS; attempt++) {
    const token = createInviteToken();
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!existing) {
      return token;
    }
  }

  throw new Error("Failed to generate unique invite token");
}

/**
 * Prepares an invite resend by checking waitlist eligibility and creating/reusing a token.
 * Does not send email directly (handled by action layer).
 */
export const requestResend = mutation({
  args: {
    email: v.string(),
  },
  async handler(ctx, { email }): Promise<ResendPreparationResult> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return { status: "ineligible" };
    }

    const waitlistSignup = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", normalizedEmail))
      .unique();

    if (!waitlistSignup || !isAnnouncementEligible(waitlistSignup)) {
      return { status: "ineligible" };
    }

    const now = Date.now();
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();

    const reusable = selectReusableInvitation(invitations, now);
    if (reusable) {
      return {
        status: "eligible",
        email: normalizedEmail,
        token: reusable.token,
        githubHandle: waitlistSignup.githubHandle ?? "developer",
        referralCode: waitlistSignup.referralCode,
      };
    }

    const token = await generateUniqueInviteToken(ctx);
    await ctx.db.insert("invitations", {
      token,
      email: normalizedEmail,
      expiresAt: now + EARLY_ACCESS_INVITE_TOKEN_TTL_MS,
      createdAt: now,
    });

    return {
      status: "eligible",
      email: normalizedEmail,
      token,
      githubHandle: waitlistSignup.githubHandle ?? "developer",
      referralCode: waitlistSignup.referralCode,
    };
  },
});
