import {
  PROFILE_REPORT_REASON_HARASSMENT,
  PROFILE_REPORT_REASON_IMPERSONATION,
  PROFILE_REPORT_REASON_INAPPROPRIATE,
  PROFILE_REPORT_REASON_OTHER,
  PROFILE_REPORT_REASON_SPAM,
  PROFILE_REPORT_REASON_SUSPICIOUS,
  PROFILE_REPORT_STATUS_ACTIONED,
  PROFILE_REPORT_STATUS_DISMISSED,
  PROFILE_REPORT_STATUS_PENDING,
  PROFILE_REPORT_STATUS_REVIEWING,
} from "@stackmatch/constants/moderation";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { classificationValidator } from "./lib/validators";

export default defineSchema({
  repos: defineTable({
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    description: v.optional(v.string()),
    stars: v.optional(v.number()),
    language: v.optional(v.string()), // Primary language by bytes (GitHub Linguist)
    topics: v.optional(v.array(v.string())), // User-applied repo topics (e.g. ["nextjs", "react"])
    defaultBranch: v.string(),
    githubId: v.number(),
    syncStatus: v.union(
      v.literal("pending"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("error"),
      v.literal("queued") // Delayed due to rate limits
    ),
    syncError: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    totalCommitsFetched: v.optional(v.number()),
    syncCursor: v.optional(v.string()),
    // Progress tracking — updated during sync pipeline
    syncStage: v.optional(v.string()), // "fetching_commits" | "enriching_loc" | "classifying_prs" | "computing_stats"
    syncCommitsFetched: v.optional(v.number()), // running count, updated per page of 100 commits
    syncLastProgressAt: v.optional(v.number()), // heartbeat used to detect interrupted sync work
    syncPipeline: v.optional(v.union(v.literal("github"), v.literal("stack"))),
    requestedAt: v.number(),
    pushedAt: v.optional(v.number()), // GitHub pushed_at timestamp — used to order sync queue (latest first)
    scannedPackageCount: v.optional(v.number()),
    scannedManifestCount: v.optional(v.number()),
    packageManifestFingerprint: v.optional(v.string()),
    packageManifestFingerprintComputedAt: v.optional(v.number()),
    // Granular tool/bot breakdown — computed during sync while commits exist, persisted after cleanup
    toolBreakdown: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          commits: v.number(),
          additions: v.number(),
        })
      )
    ),
    botBreakdown: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          commits: v.number(),
        })
      )
    ),
    prAttribution: v.optional(
      v.object({
        totalCommits: v.number(),
        aiCommits: v.number(),
        automationCommits: v.number(),
        breakdown: v.array(
          v.object({
            key: v.string(),
            label: v.string(),
            lane: v.union(v.literal("ai"), v.literal("automation")),
            commits: v.number(),
          })
        ),
        computedAt: v.number(),
      })
    ),
    aiConfigs: v.optional(
      v.array(
        v.object({
          tool: v.string(), // "Cursor", "Claude", "skills.sh", "Copilot", "Windsurf", "Aider", "Roo Code", "Sweep", "CodeRabbit", "MutableAI"
          type: v.string(), // "Rule File", "Skill", "Config"
          name: v.string(), // "geo-aeo-optimization", ".cursorrules", "CLAUDE.md"
        })
      )
    ),
    // Rate-limit optimization fields
    etag: v.optional(v.string()), // GitHub ETag for conditional requests (304 = free)
    aiConfigsLastCheckedAt: v.optional(v.number()), // Skip tree traversal if recently checked
    isExcluded: v.optional(v.boolean()), // Manually excluded from stack fingerprint
  })
    .index("by_fullName", ["fullName"])
    .index("by_owner", ["owner"])
    .index("by_owner_syncStatus", ["owner", "syncStatus"])
    .index("by_syncStatus", ["syncStatus"])
    .index("by_githubId", ["githubId"]),

  // Cached PR metadata — avoids re-fetching unchanged PRs on every resync
  prMetadata: defineTable({
    repoId: v.id("repos"),
    prNumber: v.number(),
    authorLogin: v.string(),
    authorType: v.string(), // "User" | "Bot" | "Organization"
    body: v.optional(v.string()), // Truncated to first 500 chars for pattern matching
    branchName: v.optional(v.string()),
    labels: v.array(v.string()),
    fetchedAt: v.number(),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_pr", ["repoId", "prNumber"]),

  commits: defineTable({
    repoId: v.id("repos"),
    sha: v.string(),
    message: v.string(),
    fullMessage: v.optional(v.string()),
    authoredAt: v.number(),
    committedAt: v.number(),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    authorGithubUserId: v.optional(v.number()),
    authorLogin: v.optional(v.string()),
    authorType: v.optional(v.string()),
    committerName: v.optional(v.string()),
    committerEmail: v.optional(v.string()),
    classification: classificationValidator,
    coAuthors: v.optional(v.array(v.string())),
    additions: v.optional(v.number()),
    deletions: v.optional(v.number()),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_date", ["repoId", "authoredAt"])
    .index("by_sha", ["sha"])
    .index("by_repo_and_classification", ["repoId", "classification"]),

  repoWeeklyStats: defineTable({
    repoId: v.id("repos"),
    weekStart: v.number(),
    weekLabel: v.string(),
    human: v.number(),
    dependabot: v.number(),
    renovate: v.number(),
    copilot: v.number(),
    claude: v.number(),
    cursor: v.optional(v.number()),
    aider: v.optional(v.number()),
    devin: v.optional(v.number()),
    openaiCodex: v.optional(v.number()),
    gemini: v.optional(v.number()),
    githubActions: v.number(),
    otherBot: v.number(),
    aiAssisted: v.number(),
    total: v.number(),
    // LOC (lines of code) per classification — additions only
    humanAdditions: v.optional(v.number()),
    copilotAdditions: v.optional(v.number()),
    claudeAdditions: v.optional(v.number()),
    cursorAdditions: v.optional(v.number()),
    aiderAdditions: v.optional(v.number()),
    devinAdditions: v.optional(v.number()),
    openaiCodexAdditions: v.optional(v.number()),
    geminiAdditions: v.optional(v.number()),
    aiAssistedAdditions: v.optional(v.number()),
    totalAdditions: v.optional(v.number()),
    totalDeletions: v.optional(v.number()),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_week", ["repoId", "weekStart"]),

  repoContributorStats: defineTable({
    repoId: v.id("repos"),
    login: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    classification: v.string(),
    commitCount: v.number(),
    additions: v.optional(v.number()),
    deletions: v.optional(v.number()),
    firstCommitAt: v.number(),
    lastCommitAt: v.number(),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_commits", ["repoId", "commitCount"])
    .index("by_email", ["email"]),

  globalWeeklyStats: defineTable({
    weekStart: v.number(),
    weekLabel: v.string(),
    human: v.number(),
    dependabot: v.number(),
    renovate: v.number(),
    copilot: v.number(),
    claude: v.number(),
    cursor: v.optional(v.number()),
    aider: v.optional(v.number()),
    devin: v.optional(v.number()),
    openaiCodex: v.optional(v.number()),
    gemini: v.optional(v.number()),
    githubActions: v.number(),
    otherBot: v.number(),
    aiAssisted: v.number(),
    total: v.number(),
    repoCount: v.number(),
    // LOC (lines of code) per classification — additions only
    humanAdditions: v.optional(v.number()),
    copilotAdditions: v.optional(v.number()),
    claudeAdditions: v.optional(v.number()),
    cursorAdditions: v.optional(v.number()),
    aiderAdditions: v.optional(v.number()),
    devinAdditions: v.optional(v.number()),
    openaiCodexAdditions: v.optional(v.number()),
    geminiAdditions: v.optional(v.number()),
    aiAssistedAdditions: v.optional(v.number()),
    totalAdditions: v.optional(v.number()),
    totalDeletions: v.optional(v.number()),
  }).index("by_week", ["weekStart"]),

  repoDailyStats: defineTable({
    repoId: v.id("repos"),
    date: v.number(), // epoch ms, midnight UTC
    human: v.number(),
    ai: v.number(),
    automation: v.optional(v.number()),
    humanAdditions: v.number(),
    aiAdditions: v.number(),
    automationAdditions: v.optional(v.number()),
  })
    .index("by_repo", ["repoId"])
    .index("by_repo_and_date", ["repoId", "date"]),

  globalDailyStats: defineTable({
    date: v.number(), // epoch ms, midnight UTC
    human: v.number(),
    ai: v.number(),
    automation: v.optional(v.number()),
    humanAdditions: v.number(),
    aiAdditions: v.number(),
    automationAdditions: v.optional(v.number()),
    repoCount: v.number(),
  }).index("by_date", ["date"]),

  rateLimits: defineTable({
    ipHash: v.string(),
    date: v.string(),
    requestCount: v.number(),
  }).index("by_ip_and_date", ["ipHash", "date"]),

  waitlistSignups: defineTable({
    email: v.string(),
    normalizedEmail: v.string(),
    githubHandle: v.optional(v.string()), // GitHub username for ticket personalization
    normalizedGithubHandle: v.optional(v.string()),
    source: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    submissionCount: v.number(),
    referralCode: v.string(), // Unique code for sharing
    referredCount: v.number(), // Number of successful signups via this code
    announcementStatus: v.optional(
      v.union(v.literal("pending"), v.literal("sending"), v.literal("sent"), v.literal("failed"))
    ),
    announcementAttempts: v.optional(v.number()),
    announcementLockUntil: v.optional(v.number()),
    announcementMessageId: v.optional(v.string()),
    announcementLastError: v.optional(v.string()),
    announcedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_normalizedEmail", ["normalizedEmail"])
    .index("by_referralCode", ["referralCode"])
    .index("by_referredCount", ["referredCount"])
    .index("by_referredCount_createdAt", ["referredCount", "createdAt"])
    .index("by_announcementStatus_createdAt", ["announcementStatus", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_normalizedGithubHandle", ["normalizedGithubHandle"]),

  resyncRateLimits: defineTable({
    owner: v.string(),
    ipHash: v.string(),
    lastResyncAt: v.number(),
    dayKey: v.string(),
    dayCount: v.number(),
  }).index("by_owner_ip", ["owner", "ipHash"]),

  scanSubmissions: defineTable({
    owner: v.string(),
    repoFullNames: v.array(v.string()),
    repoCount: v.number(),
    submittedByAuthUserId: v.string(),
    submittedByGitHubLogin: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_submitter_createdAt", ["submittedByAuthUserId", "createdAt"])
    .index("by_owner_createdAt", ["owner", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  repoResyncRateLimits: defineTable({
    repoFullName: v.string(),
    ipHash: v.string(),
    lastResyncAt: v.number(),
    dayKey: v.string(),
    dayCount: v.number(),
  }).index("by_repo_ip", ["repoFullName", "ipHash"]),

  userPresence: defineTable({
    ownerLower: v.string(),
    lastActiveAt: v.number(),
  })
    .index("by_ownerLower", ["ownerLower"])
    .index("by_lastActiveAt", ["lastActiveAt"]),

  profiles: defineTable({
    owner: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.string(),
    bio: v.optional(v.string()),
    website: v.optional(v.string()),
    x: v.optional(v.string()),
    /** @deprecated Use `x` instead. Kept for backward compatibility with existing data. */
    twitter: v.optional(v.string()),
    location: v.optional(v.string()),
    company: v.optional(v.string()),
    followers: v.number(),
    lastUpdated: v.number(),
    ownerType: v.optional(
      v.union(
        v.literal("developer"),
        v.literal("organization"),
        v.literal("bot"),
        v.literal("maintainer")
      )
    ),
    isClaimed: v.optional(v.boolean()),
    hasPrivateData: v.optional(v.boolean()),
    /**
     * Visibility status:
     * - "public" (default): Visible in matching and leaderboards.
     * - "private" (Ghost Mode): Visible if searched directly, but hidden from discovery/matching.
     * - "hidden": Completely unqueriable by other users.
     */
    visibility: v.optional(v.string()),
    /** Whether private-derived aggregate data is visible to public visitors. undefined = private. */
    showPrivateDataPublicly: v.optional(v.boolean()),
    /** Login of the user who referred this person (via invite code). */
    referredBy: v.optional(v.string()),
    /** Accumulated referral bonus points (+5 per successful referral). */
    referralPoints: v.optional(v.number()),
    /** Timestamp when this GitHub owner first claimed their StackMatch profile. */
    claimedAt: v.optional(v.number()),
    /** Sequential join number (Genesis Rank). Assigned on profile creation/claim. */
    memberNumber: v.optional(v.number()),
    // New fields for package usage summary
    totalUniquePackages: v.optional(v.number()),
    topPackages: v.optional(v.array(v.string())), // e.g., ["react", "next", "tailwind"]
    /** Lowercased primary languages across synced repos (e.g. ["typescript", "python"]). */
    topLanguages: v.optional(v.array(v.string())),
    /** GitHub topics across synced repos (e.g. ["nextjs", "react", "supabase"]). */
    topTopics: v.optional(v.array(v.string())),
    /** Number of times this profile appeared in others' match results. Used for Wilson scoring. */
    impressionCount: v.optional(v.number()),
    /** Cached Stack Score for ranking. Recomputed when profile data changes. */
    stackScore: v.optional(v.number()),
    /** Cached StackMatch followers count. Backfilled lazily for legacy profiles. */
    followersCount: v.optional(v.number()),
    /** Cached StackMatch following count. Backfilled lazily for legacy profiles. */
    followingCount: v.optional(v.number()),
    /** Cached all-time weekly star events received. Backfilled lazily for legacy profiles. */
    starsReceivedCount: v.optional(v.number()),
    /** Structured location: normalized city name (user-selected or auto-parsed). */
    locationCity: v.optional(v.string()),
    /** Structured location: ISO 3166-1 alpha-2 country code (user-selected or auto-parsed). */
    locationCountryCode: v.optional(v.string()),
  })
    .index("by_owner", ["owner"])
    .index("by_avatarUrl", ["avatarUrl"])
    .index("by_memberNumber", ["memberNumber"]),

  hiddenMatches: defineTable({
    owner: v.string(), // The person doing the hiding
    targetOwner: v.string(), // The person being hidden
    createdAt: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_owner_target", ["owner", "targetOwner"]),

  profileBlocks: defineTable({
    blockerOwner: v.string(),
    targetOwner: v.string(),
    createdAt: v.number(),
    reason: v.optional(v.string()),
  })
    .index("by_blocker_owner", ["blockerOwner", "targetOwner"])
    .index("by_target_owner", ["targetOwner", "createdAt"]),

  profileReports: defineTable({
    reporterOwner: v.string(),
    reporterAuthUserId: v.optional(v.string()),
    targetOwner: v.string(),
    reason: v.union(
      v.literal(PROFILE_REPORT_REASON_SPAM),
      v.literal(PROFILE_REPORT_REASON_HARASSMENT),
      v.literal(PROFILE_REPORT_REASON_IMPERSONATION),
      v.literal(PROFILE_REPORT_REASON_INAPPROPRIATE),
      v.literal(PROFILE_REPORT_REASON_SUSPICIOUS),
      v.literal(PROFILE_REPORT_REASON_OTHER)
    ),
    details: v.optional(v.string()),
    status: v.union(
      v.literal(PROFILE_REPORT_STATUS_PENDING),
      v.literal(PROFILE_REPORT_STATUS_REVIEWING),
      v.literal(PROFILE_REPORT_STATUS_DISMISSED),
      v.literal(PROFILE_REPORT_STATUS_ACTIONED)
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    adminNote: v.optional(v.string()),
  })
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_target_status", ["targetOwner", "status"])
    .index("by_reporter_target", ["reporterOwner", "targetOwner"]),

  moderationAuditLogs: defineTable({
    actorOwner: v.string(),
    actorAuthUserId: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    targetOwner: v.optional(v.string()),
    reportId: v.optional(v.id("profileReports")),
    previousStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_actor_createdAt", ["actorOwner", "createdAt"])
    .index("by_target_createdAt", ["targetOwner", "createdAt"]),

  // ─── Private Repo Aggregate Stats ─────────────────────────────
  // These tables store ONLY aggregate numbers keyed by githubLogin.
  // NO repo names, NO commit messages, NO SHAs, NO file paths.

  userPrivateDailyStats: defineTable({
    githubLogin: v.string(),
    date: v.number(), // epoch ms, midnight UTC
    human: v.number(),
    ai: v.number(),
    automation: v.number(),
    humanAdditions: v.number(),
    aiAdditions: v.number(),
    automationAdditions: v.number(),
  })
    .index("by_login", ["githubLogin"])
    .index("by_login_and_date", ["githubLogin", "date"]),

  userPrivateWeeklyStats: defineTable({
    githubLogin: v.string(),
    weekStart: v.number(),
    weekLabel: v.string(),
    human: v.number(),
    copilot: v.number(),
    claude: v.number(),
    cursor: v.optional(v.number()),
    aider: v.optional(v.number()),
    devin: v.optional(v.number()),
    openaiCodex: v.optional(v.number()),
    gemini: v.optional(v.number()),
    aiAssisted: v.number(),
    dependabot: v.number(),
    renovate: v.number(),
    githubActions: v.number(),
    otherBot: v.number(),
    total: v.number(),
    humanAdditions: v.optional(v.number()),
    copilotAdditions: v.optional(v.number()),
    claudeAdditions: v.optional(v.number()),
    cursorAdditions: v.optional(v.number()),
    aiderAdditions: v.optional(v.number()),
    devinAdditions: v.optional(v.number()),
    openaiCodexAdditions: v.optional(v.number()),
    geminiAdditions: v.optional(v.number()),
    aiAssistedAdditions: v.optional(v.number()),
    totalAdditions: v.optional(v.number()),
    totalDeletions: v.optional(v.number()),
  })
    .index("by_login", ["githubLogin"])
    .index("by_login_and_week", ["githubLogin", "weekStart"]),

  userPrivateSyncStatus: defineTable({
    githubLogin: v.string(),
    syncStatus: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("error")
    ),
    syncError: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    includesPrivateData: v.boolean(),
    // Progress tracking — updated during sync so the UI can show live progress.
    // All fields are optional for backward compatibility with existing rows.
    totalRepos: v.optional(v.number()),
    processedRepos: v.optional(v.number()),
    totalCommitsFound: v.optional(v.number()),
  }).index("by_login", ["githubLogin"]),

  repoPackages: defineTable({
    repoId: v.id("repos"),
    owner: v.string(),
    packageName: v.string(),
    section: v.union(v.literal("dependencies"), v.literal("devDependencies")),
    sourcePath: v.string(),
    versionRange: v.string(),
  })
    .index("by_repo", ["repoId"])
    .index("by_package", ["packageName"])
    .index("by_owner", ["owner"])
    .index("by_owner_package", ["owner", "packageName"]),

  repoMaintainedPackages: defineTable({
    repoId: v.id("repos"),
    owner: v.string(),
    packageName: v.string(),
    sourcePath: v.string(),
    confidence: v.literal("package-json-name"),
  })
    .index("by_repo", ["repoId"])
    .index("by_owner", ["owner"])
    .index("by_package", ["packageName"])
    .index("by_owner_package", ["owner", "packageName"]),

  ownerPackages: defineTable({
    owner: v.string(),
    packageName: v.string(),
    repoCount: v.number(),
    depCount: v.number(),
    devDepCount: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_package", ["packageName"])
    .index("by_owner_package", ["owner", "packageName"]),

  ownerLanguages: defineTable({
    owner: v.string(),
    language: v.string(),
    repoCount: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_language", ["language"])
    .index("by_owner_language", ["owner", "language"]),

  ownerTopics: defineTable({
    owner: v.string(),
    topic: v.string(),
    repoCount: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_topic", ["topic"])
    .index("by_owner_topic", ["owner", "topic"]),

  userPrivatePackages: defineTable({
    githubLogin: v.string(),
    packageName: v.string(),
    count: v.number(),
  })
    .index("by_login", ["githubLogin"])
    .index("by_login_package", ["githubLogin", "packageName"]),

  // ─── Notifications ──────────────────────────────────────────
  // Stored as in-app records first, then optionally grouped into
  // digest email deliveries.
  notificationDigests: defineTable({
    digestKey: v.string(),
    owner: v.string(),
    email: v.string(),
    category: v.string(),
    digestWindowMs: v.optional(v.number()),
    maxItemsPerEmail: v.optional(v.number()),
    maxEmailsPerDay: v.optional(v.number()),
    windowStart: v.number(),
    sendAfter: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed")
    ),
    attemptCount: v.number(),
    notificationCount: v.number(),
    lastError: v.optional(v.string()),
    lockUntil: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_digestKey", ["digestKey"])
    .index("by_status_sendAfter", ["status", "sendAfter"])
    .index("by_status_lockUntil", ["status", "lockUntil"])
    .index("by_owner_createdAt", ["owner", "createdAt"]),

  notifications: defineTable({
    recipientOwner: v.string(),
    recipientEmail: v.optional(v.string()),
    actorOwner: v.optional(v.string()),
    category: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    createdAt: v.number(),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    emailedAt: v.optional(v.number()),
    digestId: v.optional(v.id("notificationDigests")),
  })
    .index("by_owner_createdAt", ["recipientOwner", "createdAt"])
    .index("by_owner_isRead_createdAt", ["recipientOwner", "isRead", "createdAt"])
    .index("by_owner_dedupe", ["recipientOwner", "dedupeKey"])
    .index("by_digest", ["digestId"]),

  notificationPreferences: defineTable({
    owner: v.string(),
    emailEnabled: v.boolean(),
    defaultDigestWindowMs: v.number(),
    defaultMaxDigestItems: v.number(),
    maxEmailsPerDay: v.number(),
    categoryPreferences: v.array(
      v.object({
        category: v.string(),
        emailEnabled: v.optional(v.boolean()),
        digestWindowMs: v.optional(v.number()),
        maxDigestItems: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["owner"]),

  notificationEmailBudgets: defineTable({
    dayKey: v.string(),
    scope: v.union(v.literal("global"), v.literal("owner")),
    ownerKey: v.string(),
    sentCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_day_scope_owner", ["dayKey", "scope", "ownerKey"])
    .index("by_owner_day", ["ownerKey", "dayKey"]),

  notificationDeliveries: defineTable({
    digestId: v.id("notificationDigests"),
    owner: v.string(),
    email: v.string(),
    notificationIds: v.array(v.id("notifications")),
    notificationCount: v.number(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("rate_limited")),
    provider: v.string(),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    attemptedAt: v.number(),
  })
    .index("by_digest", ["digestId"])
    .index("by_attemptedAt", ["attemptedAt"])
    .index("by_owner_attemptedAt", ["owner", "attemptedAt"]),

  // ─── Weekly Star System ────────────────────────────────────
  // One star per user per target per week. Resets naturally each Monday.
  stars: defineTable({
    starrerLogin: v.string(),
    targetOwner: v.string(),
    weekStart: v.number(), // Monday 00:00 UTC epoch ms
    createdAt: v.number(),
  })
    .index("by_starrer_target_week", ["starrerLogin", "targetOwner", "weekStart"])
    .index("by_target_week", ["targetOwner", "weekStart"])
    .index("by_target", ["targetOwner"])
    .index("by_week", ["weekStart"])
    .index("by_starrer_week", ["starrerLogin", "weekStart"]),

  // ─── Invite / Referral System ──────────────────────────────
  // Each user gets 3 single-use invite codes. When redeemed, both
  // referrer and invitee earn +5 Stack Score points.
  inviteCodes: defineTable({
    ownerLogin: v.string(),
    code: v.string(),
    redeemedBy: v.optional(v.string()),
    redeemedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerLogin"])
    .index("by_code", ["code"]),

  userPrivateStackSyncStatus: defineTable({
    githubLogin: v.string(),
    syncStatus: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("synced"),
      v.literal("error")
    ),
    syncError: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    syncStartedAt: v.optional(v.number()),
    includesPrivateData: v.boolean(),
    totalRepos: v.optional(v.number()),
    processedRepos: v.optional(v.number()),
    totalManifestsFound: v.optional(v.number()),
    totalPackages: v.optional(v.number()),
  }).index("by_login", ["githubLogin"]),

  githubAppInstallations: defineTable({
    githubLogin: v.string(),
    installationId: v.number(),
    accountLogin: v.optional(v.string()),
    accountType: v.optional(v.string()),
    installedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_login", ["githubLogin"])
    .index("by_installation", ["installationId"]),

  organizationClaims: defineTable({
    organizationLogin: v.string(),
    organizationLoginLower: v.string(),
    claimedByLogin: v.string(),
    installationId: v.number(),
    claimedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationLoginLower"])
    .index("by_claimedBy", ["claimedByLogin"])
    .index("by_installation", ["installationId"]),

  userPrivateRepoManifestCache: defineTable({
    githubLogin: v.string(),
    repoKeyHash: v.optional(v.string()),
    manifestFingerprint: v.string(),
    packages: v.array(v.string()),
    manifestCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_login", ["githubLogin"])
    .index("by_login_repoKeyHash", ["githubLogin", "repoKeyHash"])
    .index("by_login_updatedAt", ["githubLogin", "updatedAt"]),

  // ─── Social Feature Rate Limits ────────────────────────────
  // Tracks daily action counts for feature-gated actions.
  // Keyed by date string (YYYY-MM-DD) — resets naturally, no cron needed.
  dailyActionCounts: defineTable({
    owner: v.string(),
    action: v.string(), // "message" | "follow"
    date: v.string(), // YYYY-MM-DD
    count: v.number(),
  })
    .index("by_owner_action_date", ["owner", "action", "date"])
    .index("by_date", ["date"]),

  // ─── Follow System ────────────────────────────────────────
  follows: defineTable({
    followerOwner: v.string(),
    followingOwner: v.string(),
    createdAt: v.number(),
  })
    .index("by_follower", ["followerOwner", "createdAt"])
    .index("by_following", ["followingOwner", "createdAt"])
    .index("by_pair", ["followerOwner", "followingOwner"]),

  // ─── Activity Feed ────────────────────────────────────────
  feedEvents: defineTable({
    owner: v.string(), // who generated this event
    type: v.string(), // "joined" | "starred" | "followed" | "repo_analyzed" | "stack_changed"
    actorOwner: v.string(),
    targetOwner: v.optional(v.string()),
    targetRepo: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_owner_created", ["owner", "createdAt"])
    .index("by_type_created", ["type", "createdAt"])
    .index("by_created", ["createdAt"]),

  // ─── Direct Messages ──────────────────────────────────────
  conversations: defineTable({
    participantA: v.string(), // alphabetically first
    participantB: v.string(), // alphabetically second
    lastMessageAt: v.number(),
    lastMessagePreview: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_participantA", ["participantA", "lastMessageAt"])
    .index("by_participantB", ["participantB", "lastMessageAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderOwner: v.string(),
    body: v.string(),
    createdAt: v.number(),
    isRead: v.boolean(),
  })
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_conversation_unread", ["conversationId", "isRead"]),

  // New table to store granular package usage per user per repo
  packageUsage: defineTable({
    userId: v.string(), // Better Auth component user id for the repo owner
    repoId: v.id("repos"), // Link to the specific repository
    packageName: v.string(),
    type: v.union(
      v.literal("dependencies"),
      v.literal("devDependencies"),
      v.literal("peerDependencies"),
      v.literal("optionalDependencies")
    ),
    version: v.string(), // Exact version from package.json
    // Future enhancements: `usageScore` based on LOC, file imports, etc.
  })
    .index("by_userId", ["userId"])
    .index("by_repoId", ["repoId"])
    .index("by_userId_packageName", ["userId", "packageName"]),

  // ─── Retired Early Access Invitations ─────────────────────
  // Legacy tokens retained for historical records and old email links.
  invitations: defineTable({
    token: v.string(), // unique token (e.g., inv_abc123)
    email: v.string(), // recipient email
    expiresAt: v.number(), // expiration timestamp
    usedAt: v.optional(v.number()), // when the token was first redeemed
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  // ─── Package Popularity (IDF Precomputation) ───────────────
  packagePopularity: defineTable({
    packageName: v.string(),
    ownerCount: v.number(),
    updatedAt: v.number(),
  }).index("by_packageName", ["packageName"]),

  // ─── Live Page Caches ─────────────────────────────────────────
  developerDirectoryCache: defineTable({
    owner: v.string(),
    avatarUrl: v.string(),
    displayName: v.union(v.string(), v.null()),
    followers: v.number(),
    ownerType: v.optional(
      v.union(
        v.literal("developer"),
        v.literal("organization"),
        v.literal("bot"),
        v.literal("maintainer")
      )
    ),
    repoCount: v.number(),
    power: v.number(),
    totalStars: v.number(),
    /** @deprecated Legacy directory cache field retained for old local/prod rows. */
    superLikesCount: v.optional(v.number()),
    starsCount: v.optional(v.number()),
    firstIndexedAt: v.number(),
    lastIndexedAt: v.number(),
    isSyncing: v.boolean(),
  })
    .index("by_power", ["power"])
    .index("by_owner", ["owner"]),

  indexedUsersCache: defineTable({
    owner: v.string(),
    avatarUrl: v.string(),
    ownerType: v.optional(
      v.union(
        v.literal("developer"),
        v.literal("organization"),
        v.literal("bot"),
        v.literal("maintainer")
      )
    ),
    repoCount: v.number(),
    totalStars: v.number(),
    totalCommits: v.number(),
    humanCommits: v.number(),
    botCommits: v.number(),
    automationCommits: v.number(),
    firstIndexedAt: v.optional(v.number()),
    lastIndexedAt: v.number(),
    isSyncing: v.boolean(),
    humanPercentage: v.string(),
    botPercentage: v.string(),
    automationPercentage: v.string(),
  })
    .index("by_firstIndexedAt", ["firstIndexedAt"])
    .index("by_lastIndexedAt", ["lastIndexedAt"])
    .index("by_owner", ["owner"]),

  globalStackLeaderboardCache: defineTable({
    packageName: v.string(),
    ownerCount: v.number(),
    repoCount: v.number(),
    depCount: v.number(),
    devDepCount: v.number(),
  })
    .index("by_ownerCount", ["ownerCount"])
    .index("by_packageName", ["packageName"]),

  ownerPageMatchCache: defineTable({
    owner: v.string(),
    viewMode: v.literal("public"),
    matches: v.array(v.any()),
    totalMatchCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_viewMode", ["owner", "viewMode"])
    .index("by_updatedAt", ["updatedAt"]),

  ownerPageDataCache: defineTable({
    owner: v.string(),
    viewMode: v.literal("public"),
    pageData: v.any(),
    weekStart: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_viewMode", ["owner", "viewMode"])
    .index("by_updatedAt", ["updatedAt"]),

  // ─── System Health & Security ────────────────────────────────
  systemStatus: defineTable({
    key: v.string(), // e.g. "github_api_health"
    value: v.any(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  referralLookupAttempts: defineTable({
    ipHash: v.string(),
    lastAttemptAt: v.number(),
    count: v.number(),
  }).index("by_ip", ["ipHash"]),
});
