import {
  MAX_INVITE_CODES_PER_USER,
  STACK_SCORE_POINTS_PER_REFERRAL,
} from "@stackmatch/constants/invite";
import { generateInviteCode } from "@stackmatch/security/crypto";
import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";
import { resolveGitHubLogin } from "../lib/auth_helpers";

/**
 * Generate invite codes for the authenticated user.
 *
 * Idempotent: if codes already exist, returns them.
 * Each user gets exactly 3 single-use invite codes.
 */
export const generateMyInviteCodes = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    const login = await resolveGitHubLogin(ctx, user);
    if (!login) throw new ConvexError("Unauthorized");

    // Check for existing codes
    const existing = await ctx.db
      .query("inviteCodes")
      .withIndex("by_owner", (q) => q.eq("ownerLogin", login))
      .collect();

    if (existing.length >= MAX_INVITE_CODES_PER_USER) {
      return existing.map((c) => ({
        code: c.code,
        redeemedBy: c.redeemedBy,
        redeemedAt: c.redeemedAt,
        createdAt: c.createdAt,
      }));
    }

    // Generate new codes (with uniqueness check)
    const now = Date.now();
    const codes = [];

    for (let i = existing.length; i < MAX_INVITE_CODES_PER_USER; i++) {
      let code: string;
      let attempts = 0;

      // Retry loop for uniqueness (collision extremely unlikely with 30^8 space)
      do {
        code = generateInviteCode();
        const dup = await ctx.db
          .query("inviteCodes")
          .withIndex("by_code", (q) => q.eq("code", code))
          .first();
        if (!dup) break;
        attempts++;
      } while (attempts < 5);

      await ctx.db.insert("inviteCodes", {
        ownerLogin: login,
        code,
        createdAt: now,
      });

      codes.push({
        code,
        redeemedBy: undefined,
        redeemedAt: undefined,
        createdAt: now,
      });
    }

    // Return all codes (existing + newly generated)
    return [
      ...existing.map((c) => ({
        code: c.code,
        redeemedBy: c.redeemedBy,
        redeemedAt: c.redeemedAt,
        createdAt: c.createdAt,
      })),
      ...codes,
    ];
  },
});

/**
 * Redeem an invite code during the sign-up flow.
 *
 * Awards +5 Stack Score points to both the referrer and invitee.
 * Validates: code exists, not already used, not self-referral,
 * invitee hasn't already been referred.
 */
export const redeemInviteCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await authComponent.getAuthUser(ctx);
    const inviteeLogin = await resolveGitHubLogin(ctx, user);
    if (!inviteeLogin) throw new ConvexError("Unauthorized");

    // Look up the invite code
    const inviteCode = await ctx.db
      .query("inviteCodes")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();

    if (!inviteCode) {
      throw new ConvexError("Invalid invite code");
    }

    if (inviteCode.redeemedBy) {
      throw new ConvexError("This invite code has already been used");
    }

    if (inviteCode.ownerLogin === inviteeLogin) {
      throw new ConvexError("You cannot use your own invite code");
    }

    // Check invitee hasn't already been referred
    const inviteeProfile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", inviteeLogin))
      .unique();

    if (inviteeProfile?.referredBy) {
      throw new ConvexError("You have already been referred");
    }

    // Mark code as redeemed
    await ctx.db.patch(inviteCode._id, {
      redeemedBy: inviteeLogin,
      redeemedAt: Date.now(),
    });

    // Award points to referrer
    const referrerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", inviteCode.ownerLogin))
      .unique();

    if (referrerProfile) {
      await ctx.db.patch(referrerProfile._id, {
        referralPoints: (referrerProfile.referralPoints ?? 0) + STACK_SCORE_POINTS_PER_REFERRAL,
      });
    }

    // Award points to invitee
    if (inviteeProfile) {
      await ctx.db.patch(inviteeProfile._id, {
        referredBy: inviteCode.ownerLogin,
        referralPoints: (inviteeProfile.referralPoints ?? 0) + STACK_SCORE_POINTS_PER_REFERRAL,
      });
    }

    return {
      success: true,
      referrerOwner: inviteCode.ownerLogin,
    };
  },
});
