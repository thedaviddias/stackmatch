import { describe, expect, it } from "vitest";
import type { CommitForStats } from "../stats_computation";
import { computeStatsFromCommits } from "../stats_computation";

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeCommit(
  overrides: Partial<CommitForStats> & { classification: string }
): CommitForStats {
  return {
    authoredAt: Date.UTC(2024, 5, 12, 10, 0, 0), // Wed Jun 12 2024
    additions: 10,
    deletions: 5,
    authorLogin: "user",
    ...overrides,
  };
}

// ─── computeStatsFromCommits ─────────────────────────────────────────────

describe("computeStatsFromCommits", () => {
  it("returns empty arrays for empty input", () => {
    const result = computeStatsFromCommits([]);
    expect(result.weeklyStats).toEqual([]);
    expect(result.dailyStats).toEqual([]);
    expect(result.contributorStats).toEqual([]);
  });

  describe("weekly stats", () => {
    it("buckets a single human commit into the correct week", () => {
      const commits = [makeCommit({ classification: "human" })];
      const { weeklyStats } = computeStatsFromCommits(commits);

      expect(weeklyStats).toHaveLength(1);
      expect(weeklyStats[0]?.human).toBe(1);
      expect(weeklyStats[0]?.total).toBe(1);
      expect(weeklyStats[0]?.humanAdditions).toBe(10);
    });

    it("separates commits from different weeks", () => {
      const commits = [
        makeCommit({
          classification: "human",
          authoredAt: Date.UTC(2024, 5, 10), // Mon Jun 10
        }),
        makeCommit({
          classification: "human",
          authoredAt: Date.UTC(2024, 5, 17), // Mon Jun 17
        }),
      ];
      const { weeklyStats } = computeStatsFromCommits(commits);
      expect(weeklyStats).toHaveLength(2);
    });

    it("aggregates multiple classifications in the same week", () => {
      const commits = [
        makeCommit({ classification: "human", authoredAt: Date.UTC(2024, 5, 10) }),
        makeCommit({ classification: "copilot", authoredAt: Date.UTC(2024, 5, 11) }),
        makeCommit({ classification: "dependabot", authoredAt: Date.UTC(2024, 5, 12) }),
      ];
      const { weeklyStats } = computeStatsFromCommits(commits);

      expect(weeklyStats).toHaveLength(1);
      expect(weeklyStats[0]?.human).toBe(1);
      expect(weeklyStats[0]?.copilot).toBe(1);
      expect(weeklyStats[0]?.dependabot).toBe(1);
      expect(weeklyStats[0]?.total).toBe(3);
    });

    it("tracks additions per AI tool", () => {
      const commits = [
        makeCommit({ classification: "claude", additions: 100, deletions: 20 }),
        makeCommit({ classification: "cursor", additions: 50, deletions: 10 }),
      ];
      const { weeklyStats } = computeStatsFromCommits(commits);

      expect(weeklyStats[0]?.claudeAdditions).toBe(100);
      expect(weeklyStats[0]?.cursorAdditions).toBe(50);
      expect(weeklyStats[0]?.totalAdditions).toBe(150);
      expect(weeklyStats[0]?.totalDeletions).toBe(30);
    });

    it("generates ISO week labels", () => {
      const commits = [
        makeCommit({
          classification: "human",
          authoredAt: Date.UTC(2024, 0, 3), // Wed Jan 3 2024
        }),
      ];
      const { weeklyStats } = computeStatsFromCommits(commits);
      expect(weeklyStats[0]?.weekLabel).toMatch(/^2024-W01$/);
    });
  });

  describe("daily stats", () => {
    it("splits commits into human/ai/automation buckets", () => {
      const day = Date.UTC(2024, 5, 12);
      const commits = [
        makeCommit({ classification: "human", authoredAt: day }),
        makeCommit({ classification: "copilot", authoredAt: day }),
        makeCommit({ classification: "dependabot", authoredAt: day }),
      ];
      const { dailyStats } = computeStatsFromCommits(commits);

      expect(dailyStats).toHaveLength(1);
      expect(dailyStats[0]?.human).toBe(1);
      expect(dailyStats[0]?.ai).toBe(1);
      expect(dailyStats[0]?.automation).toBe(1);
    });

    it("treats all AI tool classifications as 'ai'", () => {
      const day = Date.UTC(2024, 5, 12);
      const aiTools = [
        "copilot",
        "claude",
        "cursor",
        "aider",
        "devin",
        "openai-codex",
        "gemini",
        "ai-assisted",
      ];
      const commits = aiTools.map((classification) =>
        makeCommit({ classification, authoredAt: day })
      );
      const { dailyStats } = computeStatsFromCommits(commits);

      expect(dailyStats[0]?.ai).toBe(aiTools.length);
      expect(dailyStats[0]?.human).toBe(0);
      expect(dailyStats[0]?.automation).toBe(0);
    });

    it("tracks additions per category", () => {
      const day = Date.UTC(2024, 5, 12);
      const commits = [
        makeCommit({ classification: "human", authoredAt: day, additions: 100 }),
        makeCommit({ classification: "claude", authoredAt: day, additions: 50 }),
        makeCommit({ classification: "renovate", authoredAt: day, additions: 25 }),
      ];
      const { dailyStats } = computeStatsFromCommits(commits);

      expect(dailyStats[0]?.humanAdditions).toBe(100);
      expect(dailyStats[0]?.aiAdditions).toBe(50);
      expect(dailyStats[0]?.automationAdditions).toBe(25);
    });
  });

  describe("contributor stats", () => {
    it("groups commits by author login", () => {
      const commits = [
        makeCommit({ classification: "human", authorLogin: "alice" }),
        makeCommit({ classification: "human", authorLogin: "alice" }),
        makeCommit({ classification: "human", authorLogin: "bob" }),
      ];
      const { contributorStats } = computeStatsFromCommits(commits);

      expect(contributorStats).toHaveLength(2);
      const alice = contributorStats.find((c) => c.login === "alice");
      const bob = contributorStats.find((c) => c.login === "bob");
      expect(alice?.commitCount).toBe(2);
      expect(bob?.commitCount).toBe(1);
    });

    it("falls back to email when login is missing", () => {
      const commits = [
        makeCommit({
          classification: "human",
          authorLogin: undefined,
          authorEmail: "alice@example.com",
        }),
      ];
      const { contributorStats } = computeStatsFromCommits(commits);
      expect(contributorStats[0]?.email).toBe("alice@example.com");
    });

    it("assigns the most frequent classification to a contributor", () => {
      const commits = [
        makeCommit({ classification: "human", authorLogin: "alice" }),
        makeCommit({ classification: "human", authorLogin: "alice" }),
        makeCommit({ classification: "copilot", authorLogin: "alice" }),
      ];
      const { contributorStats } = computeStatsFromCommits(commits);
      expect(contributorStats[0]?.classification).toBe("human"); // 2 human vs 1 copilot
    });

    it("accumulates additions and deletions per contributor", () => {
      const commits = [
        makeCommit({
          classification: "human",
          authorLogin: "alice",
          additions: 100,
          deletions: 20,
        }),
        makeCommit({ classification: "human", authorLogin: "alice", additions: 50, deletions: 10 }),
      ];
      const { contributorStats } = computeStatsFromCommits(commits);
      expect(contributorStats[0]?.additions).toBe(150);
      expect(contributorStats[0]?.deletions).toBe(30);
    });

    it("tracks first and last commit timestamps", () => {
      const early = Date.UTC(2024, 0, 1);
      const late = Date.UTC(2024, 11, 31);
      const commits = [
        makeCommit({ classification: "human", authorLogin: "alice", authoredAt: late }),
        makeCommit({ classification: "human", authorLogin: "alice", authoredAt: early }),
      ];
      const { contributorStats } = computeStatsFromCommits(commits);
      expect(contributorStats[0]?.firstCommitAt).toBe(early);
      expect(contributorStats[0]?.lastCommitAt).toBe(late);
    });
  });

  describe("handles missing optional fields", () => {
    it("defaults additions and deletions to 0 when undefined", () => {
      const commits = [
        makeCommit({
          classification: "human",
          additions: undefined,
          deletions: undefined,
        }),
      ];
      const { weeklyStats, dailyStats } = computeStatsFromCommits(commits);

      expect(weeklyStats[0]?.humanAdditions).toBe(0);
      expect(weeklyStats[0]?.totalAdditions).toBe(0);
      expect(weeklyStats[0]?.totalDeletions).toBe(0);
      expect(dailyStats[0]?.humanAdditions).toBe(0);
    });
  });
});
