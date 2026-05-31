import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { type MutationCtx, mutation } from "../_generated/server";

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function normalizeWaitlistEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeGithubHandle(githubHandle?: string) {
  return githubHandle?.trim().replace(/^@/, "");
}

function isValidGithubHandle(githubHandle: string) {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(githubHandle);
}

async function assertGithubHandleAvailability(
  ctx: MutationCtx,
  normalizedGithubHandle: string | undefined,
  normalizedEmail: string
) {
  if (!normalizedGithubHandle) return;

  const existingWithGithub = await ctx.db
    .query("waitlistSignups")
    .withIndex("by_normalizedGithubHandle", (q) =>
      q.eq("normalizedGithubHandle", normalizedGithubHandle)
    )
    .first();

  if (existingWithGithub && existingWithGithub.normalizedEmail !== normalizedEmail) {
    throw new Error("This GitHub handle is already associated with another waitlist entry.");
  }
}

async function calculateWaitlistRank(ctx: MutationCtx, referredCount: number, createdAt: number) {
  const higherReferrals = await ctx.db
    .query("waitlistSignups")
    .withIndex("by_referredCount", (q) => q.gt("referredCount", referredCount))
    .collect();

  const sameReferralsEarlier = await ctx.db
    .query("waitlistSignups")
    .withIndex("by_referredCount_createdAt", (q) =>
      q.eq("referredCount", referredCount).lt("createdAt", createdAt)
    )
    .collect();

  return higherReferrals.length + sameReferralsEarlier.length + 1;
}

async function scheduleUserAnalysis(
  ctx: MutationCtx,
  githubHandle: string | undefined,
  analyzeApiKey: string | undefined,
  shouldScheduleAnalysis: boolean
) {
  if (!shouldScheduleAnalysis || !githubHandle || !analyzeApiKey) return;

  await ctx.scheduler.runAfter(0, api.mutations.request_user_analysis.requestUserAnalysis, {
    repos: [{ owner: githubHandle, name: githubHandle }],
    apiKey: analyzeApiKey,
  });
}

async function maybeCreditReferrer(
  ctx: MutationCtx,
  referredBy: string | undefined,
  normalizedEmail: string,
  ipHash: string | undefined
) {
  if (!referredBy) return;

  const referrer = await ctx.db
    .query("waitlistSignups")
    .withIndex("by_referralCode", (q) => q.eq("referralCode", referredBy))
    .unique();

  if (!referrer || referrer.normalizedEmail === normalizedEmail) {
    return;
  }

  if (ipHash && referrer.ipHash === ipHash) {
    console.warn(`Blocked self-referral attempt for IP: ${ipHash}`);
    return;
  }

  await ctx.db.patch(referrer._id, {
    referredCount: referrer.referredCount + 1,
  });
}

export const upsertWaitlistSignup = mutation({
  args: {
    email: v.string(),
    githubHandle: v.optional(v.string()),
    source: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    referredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeWaitlistEmail(args.email);
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    const now = Date.now();
    const source = args.source?.trim() || "waitlist";
    const githubHandle = normalizeGithubHandle(args.githubHandle);

    if (githubHandle && !isValidGithubHandle(githubHandle)) {
      throw new Error("Invalid GitHub username format");
    }

    const normalizedGithubHandle = githubHandle?.toLowerCase();
    await assertGithubHandleAvailability(ctx, normalizedGithubHandle, normalizedEmail);

    const analyzeApiKey = process.env.ANALYZE_API_KEY?.trim();

    const existing = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", normalizedEmail))
      .unique();

    const shouldScheduleAnalysis =
      Boolean(githubHandle) &&
      Boolean(analyzeApiKey) &&
      (!existing || existing.githubHandle !== githubHandle);

    if (existing) {
      const shouldResetFailedAnnouncement = existing.announcementStatus === "failed";
      await ctx.db.patch(existing._id, {
        updatedAt: now,
        source,
        githubHandle: githubHandle || existing.githubHandle,
        normalizedGithubHandle: normalizedGithubHandle || existing.normalizedGithubHandle,
        ipHash: args.ipHash ?? existing.ipHash,
        submissionCount: existing.submissionCount + 1,
        ...(existing.announcementStatus
          ? {}
          : { announcementStatus: "pending" as const, announcementAttempts: 0 }),
        ...(shouldResetFailedAnnouncement
          ? {
              announcementStatus: "pending" as const,
              announcementAttempts: 0,
              announcementLockUntil: undefined,
              announcementLastError: undefined,
              announcementMessageId: undefined,
            }
          : {}),
      });

      const rank = await calculateWaitlistRank(ctx, existing.referredCount, existing.createdAt);
      await scheduleUserAnalysis(ctx, githubHandle, analyzeApiKey, shouldScheduleAnalysis);

      return {
        status: "existing" as const,
        memberNumber: rank,
        referralCode: existing.referralCode,
        githubHandle: githubHandle || existing.githubHandle,
        referredCount: existing.referredCount,
      };
    }

    // Generate a unique code (simple collision check)
    let code = generateReferralCode();
    while (
      await ctx.db
        .query("waitlistSignups")
        .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
        .unique()
    ) {
      code = generateReferralCode();
    }

    await ctx.db.insert("waitlistSignups", {
      email: normalizedEmail,
      normalizedEmail,
      githubHandle,
      normalizedGithubHandle,
      source,
      ipHash: args.ipHash,
      submissionCount: 1,
      referralCode: code,
      referredCount: 0,
      announcementStatus: "pending",
      announcementAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });

    await maybeCreditReferrer(ctx, args.referredBy, normalizedEmail, args.ipHash);
    await scheduleUserAnalysis(ctx, githubHandle, analyzeApiKey, shouldScheduleAnalysis);

    // New signups have 0 referrals, so their rank is just based on total count
    const totalSignups = await ctx.db.query("waitlistSignups").collect();
    const memberNumber = totalSignups.length;

    // Send confirmation email — best-effort, never blocks signup
    if (githubHandle) {
      await ctx.scheduler.runAfter(
        0,
        internal.waitlist.send_confirmation.sendWaitlistConfirmation,
        {
          email: normalizedEmail,
          githubHandle,
          memberNumber,
          referralCode: code,
        }
      );
    }

    return {
      status: "created" as const,
      memberNumber,
      referralCode: code,
      githubHandle,
      referredCount: 0,
    };
  },
});
